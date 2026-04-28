import type { Metadata } from "next";
import { AdminFabricEditPage } from "../../AdminCatalogPages";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Edit fabric | Mobel Unique",
};

interface FabricEditRouteProps {
  params: Promise<{
    fabric_id: string;
  }>;
}

export default async function FabricEditRoute({
  params,
}: FabricEditRouteProps) {
  const { fabric_id: fabricId } = await params;

  return <AdminFabricEditPage fabricId={fabricId} />;
}
