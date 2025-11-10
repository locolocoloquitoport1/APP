/* eslint-disable */ // desactiva ESLint en este archivo para evitar errores por reglas no encontradas
import React, { useState, useEffect, useMemo } from "react";
import BuoyStatus from "./BuoyStatus";
import BuoySelector from "./BuoySelector";
import BuoyMap from "./BuoyMap";
import VariableCard from "./VariableCard";
import ModelMetrics from "./ModelMetrics";
import { simulateSensorReading } from "../utils/simulator";

/**
 * Dashboard
 *
 * Recibe desde App:
 * - data (stream)
 * - randomForest (instancia, opcional)
 * - selectedBuoy, setSelectedBuoy (control de selección desde App)
 * - rfMetrics (métricas calculadas en App)
 * - alerts (lista de alertas calculadas en App)
 * - formatDisplayValue (función para formatear valores en la UI)
 *
 * Mantengo la simulación visual por tarjeta (variablesByBuoy) para mostrar
 * gráficas locales: esa lógica es independiente del RF.
 */

const BUOY_IDS = [1, 2, 3, 4, 5, 6, 7];

export default function Dashboard({
  data = [],
  randomForest = null,
  selectedBuoy = 1,
  setSelectedBuoy = () => {},
  rfMetrics = {},
  alerts = [],
  formatDisplayValue,
}) {
  const buoyPositions = {
    1: { lat: 11.04083, lng: -74.86389 },
    2: { lat: 11.03556, lng: -74.85389 },
    3: { lat: 11.045, lng: -74.84778 },
    4: { lat: 11.0375, lng: -74.83944 },
    5: { lat: 11.04583, lng: -74.83778 },
    6: { lat: 11.05472, lng: -74.84444 },
    7: { lat: 11.04861, lng: -74.85472 },
  };

  const [variablesByBuoy, setVariablesByBuoy] = useState({});
  const [readingIndexGlobal, setReadingIndexGlobal] = useState(1);

  const variableTemplate = [
    { title: "pH", color: "#38bdf8", unidad: "pH" },
    { title: "Temperatura (°C)", color: "#fb923c", unidad: "°C" },
    { title: "Conductividad (S/m)", color: "#a855f7", unidad: "S/m" },
    { title: "Oxígeno Disuelto (mg/L)", color: "#22c55e", unidad: "mg/L" },
    { title: "Turbidez (NTU)", color: "#ef4444", unidad: "NTU" },
  ];

  const makeInitialVars = () =>
    variableTemplate.map((v) => ({
      ...v,
      data: [{ x: 0, y: 0 }],
    }));

  useEffect(() => {
    setVariablesByBuoy((prev) => {
      const copy = { ...prev };
      for (let id = 1; id <= 7; id++) {
        if (!copy[id]) copy[id] = makeInitialVars();
      }
      return copy;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulación visual por tarjeta
  useEffect(() => {
    const interval = setInterval(() => {
      setReadingIndexGlobal((prevIndex) => {
        const next = prevIndex >= 50 ? 1 : prevIndex + 1;

        setVariablesByBuoy((prevVars) => {
          const newVars = { ...prevVars };

          BUOY_IDS.forEach((buoyId) => {
            const reading = simulateSensorReading(buoyId);

            const vars =
              (newVars[buoyId] && newVars[buoyId].map((vv) => ({ ...vv }))) ||
              makeInitialVars();

            vars.forEach((vv) => {
              let newY;
              if (vv.title.includes("pH")) newY = reading.pH;
              else if (vv.title.includes("Temperatura"))
                newY = reading.temperature;
              else if (vv.title.includes("Conductividad"))
                newY = parseFloat((Number(reading.conductivity) * 1e-4).toFixed(4)); // presentación S/m
              else if (vv.title.includes("Oxígeno")) newY = reading.oxygen;
              else if (vv.title.includes("Turbidez")) newY = reading.turbidity;
              else newY = 0;

              const newPoint = { x: next, y: newY };
              vv.data = next === 1 ? [newPoint] : [...(vv.data || []), newPoint];
              if (vv.data.length > 50) vv.data = vv.data.slice(-50);
            });

            newVars[buoyId] = vars;
          });

          return newVars;
        });

        return next;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const variablesForSelected =
    variablesByBuoy[selectedBuoy] || makeInitialVars();

  const promedios = useMemo(() => {
    const findAvg = (title) => {
      const variable = variablesForSelected.find((v) => v.title.includes(title));
      if (!variable || !Array.isArray(variable.data) || variable.data.length === 0)
        return "—";
      const avg =
        variable.data.reduce((sum, p) => sum + (Number(p.y) || 0), 0) /
        variable.data.length;
      return Number.isFinite(avg) ? avg.toFixed(3) : "—";
    };
    return {
      ph: findAvg("pH"),
      temp: findAvg("Temperatura"),
      oxi: findAvg("Oxígeno"),
    };
  }, [variablesByBuoy, selectedBuoy]);

  const coords = buoyPositions[selectedBuoy] || null;

  return (
    <div className="dashboard-container">
      <BuoyStatus
        buoyId={selectedBuoy}
        coords={coords}
        ph={promedios.ph}
        temperatura={`${promedios.temp} °C`}
        oxigeno={`${promedios.oxi} mg/L`}
      />

      <BuoySelector
        selected={selectedBuoy}
        onChange={(val) => setSelectedBuoy(Number(val))}
      />

      <BuoyMap selectedBuoy={selectedBuoy} />

      <div className="dashboard-main-row">
        <div className="dashboard-left">
          <div className="variable-row">
            {variablesForSelected.map((v, idx) => (
              <VariableCard key={idx} {...v} />
            ))}
          </div>
        </div>

        <div className="dashboard-right">
          <ModelMetrics
            metricas={{
              f1: rfMetrics.f1,
              precision: rfMetrics.precision,
              recall: rfMetrics.recall,
              anomalies: rfMetrics.totalAnomalies,
              lastClass: rfMetrics.lastClass,
            }}
            randomForest={randomForest}
            alerts={alerts}
            formatDisplayValue={formatDisplayValue}
          />
        </div>
      </div>
    </div>
  );
}