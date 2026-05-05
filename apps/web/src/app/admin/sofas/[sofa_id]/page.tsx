import type { Metadata } from "next";
import { AdminSofaEditPage } from "../../AdminCatalogPages";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Edit sofa | Mobel Unique",
};

interface SofaEditRouteProps {
  params: Promise<{
    sofa_id: string;
  }>;
}

export default async function SofaEditRoute({ params }: SofaEditRouteProps) {
  const { sofa_id: sofaId } = await params;

  return <AdminSofaEditPage sofaId={sofaId} />;
}
