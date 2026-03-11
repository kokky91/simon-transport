import React from "react";

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
  return <input {...props} style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc", marginBottom: 12, width: "100%" }} />;
};

export default Input;
