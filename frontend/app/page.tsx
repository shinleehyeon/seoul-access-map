import { HomeDashboardClient } from "@/components/HomeDashboardClient";
import { getDistrictStats, getSummary } from "@/lib/data";

export default async function Home() {
  const [districtStats, summary] = await Promise.all([getDistrictStats(), getSummary()]);

  return <HomeDashboardClient districtStats={districtStats} summary={summary} />;
}
