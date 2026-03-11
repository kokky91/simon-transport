import React from "react";

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => {
  return <select {...props} style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc", marginBottom: 12, width: "100%" }} />;
};

export default Select;
