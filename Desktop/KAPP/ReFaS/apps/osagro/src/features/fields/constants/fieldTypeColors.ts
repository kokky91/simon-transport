export type FieldTypeStyle = {
  bg: string;
  text: string;
};

export const FIELD_TYPE_COLORS: Record<string, FieldTypeStyle> = {
  teelt: {
    bg: "bg-green-900/50 dark:bg-green-900/40",
    text: "text-green-300 dark:text-green-200",
  },
  industrie: {
    bg: "bg-blue-900/50 dark:bg-blue-900/40",
    text: "text-blue-300 dark:text-blue-200",
  },
  weide: {
    bg: "bg-lime-900/50 dark:bg-lime-900/40",
    text: "text-lime-300 dark:text-lime-200",
  },
  kas: {
    bg: "bg-cyan-900/50 dark:bg-cyan-900/40",
    text: "text-cyan-300 dark:text-cyan-200",
  },
  boomgaard: {
    bg: "bg-amber-900/50 dark:bg-amber-900/40",
    text: "text-amber-300 dark:text-amber-200",
  },
  bed: {
    bg: "bg-purple-900/50 dark:bg-purple-900/40",
    text: "text-purple-300 dark:text-purple-200",
  },
  none: {
    bg: "bg-gray-900/50 dark:bg-gray-900/40",
    text: "text-gray-400 dark:text-gray-500",
  },
};

export const FIELD_TYPE_LABELS: Record<string, string> = {
  teelt: "Teelt",
  industrie: "Industrie",
  weide: "Weide",
  kas: "Kas",
  boomgaard: "Boomgaard",
  bed: "Bed",
  none: "— geen —",
};

export function getFieldTypeColor(type: string | undefined): FieldTypeStyle {
  return FIELD_TYPE_COLORS[type || "none"] ?? FIELD_TYPE_COLORS.none;
}

export function getFieldTypeLabel(type: string | undefined): string {
  return FIELD_TYPE_LABELS[type || "none"] ?? "— geen —";
}
