import type { Metadata } from "next";
import { AdminSofasPage } from "../AdminCatalogPages";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Sofas | Mobel Unique",
};

export default function SofasPage() {
  return <AdminSofasPage />;
}
