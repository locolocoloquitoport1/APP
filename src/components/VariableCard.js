import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function VariableCard({ title, color, stats, data }) {
  return (
    <div className="card variable-card">
      <h3 className="variable-title">{title}</h3>

      <table className="variable-table">
        <tbody>
          {Object.entries(stats).map(([key, value]) => (
            <tr key={key}>
              <td className="label">{key.charAt(0).toUpperCase() + key.slice(1)}:</td>
              <td className="value">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={150}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <XAxis dataKey="x" type="number" tick={false} />
            <YAxis dataKey="y" type="number" tick={{ fill: "#475569" }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill={color} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
