import React, { useState, useEffect, useMemo } from "react";
import BuoyStatus from "./BuoyStatus";
import BuoySelector from "./BuoySelector";
import BuoyMap from "./BuoyMap";
import VariableCard from "./VariableCard";

export default function Dashboard() {
  // === Definición de boyas con coordenadas ===
  const buoyPositions = {
    1: { name: "Boya 1", lat: 11.04083, lng: -74.86389 },
    2: { name: "Boya 2", lat: 11.03556, lng: -74.85389 },
    3: { name: "Boya 3", lat: 11.045, lng: -74.84778 },
    4: { name: "Boya 4", lat: 11.0375, lng: -74.83944 },
    5: { name: "Boya 5", lat: 11.04583, lng: -74.83778 },
    6: { name: "Boya 6", lat: 11.05472, lng: -74.84444 },
    7: { name: "Boya 7", lat: 11.04861, lng: -74.85472 },
  };

  // === Inicializa mostrando Boya 3 ===
  const [selectedBuoy, setSelectedBuoy] = useState(3);
  const coords = buoyPositions[selectedBuoy];
  const [variables, setVariables] = useState([]);

  // === Generador de datos aleatorios con posible anomalía ===
  const generarDatos = (min, max, n = 50, anomalyChance = 0.05) =>
    Array.from({ length: n }, (_, i) => {
      let val = Math.random() * (max - min) + min;
      if (Math.random() < anomalyChance) {
        const factor = Math.random() < 0.5 ? 0.5 : 1.5;
        val = val * factor;
      }
      return { x: i + 1, y: Number(val.toFixed(2)) };
    });

  // === Crear conjunto de variables con datos ===
  const crearVariables = () => [
    {
      title: "pH",
      color: "#38bdf8",
      stats: { Promedio: "En rango", Mínimo: 7, Máximo: 9, Lecturas: 50 },
      data: generarDatos(7, 9),
    },
    {
      title: "Temperatura (°C)",
      color: "#fb923c",
      stats: { Promedio: "29 – 31.5", Mínimo: 25, Máximo: "<40", Lecturas: 50 },
      data: generarDatos(25, 40),
    },
    {
      title: "Conductividad (µS/cm)",
      color: "#a855f7",
      stats: {
        Promedio: "2034 - 24730",
        Mínimo: 5000,
        Máximo: 30000,
        Lecturas: 50,
      },
      data: generarDatos(5000, 30000),
    },
    {
      title: "Oxígeno Disuelto (mg/L)",
      color: "#22c55e",
      stats: { Promedio: "3.98 - 6.01", Mínimo: "<3", Lecturas: 50 },
      data: generarDatos(3, 6),
    },
    {
      title: "Turbidez (NTU)",
      color: "#ef4444",
      stats: { Promedio: "6.9 – 67.8", Máximo: 2, Lecturas: 50 },
      data: generarDatos(6.9, 67.8),
    },
  ];

  // === Inicialización y actualización periódica ===
  useEffect(() => {
    setVariables(crearVariables());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setVariables(crearVariables());
    }, 60000); // 1 minuto
    return () => clearInterval(interval);
  }, [selectedBuoy]);

  // === Cálculo de promedios dinámicos ===
  const promedios = useMemo(() => {
    const findAvg = (title) => {
      const variable = variables.find((v) => v.title.includes(title));
      if (!variable || variable.data.length === 0) return "—";
      const avg =
        variable.data.reduce((sum, p) => sum + p.y, 0) / variable.data.length;
      return avg.toFixed(2);
    };
    return {
      ph: findAvg("pH"),
      temp: findAvg("Temperatura"),
      oxi: findAvg("Oxígeno"),
    };
  }, [variables]);

  return (
    <div className="dashboard-container">
      {/* Panel superior dinámico */}
      <BuoyStatus
        buoyId={selectedBuoy}
        buoyName={coords.name}
        coords={coords}
        ph={promedios.ph}
        temperatura={`${promedios.temp} °C`}
        oxigeno={`${promedios.oxi} mg/L`}
      />

      {/* Selector de boya */}
      <BuoySelector selected={selectedBuoy} onChange={setSelectedBuoy} />

      {/* Mapa */}
      <BuoyMap selectedBuoy={selectedBuoy} />

      {/* Panel de variables */}
      <div className="variable-row">
        {variables.map((v, idx) => (
          <VariableCard key={idx} {...v} />
        ))}
      </div>
    </div>
  );
}
