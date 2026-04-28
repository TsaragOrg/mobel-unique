import type { Metadata } from "next";
import { AdminFabricCreatePage } from "../../AdminCatalogPages";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Create fabric | Mobel Unique",
};

export default function NewFabricPage() {
  return <AdminFabricCreatePage />;
}
