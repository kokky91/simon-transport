import { useQuery } from '@tanstack/react-query';
import { getPlantVersions } from '../api/plantsApi';
import { Plus, TrendingUp, Leaf, Droplets, CheckCircle } from "lucide-react";
import { useMemo } from "react";

export interface PlantRecord {
  id: string;
  plant_code: string;
  scientific_name: string;
  genus?: string;
  species?: string;
  family?: string;
  common_name_nl?: string;
  common_name_en?: string;
  plant_type: string;
  category: string;
  climate_zones: string[];
  temperature_min_c?: number;
  temperature_max_c?: number;
  drought_tolerance: "low" | "medium" | "high";
  nitrogen_fixing: boolean;
  yield_min_kg_per_ha?: number;
  yield_max_kg_per_ha?: number;
  days_to_first_harvest?: number;
  review_status: "draft" | "ai_generated" | "reviewed" | "approved";
  created_at: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  approved:     { bg: "bg-green-50",  text: "text-green-800",  dot: "bg-green-500" },
  reviewed:     { bg: "bg-blue-50",   text: "text-blue-800",   dot: "bg-blue-500" },
  ai_generated: { bg: "bg-purple-50", text: "text-purple-800", dot: "bg-purple-500" },
  draft:        { bg: "bg-gray-50",   text: "text-gray-700",   dot: "bg-gray-400" },
};

const CATEGORY_ICON: Record<string, string> = {
  cereal: "🌾", legume: "🫘", vegetable: "🥦", fruit_tree: "🍎",
  multipurpose_tree: "🌳", protective_tree: "🛡️", nitrogen_fixer: "🌱",
  erosion_control: "🏔️", cover_crop: "🌿", fodder_grass: "🌿",
};

function getCategoryIcon(cat: string): string {
  return CATEGORY_ICON[cat] ?? "🌱";
}

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
  accent?: string;
  onClick?: () => void;
}

