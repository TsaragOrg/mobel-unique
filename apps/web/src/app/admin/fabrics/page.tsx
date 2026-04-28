import type { Metadata } from "next";
import { AdminFabricsPage } from "../AdminCatalogPages";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Fabrics | Mobel Unique",
};

export default function FabricsPage() {
  return <AdminFabricsPage />;
}
