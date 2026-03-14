import type { FieldPlot } from "../api/fieldsApi";
import type { Bed } from "../api/bedsApi";
import { getFieldTypeLabel } from "../constants/fieldTypeColors";
import styles from "./FieldTypeFilter.module.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  fields: FieldPlot[];
  bedCount: number;
};

export function FieldTypeFilter({ value, onChange, fields, bedCount }: Props) {
  // Calculate counts per field type
  const fieldCounts: Record<string, number> = {};
  fields.forEach((field) => {
    const key = field.crop_type || "none";
    fieldCounts[key] = (fieldCounts[key] || 0) + 1;
  });

  const allFieldCount = fields.length;

  const options = [
    { label: "Alle", value: "All", count: allFieldCount + bedCount },
    { label: "Teelt", value: "teelt", count: fieldCounts.teelt || 0 },
    { label: "Industrie", value: "industrie", count: fieldCounts.industrie || 0 },
    { label: "Weide", value: "weide", count: fieldCounts.weide || 0 },
    { label: "Kas", value: "kas", count: fieldCounts.kas || 0 },
    { label: "Boomgaard", value: "boomgaard", count: fieldCounts.boomgaard || 0 },
    { label: "Bedden", value: "Bedden", count: bedCount },
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={styles.filter}
      aria-label="Filter percelen op type"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label} ({opt.count})
        </option>
      ))}
    </select>
  );
}
