import React from "react";

// Indian FMCG-standard food indicator: green dot (veg/vegan) or red dot (non-veg).
// `veg_type`: "veg" | "vegan" | "nonveg" | "na"
export default function VegMark({ type, size = 14 }) {
  if (!type || type === "na") return null;
  const isVeg = type === "veg" || type === "vegan";
  const color = isVeg ? "#16A34A" : "#DC2626";
  return (
    <span
      data-testid={`veg-mark-${type}`}
      className="inline-flex items-center justify-center bg-white"
      title={isVeg ? (type === "vegan" ? "Vegan" : "Vegetarian") : "Non-Vegetarian"}
      style={{
        width: size, height: size, border: `1.5px solid ${color}`, borderRadius: 2, flexShrink: 0,
      }}
    >
      <span style={{ width: size / 2, height: size / 2, background: color, borderRadius: "50%" }} />
    </span>
  );
}
