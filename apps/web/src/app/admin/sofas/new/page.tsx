import type { Metadata } from "next";
import { AdminSofaCreatePage } from "../../AdminCatalogPages";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Create sofa | Mobel Unique",
};

export default function NewSofaPage() {
  return <AdminSofaCreatePage />;
}
