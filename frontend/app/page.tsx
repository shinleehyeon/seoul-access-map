import { HomeDashboardClient } from "@/components/HomeDashboardClient";
import { getCrimeCctvStats } from "@/lib/data";

export default async function Home() {
  const stats = await getCrimeCctvStats();
  return <HomeDashboardClient stats={stats} />;
}
