import React from "react";

export default function BuoySelector({ selected, onChange }) {
  return (
    <div className="buoy-selector">
      <label htmlFor="buoy">Seleccionar Boya:</label>
      <select
        id="buoy"
        value={selected}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <option key={n} value={n}>
            Boya {n}
          </option>
        ))}
      </select>
    </div>
  );
}
