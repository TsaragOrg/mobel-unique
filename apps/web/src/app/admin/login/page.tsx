import type { Metadata } from "next";
import { AdminPageHeader, AdminShell } from "../AdminShell";
import AdminLoginForm from "./AdminLoginForm";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: "Admin sign in | Mobel Unique"
};

export default function AdminLoginPage() {
  return (
    <AdminShell showNavigation={false} variant="auth">
      <section className="admin-auth-card" aria-labelledby="admin-login-title">
        <AdminPageHeader
          description="Use your admin account to manage Mobel Unique catalog content."
          eyebrow="Secure workspace"
          title="Admin sign in"
          titleId="admin-login-title"
        />
        <AdminLoginForm />
      </section>
    </AdminShell>
  );
}
