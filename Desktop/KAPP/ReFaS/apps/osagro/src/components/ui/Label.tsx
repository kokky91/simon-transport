import React from "react";

interface LabelProps {
  children: React.ReactNode;
  required?: boolean;
}

const Label = ({ children, required }: LabelProps) => {
  return (
    <label style={{ fontWeight: 600, marginBottom: 4 }}>
      {children}
      {required && <span style={{ color: "red", marginLeft: 4 }}>*</span>}
    </label>
  );
};

export default Label;
