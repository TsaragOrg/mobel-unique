import type { Metadata } from "next";
import { ADMIN_COPY } from "../admin-copy";
import AdminSimulationAnalyticsPage from "../AdminSimulationAnalyticsPage";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: ADMIN_COPY.catalog.metadataTitles.analytics,
};

export default function AnalyticsPage() {
  return <AdminSimulationAnalyticsPage />;
}
