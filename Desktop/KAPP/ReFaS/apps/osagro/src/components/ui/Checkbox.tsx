import React from "react";

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const Checkbox = ({ label, checked, onChange }: CheckboxProps) => {
  return (
    <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginRight: 8 }} />
      <span>{label}</span>
    </label>
  );
};

export default Checkbox;
