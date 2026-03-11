import React from "react";

interface TogglePillsProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const TogglePills = ({ options, selected, onChange }: TogglePillsProps) => {
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          style={{
            padding: "6px 16px",
            borderRadius: 16,
            fontWeight: 500,
            background: selected.includes(opt.value) ? "#2d5016" : "#eee",
            color: selected.includes(opt.value) ? "#fff" : "#333",
            border: "none",
            cursor: "pointer"
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default TogglePills;
