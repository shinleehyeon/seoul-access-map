import { Dashboard } from "@/components/Dashboard";
import { getDistrictStats, getPharmacies } from "@/lib/data";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const [{ id }, pharmacies, districtStats] = await Promise.all([
    searchParams,
    getPharmacies(),
    getDistrictStats(),
  ]);

  return (
    <div className="h-full min-h-0">
      <Dashboard pharmacies={pharmacies} districtStats={districtStats} initialId={id} />
    </div>
  );
}
