/*
RU: Этот файл нужен для формы входа в админку. На экране видны поля почты и пароля, ошибка и кнопка входа. Здесь можно ввести данные и открыть рабочую зону.
FR: Ce fichier sert au formulaire d'entree admin. A l'ecran, on voit les champs e-mail et mot de passe, une erreur et le bouton d'entree. Ici, on peut entrer les donnees et ouvrir l'espace de travail.
*/

"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getBrowserSupabaseClient } from "../../../lib/supabase-browser";
import { ADMIN_COPY } from "../admin-copy";

export default function AdminLoginForm() {
  // RU: Это место меняет адрес страницы после успешного входа.
  // FR: Cet endroit change l'adresse de la page apres une entree reussie.
  const router = useRouter();
  // RU: Эти значения показывают ошибку и занятость кнопки входа.
  // FR: Ces valeurs affichent l'erreur et l'occupation du bouton d'entree.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // RU: Это действие проверяет почту и пароль, затем открывает админку.
  // FR: Cette action verifie l'e-mail et le mot de passe, puis ouvre l'admin.
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
        setErrorMessage(ADMIN_COPY.login.form.genericError);
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
        setErrorMessage(ADMIN_COPY.auth.deniedDescription);
        return;
      }

      if (!registrationResponse.ok) {
        await supabase.auth.signOut();
        setErrorMessage(ADMIN_COPY.login.form.signInFailed);
        return;
      }

      router.replace("/admin");
    } catch {
      setErrorMessage(ADMIN_COPY.login.form.signInFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>{ADMIN_COPY.login.form.emailLabel}</span>
        <input
          autoComplete="email"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="field">
        <span>{ADMIN_COPY.login.form.passwordLabel}</span>
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
        {isSubmitting
          ? ADMIN_COPY.login.form.submitBusyLabel
          : ADMIN_COPY.login.form.submitLabel}
      </button>
    </form>
  );
}
