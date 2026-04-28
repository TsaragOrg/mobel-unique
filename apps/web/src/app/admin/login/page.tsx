import type { Metadata } from "next";
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
    <main className="shell admin-shell">
      <section className="panel admin-panel" aria-labelledby="admin-login-title">
        <p className="eyebrow">Mobel Unique</p>
        <h1 id="admin-login-title">Admin sign in</h1>
        <AdminLoginForm />
      </section>
    </main>
  );
}
