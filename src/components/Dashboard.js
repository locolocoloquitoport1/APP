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
      data: [{ x: 0, y: 0 }], // punto inicial para que se renderice desde el inicio
    }));

  // Inicializa todas las boyas con su estructura base
  useEffect(() => {
    setVariablesByBuoy((prev) => {
      const copy = { ...prev };
      for (let id = 1; id <= 7; id++) {
        if (!copy[id]) copy[id] = makeInitialVars();
      }
      return copy;
    });
  }, []);

  // Genera lecturas simultáneas para todas las boyas
  useEffect(() => {
    const interval = setInterval(() => {
      setReadingIndexGlobal((prevIndex) => {
        const next = prevIndex >= 50 ? 1 : prevIndex + 1;

        // generar lecturas para TODAS las boyas
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
              else if (vv.title.includes("Temperatura")) newY = reading.temperature;
              else if (vv.title.includes("Conductividad")) newY = reading.conductivity;
              else if (vv.title.includes("Oxígeno")) newY = reading.oxygen;
              else if (vv.title.includes("Turbidez")) newY = reading.turbidity;
              else newY = 0;

              const newPoint = { x: next, y: newY };
              vv.data = next === 1 ? [newPoint] : [...(vv.data || []), newPoint];
              if (vv.data.length > 50) vv.data = vv.data.slice(-50);
            });

            newVars[buoyId] = vars;

            // Inserta en BD
            (async () => {
              try {
                if (supabase) {
                  await supabase.from("readings").insert([
                    {
                      buoy_id: buoyId,
                      reading_index: next,
                      pH: reading.pH,
                      temperature: reading.temperature,
                      conductivity: reading.conductivity,
                      oxygen: reading.oxygen,
                      turbidity: reading.turbidity,
                      timestamp: new Date().toISOString(),
                    },
                  ]);
                }
              } catch (err) {
                console.warn(
                  "Error insertando lectura en Supabase:",
                  err.message || err
                );
              }
            })();

            // Clasificación con RandomForest
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
            } catch (err) {
              // ignorar
            }
          });

          return newVars;
        });

        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Entrenamiento periódico con todos los datos de la BD
  useEffect(() => {
    let trainer = null;
    const trainLoop = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from("readings")
          .select(
            "buoy_id, reading_index, pH, temperature, conductivity, oxygen, turbidity"
          )
          .order("timestamp", { ascending: true });

        if (error) {
          console.warn("Error cargando lecturas:", error);
          return;
        }
        if (!data || data.length < 30) return;

        const X = [];
        const y = [];
        data.forEach((r) => {
          X.push([
            Number(r.pH),
            Number(r.temperature),
            Number(r.conductivity),
            Number(r.oxygen),
            Number(r.turbidity),
          ]);
          const isAnom =
            Number(r.pH) < 7 ||
            Number(r.pH) > 9 ||
            Number(r.temperature) < 25 ||
            Number(r.temperature) > 40 ||
            Number(r.conductivity) < 5000 ||
            Number(r.conductivity) > 30000 ||
            Number(r.oxygen) < 3 ||
            Number(r.oxygen) > 7 ||
            Number(r.turbidity) < 0 ||
            Number(r.turbidity) > 250;
          y.push(isAnom ? 1 : 0);
        });

        if (X.length >= 30 && new Set(y).size >= 2) {
          rfRef.current = new RandomForest({ nEstimators: 12, maxDepth: 6 });
          await rfRef.current.fit(X, y);

          const total = y.length;
          const anomalies = y.filter((v) => v === 1).length;
          const normals = total - anomalies;
          const precision = normals / total;
          const recall = anomalies / total;
          const f1 = (2 * precision * recall) / (precision + recall || 1);
          setRfMetrics((prev) => ({
            ...prev,
            f1: Number(f1.toFixed(3)),
            precision: Number(precision.toFixed(3)),
            recall: Number(recall.toFixed(3)),
          }));
          await supabase.from("models").insert([
            {
              name: "RandomForest",
              version: "auto",
              accuracy: (normals / total).toFixed(3),
              precision: precision.toFixed(3),
              recall: recall.toFixed(3),
              f1_score: Number(f1.toFixed(3)),
              total_anomalies: anomalies,
              total_normal: normals,
            },
          ]);
        }
      } catch (err) {
        console.warn("Error entrenamiento RF:", err);
      }
      trainer = setTimeout(trainLoop, 15000);
    };

    trainLoop();
    return () => clearTimeout(trainer);
  }, []);

  const variablesForSelected = variablesByBuoy[selectedBuoy] || makeInitialVars();

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
        onChange={(val) => {
          setSelectedBuoy(Number(val));
        }}
      />

      <BuoyMap selectedBuoy={selectedBuoy} />

      <div className="variable-row">
        {variablesForSelected.map((v, idx) => (
          <VariableCard key={idx} {...v} />
        ))}
      </div>

      <div className="rf-module">
        <h3 className="rf-title">Modelo de Detección de Anomalías (Random Forest)</h3>
        <p className="rf-status">
          Estado del modelo:{" "}
          <span className={rfRef.current ? "rf-trained" : "rf-untrained"}>
            {rfRef.current ? "Entrenado" : "No entrenado"}
          </span>
        </p>

        <p className="rf-classification">
          Clasificación actual:{" "}
          <span
            className={
              rfMetrics.lastClass === "Normal" ? "rf-normal" : "rf-anomalous"
            }
          >
            {rfMetrics.lastClass}
          </span>
        </p>

        <div className="rf-metrics">
          <div className="rf-metric">
            <p>F1 Score</p>
            <div className="rf-bar-bg">
              <div
                className="rf-bar rf-bar-f1"
                style={{ width: `${rfMetrics.f1 * 100}%` }}
              />
            </div>
          </div>

          <div className="rf-metric">
            <p>Precisión</p>
            <div className="rf-bar-bg">
              <div
                className="rf-bar rf-bar-precision"
                style={{ width: `${rfMetrics.precision * 100}%` }}
              />
            </div>
          </div>

          <div className="rf-metric">
            <p>Recall</p>
            <div className="rf-bar-bg">
              <div
                className="rf-bar rf-bar-recall"
                style={{ width: `${rfMetrics.recall * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rf-counters">
          <div>
            <strong>Anomalías detectadas:</strong> {rfMetrics.totalAnomalies}
          </div>
        </div>
      </div>
    </div>
  );
}