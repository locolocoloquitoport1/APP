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
  const smallChart = (
    <ResponsiveContainer width="100%" height={180}>
      <ScatterChart margin={{ top: 10, right: 16, bottom: 26, left: 12 }}>
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
          domain={["dataMin", "dataMax"]}
          allowDecimals={false}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={unidad}
          label={{
            value: unidad || "",
            angle: -90,
            position: "insideLeft",
            offset: 8,
          }}
          tick={{ fontSize: 12 }}
        />

        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const punto = payload[0].payload;
              const lectura = punto.x;
              const valor = punto.y;

              return (
                <div
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.75)",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "13px",
                    lineHeight: "1.5",
                  }}
                >
                  <div>
                    <strong>No. Lectura:</strong> {lectura}
                  </div>
                  <div>
                    <strong>{title}:</strong> {valor} {unidad}
                  </div>
                </div>
              );
            }
            return null;
          }}
          cursor={{ strokeDasharray: "3 3" }}
        />

        <Scatter
          data={data.map((p, i) => ({ ...p, key: `${title}-${i}` }))}
          fill={color}
          shape="circle"
          r={4}
          isAnimationActive={false}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );

  return (
    <div className="variable-card">
      <h3 className="variable-title">{title}</h3>
      {smallChart}
    </div>
  );
}