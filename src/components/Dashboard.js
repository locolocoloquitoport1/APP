import React, { useState, useEffect, useMemo, useRef } from "react";
import BuoyStatus from "./BuoyStatus";
import BuoySelector from "./BuoySelector";
import BuoyMap from "./BuoyMap";
import VariableCard from "./VariableCard";

export default function Dashboard() {
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

  // === GENERADOR DE DATOS FÍSICAMENTE COHERENTES CON ANOMALÍAS ===
  const generarLecturaFisica = (variable, buoyId) => {
    const probAnomalia = 0.04; // 4% de probabilidad global de anomalía
    const esAnomalia =
      Math.random() < (variable.includes("Turbidez") ? 0.08 : probAnomalia); // mayor probabilidad en turbidez

    switch (variable) {
      case "pH": {
        if (esAnomalia) {
          // fuera de rango
          return +(6 + Math.random() * 4).toFixed(2);
        }
        return +(7.8 + (Math.random() - 0.5) * 0.6).toFixed(2);
      }

      case "Temperatura (°C)": {
        if (esAnomalia) {
          // demasiado baja o alta
          return +(Math.random() < 0.5
            ? 20 + Math.random() * 5
            : 35 + Math.random() * 8
          ).toFixed(2);
        }
        return +(30.2 + (Math.random() - 0.5) * 0.8).toFixed(2);
      }

      case "Conductividad (µS/cm)": {
        const alta = [1, 6, 7].includes(buoyId);
        const baseMin = alta ? 18000 : 7000;
        const baseMax = alta ? 30000 : 22000;

        if (esAnomalia) {
          // valor fuera de rango (mucho menor o mayor)
          return +(Math.random() < 0.5
            ? 2000 + Math.random() * 3000
            : 30000 + Math.random() * 10000
          ).toFixed(0);
        }

        return +(baseMin + Math.random() * (baseMax - baseMin)).toFixed(0);
      }

      case "Oxígeno Disuelto (mg/L)": {
        if (esAnomalia) {
          // valores extremos
          return +(Math.random() < 0.5
            ? 1 + Math.random() * 1.5
            : 7 + Math.random() * 2
          ).toFixed(2);
        }
        const temp = 30.2 + (Math.random() - 0.5) * 0.8;
        const oxi = 6.3 - 0.07 * (temp - 29) + (Math.random() - 0.5) * 0.3;
        return +Math.max(3.5, Math.min(6.5, oxi)).toFixed(2);
      }

      case "Turbidez (NTU)": {
        if (esAnomalia) {
          // anomalías más comunes: valores extremos
          let val = Math.random() < 0.5
            ? 0 + Math.random() * 5 // turbidez anómalamente baja
            : 250 + Math.random() * 100; // extremadamente alta
          return +Math.min(val, 350).toFixed(1);
        }
        let val = 40 + Math.random() * 60;
        if (Math.random() < 0.1) val += Math.random() * 100; // picos naturales
        return +Math.min(val, 250).toFixed(1);
      }

      default:
        return +(Math.random() * 10).toFixed(2);
    }
  };

  // === CREAR CONJUNTO INICIAL DE VARIABLES ===
  const crearVariables = (buoyId) => [
    {
      title: "pH",
      unidad: "pH",
      color: "#38bdf8",
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i + 1,
        y: generarLecturaFisica("pH", buoyId),
      })),
    },
    {
      title: "Temperatura (°C)",
      unidad: "°C",
      color: "#fb923c",
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i + 1,
        y: generarLecturaFisica("Temperatura (°C)", buoyId),
      })),
    },
    {
      title: "Conductividad (µS/cm)",
      unidad: "µS/cm",
      color: "#a855f7",
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i + 1,
        y: generarLecturaFisica("Conductividad (µS/cm)", buoyId),
      })),
    },
    {
      title: "Oxígeno Disuelto (mg/L)",
      unidad: "mg/L",
      color: "#22c55e",
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i + 1,
        y: generarLecturaFisica("Oxígeno Disuelto (mg/L)", buoyId),
      })),
    },
    {
      title: "Turbidez (NTU)",
      unidad: "NTU",
      color: "#ef4444",
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i + 1,
        y: generarLecturaFisica("Turbidez (NTU)", buoyId),
      })),
    },
  ];

  // === INICIALIZACIÓN POR BOYA ===
  useEffect(() => {
    setVariablesPorBoya((prev) => {
      if (prev[selectedBuoy]) return prev;
      return { ...prev, [selectedBuoy]: crearVariables(selectedBuoy) };
    });
  }, [selectedBuoy]);

  // === ACTUALIZACIÓN CADA 5 SEGUNDOS ===
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setVariablesPorBoya((prev) => {
        const copia = { ...prev };
        const vars = copia[selectedBuoy];
        if (!vars) return prev;

        copia[selectedBuoy] = vars.map((v) => {
          const nextX = v.data.length + 1;
          const newY = generarLecturaFisica(v.title, selectedBuoy);
          const nuevosDatos = [...v.data, { x: nextX, y: newY }];
          if (nuevosDatos.length > 50) nuevosDatos.shift();
          return { ...v, data: nuevosDatos };
        });
        return copia;
      });
    }, 5000);

    return () => clearInterval(intervalRef.current);
  }, [selectedBuoy]);

  // === PROMEDIOS DINÁMICOS ===
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
