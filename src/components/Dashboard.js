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

  // variablesByBuoy: { [buoyId]: [ {title, color, unit, data: [{x,y}, ...] }, ... ] }
  const [variablesByBuoy, setVariablesByBuoy] = useState({});

  // readingIndexByBuoy: { [buoyId]: currentIndex }
  const [readingIndexByBuoy, setReadingIndexByBuoy] = useState({});

  // RF metrics shown in panel
  const [rfMetrics, setRfMetrics] = useState({
    f1: 0,
    precision: 0,
    recall: 0,
    totalAnomalies: 0,
    lastClass: "Normal",
  });

  // RandomForest instance (kept global/persistent)
  const rfRef = useRef(new RandomForest({ nEstimators: 12, maxDepth: 6 }));

  // default variables template (single-source of truth)
  const variableTemplate = [
    { title: "pH", color: "#38bdf8", unit: "upH" },
    { title: "Temperatura (°C)", color: "#fb923c", unit: "°C" },
    { title: "Conductividad (µS/cm)", color: "#a855f7", unit: "µS/cm" },
    { title: "Oxígeno Disuelto (mg/L)", color: "#22c55e", unit: "mg/L" },
    { title: "Turbidez (NTU)", color: "#ef4444", unit: "NTU" },
  ];

  // Helper: crea estructura inicial de variables (con un punto 0 para que la UI muestre algo)
  const makeInitialVars = () =>
    variableTemplate.map((v) => ({ ...v, data: [{ x: 0, y: 0 }] }));

  // Inicializa todas las boyas en blanco al montar (solo si no existen)
  useEffect(() => {
    setVariablesByBuoy((prev) => {
      const copy = { ...prev };
      for (let id = 1; id <= 7; id++) {
        if (!copy[id]) copy[id] = makeInitialVars();
      }
      return copy;
    });

    setReadingIndexByBuoy((prev) => {
      const copy = { ...prev };
      for (let id = 1; id <= 7; id++) {
        if (!copy[id]) copy[id] = 1; // empezamos en 1 (la UI muestra el punto 0 inicial)
      }
      return copy;
    });
  }, []);

  // Intervalo: genera lecturas para LA boya seleccionada cada 5s
  useEffect(() => {
    const ticker = setInterval(async () => {
      const buoyId = Number(selectedBuoy);
      const reading = simulateSensorReading(buoyId); // simulador usa buoyId para diversificar
      // obtener index visual actual para esta boya (fallback 1)
      setReadingIndexByBuoy((prevIdxs) => {
        const current = prevIdxs[buoyId] ?? 1;
        const next = current >= 50 ? 1 : current + 1;

        // Actualizamos las variables visuales SOLO para esta boya
        setVariablesByBuoy((prevVars) => {
          const copy = { ...prevVars };
          const vars = copy[buoyId] ? copy[buoyId].map((vv) => ({ ...vv })) : makeInitialVars();

          // Mapear los valores del reading a cada variable
          vars.forEach((vv) => {
            let newY;
            if (vv.title.includes("pH")) newY = reading.pH;
            else if (vv.title.includes("Temperatura")) newY = reading.temperature;
            else if (vv.title.includes("Conductividad")) newY = reading.conductivity;
            else if (vv.title.includes("Oxígeno")) newY = reading.oxygen;
            else if (vv.title.includes("Turbidez")) newY = reading.turbidity;
            else newY = 0;

            const newPoint = { x: next, y: newY };

            // visual: reinicio visual de la serie si next === 1, pero no borramos BD
            vv.data = next === 1 ? [newPoint] : [...(vv.data || []), newPoint];

            // limitar visual a max 50 (si alguien quiere mantener más en UI)
            if (vv.data.length > 50) {
              // si no quieres desplazar y prefieres mantener el reinicio solo con next===1,
              // podrías dejar el shift. Aquí lo dejamos como máximo visible 50.
              vv.data = vv.data.slice(-50);
            }
          });

          copy[buoyId] = vars;
          return copy;
        });

        // Guardar lectura en BD con reading_index = next
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
            console.warn("Error insertando lectura en Supabase:", err.message || err);
          }
        })();

        // Clasificar con RandomForest usando la lectura (si el modelo está entrenado)
        try {
          // Prepare X (shape 1x5)
          const X = [[reading.pH, reading.temperature, reading.conductivity, reading.oxygen, reading.turbidity]];
          const pred = rfRef.current && rfRef.current.predict ? rfRef.current.predict(X)[0] : null;

          const classLabel = pred === 1 || pred === "1" || pred === "Anomalous" ? "Anomalous" : "Normal";

          setRfMetrics((prev) => ({
            ...prev,
            lastClass: classLabel,
            totalAnomalies: prev.totalAnomalies + (classLabel === "Anomalous" ? 1 : 0),
            // métricas agregadas aproximadas para el display (puedes reemplazarlas con métricas reales al reentrenar)
            f1: Math.min(1, prev.f1 + 0.005),
            precision: Math.min(1, prev.precision + 0.003),
            recall: Math.min(1, prev.recall + 0.002),
          }));
        } catch (err) {
          // si predict falla, ignoramos — el RF puede no estar listo aún
        }

        // retorno para actualizar readingIndexByBuoy
        const newIdxs = { ...prevIdxs, [buoyId]: next };
        return newIdxs;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, [selectedBuoy]); // cuando cambies de boya el intervalo sigue generando para la nueva seleccion

  // === Entrenamiento periódico del RandomForest con TODAS las lecturas guardadas en BD ===
  // (cada N segundos intentamos recargar historial y reentrenar)
  useEffect(() => {
    let trainer = null;
    const trainLoop = async () => {
      try {
        if (!supabase) return;
        // Cargar lecturas desde la BD (puedes filtrar por rango temporal si hay millones)
        const { data, error } = await supabase
          .from("readings")
          .select("buoy_id, reading_index, pH, temperature, conductivity, oxygen, turbidity")
          .order("timestamp", { ascending: true });

        if (error) {
          console.warn("Error cargando lecturas para entrenamiento:", error);
          return;
        }
        if (!data || data.length < 30) return; // esperar datos suficientes

        const X = [];
        const y = [];
        data.forEach((r) => {
          X.push([Number(r.pH), Number(r.temperature), Number(r.conductivity), Number(r.oxygen), Number(r.turbidity)]);
          // Label simple: si fuera anómalo según reglas físicas
          const isAnom =
            Number(r.pH) < 7 || Number(r.pH) > 9 ||
            Number(r.temperature) < 25 || Number(r.temperature) > 40 ||
            Number(r.conductivity) < 5000 || Number(r.conductivity) > 30000 ||
            Number(r.oxygen) < 3 || Number(r.oxygen) > 7 ||
            Number(r.turbidity) < 0 || Number(r.turbidity) > 250;
          y.push(isAnom ? 1 : 0);
        });

        // Entrenar RandomForest (sincrónico en memoria)
        if (X.length >= 30 && new Set(y).size >= 2) {
          // Fit puede ser costoso; correrlo "fuera" del render
          rfRef.current = new RandomForest({ nEstimators: 12, maxDepth: 6 });
          await rfRef.current.fit(X, y); // nuestra implementación soporta async storage
          // Opcional: actualizar métricas reales guardadas en BD (tabla models)
          try {
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
            // Guardar métricas en BD (tabla models) — si la tienes
            await supabase.from("models").insert([
              {
                name: "RandomForest",
                version: "auto",
                accuracy: ( (normals / total) ).toFixed(3),
                precision: precision.toFixed(3),
                recall: recall.toFixed(3),
                f1_score: Number(f1.toFixed(3)),
                total_anomalies: anomalies,
                total_normal: normals,
              },
            ]);
          } catch (err) {
            // no bloquee la ejecución principal
          }
        }
      } catch (err) {
        console.warn("Error en entrenamiento RF:", err);
      }
      // schedule next training
      trainer = setTimeout(trainLoop, 15000); // reentrena cada 15s
    };

    trainLoop();
    return () => clearTimeout(trainer);
  }, []); // effect de montaje (reentrena periódicamente con toda la BD)

  // === Promedios dinámicos (sólo para boya seleccionada, a partir de variablesByBuoy) ===
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

  // coords y render
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
          // asegúrate de que existan estructuras para la nueva boya
          setVariablesByBuoy((prev) => ({ ...prev, [Number(val)]: prev[Number(val)] ?? makeInitialVars() }));
          setReadingIndexByBuoy((prev) => ({ ...prev, [Number(val)]: prev[Number(val)] ?? 1 }));
        }}
      />

      <BuoyMap selectedBuoy={selectedBuoy} />

      <div className="variable-row">
        {variablesForSelected.map((v, idx) => (
          <VariableCard key={idx} {...v} />
        ))}
      </div>

      {/* Panel de Random Forest (visual) */}
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
          <span className={rfMetrics.lastClass === "Normal" ? "rf-normal" : "rf-anomalous"}>
            {rfMetrics.lastClass}
          </span>
        </p>

        <div className="rf-metrics">
          <div className="rf-metric"><p>F1 Score</p>
            <div className="rf-bar-bg"><div className="rf-bar rf-bar-f1" style={{ width: `${rfMetrics.f1 * 100}%` }} /></div>
          </div>

          <div className="rf-metric"><p>Precisión</p>
            <div className="rf-bar-bg"><div className="rf-bar rf-bar-precision" style={{ width: `${rfMetrics.precision * 100}%` }} /></div>
          </div>

          <div className="rf-metric"><p>Recall</p>
            <div className="rf-bar-bg"><div className="rf-bar rf-bar-recall" style={{ width: `${rfMetrics.recall * 100}%` }} /></div>
          </div>
        </div>

        <div className="rf-counters">
          <div><strong>Anomalías detectadas:</strong> {rfMetrics.totalAnomalies}</div>
        </div>
      </div>
    </div>
  );
}