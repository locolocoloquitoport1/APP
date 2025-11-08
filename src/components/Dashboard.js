import React, { useState, useEffect, useMemo, useRef } from "react";
import BuoyStatus from "./BuoyStatus";
import BuoySelector from "./BuoySelector";
import BuoyMap from "./BuoyMap";
import VariableCard from "./VariableCard";

export default function Dashboard() {
  // === Coordenadas de boyas ===
  const buoyPositions = {
    1: { name: "Boya 1", lat: 11.04083, lng: -74.86389 },
    2: { name: "Boya 2", lat: 11.03556, lng: -74.85389 },
    3: { name: "Boya 3", lat: 11.045, lng: -74.84778 },
    4: { name: "Boya 4", lat: 11.0375, lng: -74.83944 },
    5: { name: "Boya 5", lat: 11.04583, lng: -74.83778 },
    6: { name: "Boya 6", lat: 11.05472, lng: -74.84444 },
    7: { name: "Boya 7", lat: 11.04861, lng: -74.85472 },
  };

  const [selectedBuoy, setSelectedBuoy] = useState(3);
  const [variablesPorBoya, setVariablesPorBoya] = useState({});
  const intervalRef = useRef(null);
  const coords = buoyPositions[selectedBuoy];
  const variables = variablesPorBoya[selectedBuoy] || [];

  // === Generar una lectura aleatoria ===
  const generarLectura = (min, max, variacion = 0.05) => {
    const base = Math.random() * (max - min) + min;
    const factor = 1 + (Math.random() * 2 - 1) * variacion;
    return Number((base * factor).toFixed(2));
  };

  // === Crear conjunto inicial de variables ===
  const crearVariables = () => [
    {
      title: "pH",
      unidad: "",
      color: "#38bdf8",
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i + 1,
        y: generarLectura(7, 9),
      })),
    },
    {
      title: "Temperatura (°C)",
      unidad: "°C",
      color: "#fb923c",
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i + 1,
        y: generarLectura(25, 40),
      })),
    },
    {
      title: "Conductividad (µS/cm)",
      unidad: "µS/cm",
      color: "#a855f7",
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i + 1,
        y: generarLectura(5000, 30000),
      })),
    },
    {
      title: "Oxígeno Disuelto (mg/L)",
      unidad: "mg/L",
      color: "#22c55e",
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i + 1,
        y: generarLectura(3, 6),
      })),
    },
    {
      title: "Turbidez (NTU)",
      unidad: "NTU",
      color: "#ef4444",
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i + 1,
        y: generarLectura(6.9, 67.8),
      })),
    },
  ];

  // === Inicialización por boya ===
  useEffect(() => {
    setVariablesPorBoya((prev) => {
      if (prev[selectedBuoy]) return prev;
      return { ...prev, [selectedBuoy]: crearVariables() };
    });
  }, [selectedBuoy]);

  // === Actualización en tiempo real (cada 5 s) ===
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setVariablesPorBoya((prev) => {
        const copia = { ...prev };
        const vars = copia[selectedBuoy];
        if (!vars) return prev;

        copia[selectedBuoy] = vars.map((v) => {
          const nextX = v.data.length + 1;
          const newY = (() => {
            switch (v.title) {
              case "pH": return generarLectura(7, 9);
              case "Temperatura (°C)": return generarLectura(25, 40);
              case "Conductividad (µS/cm)": return generarLectura(5000, 30000);
              case "Oxígeno Disuelto (mg/L)": return generarLectura(3, 6);
              case "Turbidez (NTU)": return generarLectura(6.9, 67.8);
              default: return generarLectura(0, 1);
            }
          })();
          const nuevosDatos = [...v.data, { x: nextX, y: newY }];
          // mantener máximo 50 puntos
          if (nuevosDatos.length > 50) nuevosDatos.shift();
          return { ...v, data: nuevosDatos };
        });
        return copia;
      });
    }, 5000);

    return () => clearInterval(intervalRef.current);
  }, [selectedBuoy]);

  // === Promedios dinámicos ===
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
      <BuoyStatus
        buoyId={selectedBuoy}
        buoyName={coords.name}
        coords={coords}
        ph={promedios.ph}
        temperatura={`${promedios.temp} °C`}
        oxigeno={`${promedios.oxi} mg/L`}
      />

      <BuoySelector selected={selectedBuoy} onChange={setSelectedBuoy} />
      <BuoyMap selectedBuoy={selectedBuoy} />

      <div className="variable-row">
        {variables.map((v, idx) => (
          <VariableCard key={idx} {...v} />
        ))}
      </div>
    </div>
  );
}
