import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  CategoryScale,
} from "chart.js";
import ChartModal from "./ChartModal";

ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  CategoryScale
);

export default function SensorChart({ data }) {
  const [isOpen, setIsOpen] = useState(false);

  const labels = data.map((d) =>
    d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : ""
  );
  const pH = data.map((d) => d.pH);
  const temp = data.map((d) => d.temperature);
  const cond = data.map((d) => d.conductivity);
  const oxygen = data.map((d) => d.oxygen);
  const turb = data.map((d) => d.turbidity);

  const datasets = [
    { label: "pH", data: pH, tension: 0.3, yAxisID: "y1", pointRadius: 1 },
    { label: "Temp (°C)", data: temp, tension: 0.3, yAxisID: "y2", pointRadius: 1 },
    { label: "Cond (mS/cm)", data: cond, tension: 0.3, yAxisID: "y3", pointRadius: 1 },
    { label: "O₂ (mg/L)", data: oxygen, tension: 0.3, yAxisID: "y4", pointRadius: 1 },
    { label: "Turbidez (NTU)", data: turb, tension: 0.3, yAxisID: "y5", pointRadius: 1 },
  ];

  const chartData = {
    labels,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } },
    scales: {
      x: { ticks: { color: "#cbd5e1" } },
      y1: { position: "left", title: { display: true, text: "pH" } },
      y2: {
        position: "right",
        title: { display: true, text: "Temp" },
        grid: { drawOnChartArea: false },
      },
      y3: { position: "right", title: { display: true, text: "Conductividad" }, display: false },
      y4: { position: "right", title: { display: true, text: "Oxígeno" }, display: false },
      y5: { position: "right", title: { display: true, text: "Turbidez" }, display: false },
    },
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      {/* vista previa clickeable — tamaño contenido para evitar scroll extra */}
      <div
        className="sensor-chart-preview"
        onClick={() => setIsOpen(true)}
        role="button"
        aria-label="Expandir gráfica"
        title="Clic para ampliar"
      >
        <div style={{ height: "min(340px, 46vh)", cursor: "zoom-in" }}>
          <Line data={chartData} options={options} />
        </div>
      </div>

      {isOpen && (
        <ChartModal onClose={() => setIsOpen(false)} title="Gráfica de Sensores">
          <div style={{ width: "100%", height: "calc(100vh - 120px)", maxWidth: 1100 }}>
            <Line
              data={chartData}
              options={{
                ...options,
                maintainAspectRatio: false,
              }}
            />
          </div>
        </ChartModal>
      )}
    </>
  );
}