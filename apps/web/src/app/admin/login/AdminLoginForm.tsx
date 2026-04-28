"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getBrowserSupabaseClient } from "../../../lib/supabase-browser";

const GENERIC_SIGN_IN_ERROR = "Unable to sign in with these credentials.";

export default function AdminLoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data.session?.access_token) {
        setErrorMessage(GENERIC_SIGN_IN_ERROR);
        return;
      }

      const registrationResponse = await fetch("/api/admin/trusted-device", {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        },
        method: "POST"
      });

      if (registrationResponse.status === 403) {
        await supabase.auth.signOut();
        setErrorMessage("This account is not authorized for the admin area.");
        return;
      }

      if (!registrationResponse.ok) {
        await supabase.auth.signOut();
        setErrorMessage("Unable to complete admin sign in.");
        return;
      }

      router.replace("/admin");
    } catch {
      setErrorMessage("Unable to complete admin sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Email</span>
        <input
          autoComplete="email"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          autoComplete="current-password"
          name="password"
          required
          type="password"
        />
      </label>
      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
