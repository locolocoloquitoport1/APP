import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function VariableCard({ title, color, data, unidad }) {
  return (
    <div className="variable-card">
      <h3 className="variable-title">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="Lectura"
            label={{
              value: "No. Lectura",
              position: "insideBottom",
              offset: -5,
            }}
            tick={{ fontSize: 12 }}
            domain={["auto", "auto"]}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={unidad}
            label={{
              value: unidad || "",
              angle: -90,
              position: "insideLeft",
              offset: 10,
            }}
            tick={{ fontSize: 12 }}
            domain={["auto", "auto"]}
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill={color} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
