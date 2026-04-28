import type { Metadata } from "next";
import AdminDashboard from "./AdminDashboard";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: "Admin dashboard | Mobel Unique"
};

export default function AdminPage() {
  return <AdminDashboard />;
}
