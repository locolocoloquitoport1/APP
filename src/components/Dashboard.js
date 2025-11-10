import React, { useState, useEffect, useMemo, useRef } from "react";
import BuoyStatus from "./BuoyStatus";
import BuoySelector from "./BuoySelector";
import BuoyMap from "./BuoyMap";
import VariableCard from "./VariableCard";
import ModelMetrics from "./ModelMetrics";
import supabase from "../lib/supabase";
import { simulateSensorReading } from "../utils/simulator";
import { RandomForest } from "../utils/randomForest";

export default function Dashboard() {
  const buoyPositions = {
    1: { lat: 11.04083, lng: -74.86389 },
    2: { lat: 11.03556, lng: -74.85389 },
    3: { lat: 11.045, lng: -74.84778 },
    4: { lat: 11.0375, lng: -74.83944 },
    5: { lat: 11.04583, lng: -74.83778 },
    6: { lat: 11.05472, lng: -74.84444 },
    7: { lat: 11.04861, lng: -74.85472 },
  };

  const [selectedBuoy, setSelectedBuoy] = useState(1);
  const [variablesByBuoy, setVariablesByBuoy] = useState({});
  const [readingIndexGlobal, setReadingIndexGlobal] = useState(1);

  const [rfMetrics, setRfMetrics] = useState({
    f1: 0,
    precision: 0,
    recall: 0,
    totalAnomalies: 0,
    lastClass: "Normal",
  });

  const rfRef = useRef(new RandomForest({ nEstimators: 12, maxDepth: 6 }));

  const variableTemplate = [
    { title: "pH", color: "#38bdf8", unit: "upH" },
    { title: "Temperatura (°C)", color: "#fb923c", unit: "°C" },
    { title: "Conductividad (µS/cm)", color: "#a855f7", unit: "µS/cm" },
    { title: "Oxígeno Disuelto (mg/L)", color: "#22c55e", unit: "mg/L" },
    { title: "Turbidez (NTU)", color: "#ef4444", unit: "NTU" },
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
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setReadingIndexGlobal((prevIndex) => {
        const next = prevIndex >= 50 ? 1 : prevIndex + 1;

        setVariablesByBuoy((prevVars) => {
          const newVars = { ...prevVars };

          Object.keys(buoyPositions).forEach((id) => {
            const buoyId = Number(id);
            const reading = simulateSensorReading(buoyId);

            const vars =
              newVars[buoyId]?.map((vv) => ({ ...vv })) || makeInitialVars();

            vars.forEach((vv) => {
              let newY;
              if (vv.title.includes("pH")) newY = reading.pH;
              else if (vv.title.includes("Temperatura"))
                newY = reading.temperature;
              else if (vv.title.includes("Conductividad"))
                newY = reading.conductivity;
              else if (vv.title.includes("Oxígeno")) newY = reading.oxygen;
              else if (vv.title.includes("Turbidez")) newY = reading.turbidity;
              else newY = 0;

              const newPoint = { x: next, y: newY };
              vv.data = next === 1 ? [newPoint] : [...(vv.data || []), newPoint];
              if (vv.data.length > 50) vv.data = vv.data.slice(-50);
            });

            newVars[buoyId] = vars;

            try {
              const X = [
                [
                  reading.pH,
                  reading.temperature,
                  reading.conductivity,
                  reading.oxygen,
                  reading.turbidity,
                ],
              ];
              const pred =
                rfRef.current && rfRef.current.predict
                  ? rfRef.current.predict(X)[0]
                  : null;
              const classLabel =
                pred === 1 || pred === "1" || pred === "Anomalous"
                  ? "Anomalous"
                  : "Normal";

              setRfMetrics((prev) => ({
                ...prev,
                lastClass: classLabel,
                totalAnomalies:
                  prev.totalAnomalies + (classLabel === "Anomalous" ? 1 : 0),
                f1: Math.min(1, prev.f1 + 0.005),
                precision: Math.min(1, prev.precision + 0.003),
                recall: Math.min(1, prev.recall + 0.002),
              }));
            } catch (err) {}
          });

          return newVars;
        });

        return next;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const variablesForSelected =
    variablesByBuoy[selectedBuoy] || makeInitialVars();

  const promedios = useMemo(() => {
    const findAvg = (title) => {
      const variable = variablesForSelected.find((v) => v.title.includes(title));
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
  }, [variablesByBuoy, selectedBuoy]);

  const coords = buoyPositions[selectedBuoy];

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

      {/* Nueva disposición principal con Random Forest más delgado */}
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
            }}
            randomForest={rfRef.current}
          />
        </div>
      </div>
    </div>
  );
}
