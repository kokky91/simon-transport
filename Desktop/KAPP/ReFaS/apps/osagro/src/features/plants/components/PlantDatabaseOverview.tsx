import { useQuery } from '@tanstack/react-query';
import { getPlants } from '../api/plantsApi';
import type { PlantRecord } from '../types';

const STATUS_COLOR: Record<string, string> = {
  draft:        "bg-gray-100 text-gray-800 border-gray-300",
  ai_generated: "bg-purple-100 text-purple-800 border-purple-300",
  reviewed:     "bg-blue-100 text-blue-800 border-blue-300",
  approved:     "bg-green-100 text-green-800 border-green-300",
};

const CATEGORY_ICON: Record<string, string> = {
  cereal: "🌾", legume: "🥜", vegetable: "🥦", fruit_tree: "🍎",
  multipurpose_tree: "🌳", protective_tree: "🛡️", nitrogen_fixer: "🌱",
  fodder_grass: "🌿", pest_deterrent: "🐝", erosion_control: "🏞️",
};

function getCategoryIcon(cat: string): string {
  return CATEGORY_ICON[cat] ?? "🌱";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLOR[status] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}>{status}</span>
  );
}

function TableHeader() {
  return (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-3 py-2 text-left">Code</th>
        <th className="px-3 py-2 text-left">Naam</th>
        <th className="px-3 py-2 text-left">Categorie</th>
        <th className="px-3 py-2 text-left">Type</th>
        <th className="px-3 py-2 text-left">Status</th>
        <th className="px-3 py-2 text-left">Aangemaakt</th>
      </tr>
    </thead>
  );
}

function TableRow({ plant }: { plant: PlantRecord }) {
  return (
    <tr className="border-b">
      <td className="px-3 py-2 font-mono text-xs">{plant.plant_code}</td>
      <td className="px-3 py-2">{plant.scientific_name}</td>
      <td className="px-3 py-2">{getCategoryIcon(plant.category)} {plant.category}</td>
      <td className="px-3 py-2">{plant.plant_type}</td>
      <td className="px-3 py-2"><StatusBadge status={plant.review_status} /></td>
      <td className="px-3 py-2 text-xs">{new Date(plant.created_at).toLocaleDateString()}</td>
    </tr>
  );
}

export function PlantDatabaseOverview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['plants'],
    queryFn: getPlants,
  });

  if (isLoading) return <div className="text-gray-400">Laden...</div>;
  if (error) return <div className="text-red-500">Fout bij laden van data</div>;
  const plants: PlantRecord[] = data ?? [];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">PlantDatabaseOverview: {plants.length} planten</h2>
      {plants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded shadow">
            <TableHeader />
            <tbody>
              {plants.map((plant: PlantRecord) => (
                <TableRow key={plant.id} plant={plant} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-gray-400">Geen planten gevonden.</div>
      )}
    </div>
  );
}
