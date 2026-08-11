import { HomeDashboardClient } from "@/components/HomeDashboardClient";
import { getBikeAccidentInsights } from "@/lib/data";

export default async function Home() {
  const insights = await getBikeAccidentInsights();
  return <HomeDashboardClient insights={insights} />;
}