function StatCard({ icon, value, label, sub, accent = "border-green-200", onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 shadow-sm border-2 ${accent} transition-all hover:-translate-y-1 hover:shadow-md ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="mb-3 text-3xl">{icon}</div>
      <div className="text-3xl font-black leading-none text-gray-900">{value}</div>
      <div className="mt-1 text-sm font-semibold text-gray-700">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

interface SimpleBarProps {
  data: { label: string; value: number; color?: string }[];
  max: number;
}

function SimpleBar({ data, max }: SimpleBarProps) {
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-sm text-gray-600 truncate w-28 shrink-0">{d.label}</span>
          <div className="flex-1 h-3 overflow-hidden bg-gray-100 rounded-full">
            <div
              className={`h-3 rounded-full transition-all ${d.color ?? "bg-green-500"}`}
              style={{ width: `${Math.round((d.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-6 text-sm font-bold text-right text-gray-700">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

interface PlantDashboardProps {
  onAddPlant: () => void;
  onGoList: () => void;
}

export function PlantDashboard({ onAddPlant, onGoList }: PlantDashboardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['plants'],
    queryFn: async () => {
      const plantId = 'test-plant-id';
      const resp = await getPlantVersions({ plantId });
      if (resp.versions.length && 'plant_code' in resp.versions[0]) {
        return resp.versions as unknown as PlantRecord[];
      }
      return [
        {
          id: "1", plant_code: "COWPEA", scientific_name: "Vigna unguiculata", family: "Fabaceae", common_name_nl: "Koepeul", common_name_en: "Cowpea", plant_type: "annual", category: "legume", climate_zones: ["Aw", "As"], temperature_min_c: 18, temperature_max_c: 35, drought_tolerance: "high" as "high", nitrogen_fixing: true, yield_min_kg_per_ha: 800, yield_max_kg_per_ha: 2500, days_to_first_harvest: 60, review_status: "approved" as "approved", created_at: "2025-03-04T10:30:00Z"
        },
        {
          id: "2", plant_code: "MAIZE", scientific_name: "Zea mays", family: "Poaceae", common_name_nl: "Maïs", common_name_en: "Maize", plant_type: "annual", category: "cereal", climate_zones: ["Aw", "Cfa"], temperature_min_c: 15, temperature_max_c: 35, drought_tolerance: "medium" as "medium", nitrogen_fixing: false, yield_min_kg_per_ha: 2000, yield_max_kg_per_ha: 6000, days_to_first_harvest: 90, review_status: "approved" as "approved", created_at: "2025-03-04T10:35:00Z"
        }
      ];
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Fout bij ophalen van planten: {String(error)}</div>;
  const plants: PlantRecord[] = data ?? [];

  // ...existing code...

  const stats = useMemo(() => {
    const typeCount = plants.reduce<Record<string, number>>((acc, p) => {
      acc[p.plant_type] = (acc[p.plant_type] ?? 0) + 1;
      return acc;
    }, {});
    const categoryCount = plants.reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] ?? 0) + 1;
      return acc;
    }, {});
    const statusCount = plants.reduce<Record<string, number>>((acc, p) => {
      acc[p.review_status] = (acc[p.review_status] ?? 0) + 1;
      return acc;
    }, {});
    const droughtHighCount = plants.filter((p) => p.drought_tolerance === "high").length;
    const nFixerCount = plants.filter((p) => p.nitrogen_fixing).length;
    const approvedCount = plants.filter((p) => p.review_status === "approved").length;
    const avgYield = plants
      .filter((p) => p.yield_max_kg_per_ha)
      .reduce((sum, p) => sum + (p.yield_max_kg_per_ha ?? 0), 0) /
      Math.max(plants.filter((p) => p.yield_max_kg_per_ha).length, 1);
    return { typeCount, categoryCount, statusCount, droughtHighCount, nFixerCount, approvedCount, avgYield };
  }, [plants]);

  const recent = useMemo(
    () => [...plants].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [plants]
  );

  const typeBarData = Object.entries(stats.typeCount)
    .map(([label, value]) => ({ label, value: Number(value) }))
    .sort((a, b) => (a.value as number) - (b.value as number));

  const categoryBarData = Object.entries(stats.categoryCount)
    .map(([label, value]) => ({ label: label.replace(/_/g, " "), value: Number(value), color: "bg-emerald-500" }))
    .sort((a, b) => (a.value as number) - (b.value as number))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={<Leaf className="text-green-600" size={28} />}
          value={plants.length}
          label="Totaal soorten"
          sub={`${stats.approvedCount} goedgekeurd`}
          accent="border-green-200"
          onClick={onGoList}
        />
        <StatCard
          icon={<span className="text-2xl">⚗️</span>}
          value={stats.nFixerCount}
          label="N-Fixers"
          sub={`${Math.round((stats.nFixerCount / plants.length) * 100)}% van totaal`}
          accent="border-lime-200"
        />
        <StatCard
          icon={<Droplets className="text-amber-500" size={28} />}
          value={stats.droughtHighCount}
          label="Droogtebestendig"
          sub="hoge tolerantie"
          accent="border-amber-200"
        />
        <StatCard
          icon={<CheckCircle className="text-emerald-600" size={28} />}
          value={`${Math.round(stats.avgYield / 1000 * 10) / 10}t`}
          label="Gem. opbrengst"
          sub="kg/ha max"
          accent="border-emerald-200"
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Plant types */}
        <div className="p-5 bg-white border border-gray-200 shadow-sm rounded-2xl">
          <h3 className="mb-4 text-xs font-bold tracking-widest text-gray-400 uppercase">
            Planttypes
          </h3>
          <SimpleBar data={typeBarData} max={Math.max(...Object.values(stats.typeCount))} />
        </div>

        {/* Categories */}
        <div className="p-5 bg-white border border-gray-200 shadow-sm rounded-2xl">
          <h3 className="mb-4 text-xs font-bold tracking-widest text-gray-400 uppercase">
            Categorieën
          </h3>
          <SimpleBar data={categoryBarData} max={Math.max(...Object.values(stats.categoryCount))} />
        </div>

        {/* Review status */}
        <div className="p-5 bg-white border border-gray-200 shadow-sm rounded-2xl">
          <h3 className="mb-4 text-xs font-bold tracking-widest text-gray-400 uppercase">
            Review status
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.statusCount).map(([status, count]) => {
              const style = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
              const countNum = Number(count);
              const pct = Math.round((countNum / plants.length) * 100);
              return (
                <div key={status} className={`flex items-center justify-between px-3 py-2 rounded-lg ${style.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <span className={`text-sm font-semibold capitalize ${style.text}`}>
                      {status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${style.text}`}>{countNum}</span>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Droogte tolerantie donut ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="p-5 bg-white border border-gray-200 shadow-sm rounded-2xl">
          <h3 className="mb-4 text-xs font-bold tracking-widest text-gray-400 uppercase">
            Droogtetolerantie verdeling
          </h3>
          <div className="flex gap-4">
            {(["high", "medium", "low"] as const).map((level) => {
              const count = plants.filter((p) => p.drought_tolerance === level).length;
              const pct = Math.round((count / plants.length) * 100);
              const color = level === "high" ? "bg-green-500" : level === "medium" ? "bg-amber-400" : "bg-red-400";
              const textColor = level === "high" ? "text-green-700" : level === "medium" ? "text-amber-700" : "text-red-700";
              const label = level === "high" ? "Hoog" : level === "medium" ? "Gemiddeld" : "Laag";
              return (
                <div key={level} className="flex-1 text-center">
                  <div className="relative w-6 h-6 mx-auto mb-2">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke={level === "high" ? "#22c55e" : level === "medium" ? "#f59e0b" : "#f87171"}
                        strokeWidth="3"
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-sm font-black ${textColor}`}>
                      {pct}%
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-600">{label}</p>
                  <p className="text-xs text-gray-400">{count} soorten</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent toegevoegd */}
        <div className="p-5 bg-white border border-gray-200 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-widest text-gray-400 uppercase">
              Recent toegevoegd
            </h3>
            <button
              type="button"
              onClick={onGoList}
              className="text-xs font-semibold text-green-600 hover:underline"
            >
              Alle →
            </button>
          </div>
          <div className="space-y-2">
            {recent.map((p) => {
              const status = STATUS_STYLE[p.review_status] ?? STATUS_STYLE.draft;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-2 transition-all rounded-xl hover:bg-gray-50"
                >
                  <span className="flex-shrink-0 w-8 text-xl text-center">
                    {getCategoryIcon(p.category)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {p.common_name_en ?? p.plant_code}
                    </p>
                    <p className="text-xs italic text-gray-400 truncate">
                      {p.scientific_name}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${status.bg} ${status.text}`}
                  >
                    {p.review_status === "approved"
                      ? "✓"
                      : p.review_status === "reviewed"
                      ? "◐"
                      : p.review_status === "ai_generated"
                      ? "🤖"
                      : "✎"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-green-700 to-emerald-700 rounded-2xl">
        <div>
          <h3 className="text-lg font-bold text-white">Plant ontbreekt in de database?</h3>
          <p className="mt-1 text-sm text-green-100">
            Voeg handmatig toe of upload een PDF voor AI-extractie.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddPlant}
          className="flex items-center flex-shrink-0 gap-2 px-5 py-3 text-sm font-bold text-green-800 transition-all bg-white shadow-md rounded-xl hover:bg-green-50"
        >
          <Plus size={16} />
          Plant toevoegen
        </button>
      </div>
    </div>
  );
}
