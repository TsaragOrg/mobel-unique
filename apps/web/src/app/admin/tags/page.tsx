import type { Metadata } from "next";
import { AdminTagsPage } from "../AdminCatalogPages";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Tags | Mobel Unique",
};

export default function TagsPage() {
  return <AdminTagsPage />;
}
