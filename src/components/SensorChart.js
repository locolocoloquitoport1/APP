import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  CategoryScale
} from "chart.js";

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Legend, Tooltip, CategoryScale);

export default function SensorChart({ data }) {
  const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString());
  const pH = data.map(d => d.pH);
  const temp = data.map(d => d.temperature);
  const cond = data.map(d => d.conductivity);
  const oxygen = data.map(d => d.oxygen);
  const turb = data.map(d => d.turbidity);

  const datasets = [
    { label: "pH", data: pH, tension: 0.3, yAxisID: "y1", pointRadius: 1 },
    { label: "Temp (°C)", data: temp, tension: 0.3, yAxisID: "y2", pointRadius: 1 },
    { label: "Cond (mS/cm)", data: cond, tension: 0.3, yAxisID: "y3", pointRadius: 1 },
    { label: "O₂ (mg/L)", data: oxygen, tension: 0.3, yAxisID: "y4", pointRadius: 1 },
    { label: "Turbidez (NTU)", data: turb, tension: 0.3, yAxisID: "y5", pointRadius: 1 }
  ];

  const chartData = {
    labels,
    datasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } },
    scales: {
      x: { ticks: { color: "#cbd5e1" } },
      y1: { position: "left", title: { display: true, text: "pH" } },
      y2: { position: "right", title: { display: true, text: "Temp" }, grid: { drawOnChartArea: false } },
      y3: { position: "right", title: { display: true, text: "Conductividad" }, display: false },
      y4: { position: "right", title: { display: true, text: "Oxígeno" }, display: false },
      y5: { position: "right", title: { display: true, text: "Turbidez" }, display: false }
    }
  };

  return <div style={{height:360}}><Line data={chartData} options={options} /></div>;
}
