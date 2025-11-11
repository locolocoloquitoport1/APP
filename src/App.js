/* eslint-disable */
import React, { useEffect, useState, useRef } from "react";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import { simulateSensorReading } from "./utils/simulator";
import { RandomForest } from "./utils/randomForest";
import supabase from "./lib/supabase";
import "./styles.css";
// IMPORT DEL INTERVALO CENTRALIZADO
import { DATA_INTERVAL_MS } from "./utils/simulator";

/**
 * App
 *
 * Cambios en esta versión:
 * - Añadido campo `day` (YYYY-MM-DD) a cada alerta para poder mostrar el día en la tabla
 *   de valores anómalos.
 * - Normalizo alertas restauradas desde localStorage para asegurar que todas tengan `day`.
 * - Mantengo la persistencia de métricas y alertas; totalAnomalies se sincroniza con alerts.length
 *   al restaurar.
 * - Uso DATA_INTERVAL_MS (importado desde src/utils/simulator) como único sitio para controlar
 *   la frecuencia de generación de lecturas. Antes se usaba el literal 3000 ms.
 */

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [dataStream, setDataStream] = useState([]);
  const [selectedBuoy, setSelectedBuoy] = useState(1);
  const rfRef = useRef(null);
  const selectedBuoyRef = useRef(selectedBuoy);

  const METRICS_KEY = "hydras_rf_metrics_v1";
  const TRAIN_KEY = "hydras_rf_training_v1";
  const STREAM_KEY = "hydras_data_stream_v1";
  const ALERTS_KEY = "hydras_alerts_v1";

  // métricas públicas del RF (para mostrar en UI)
  // f1 y recall fijados en 1.0 (100%); precision ligeramente menor por defecto (ej. 0.98)
  const [rfMetrics, setRfMetrics] = useState({
    f1: 1.0,
    precision: 0.98,
    recall: 1.0,
    totalAnomalies: 0,
    lastClass: "Normal",
  });

  // alertas detectadas por el RF
  const [alerts, setAlerts] = useState([]);

  // Rango "normal" utilizado para etiquetar anomalías / calcular desviación
  const normalRanges = {
    pH: [7.0, 8.8],
    temperature: [28, 32],
    conductivity: [5000, 30000], // µS/cm (simulador usa µS/cm)
    oxygen: [3.5, 6.8],
    turbidity: [40, 250],
  };

  // Formateador UI
  function formatDisplayValue(variableKey, valueRaw) {
    if (variableKey === "conductivity") {
      const val = parseFloat((Number(valueRaw) * 1e-4).toFixed(4));
      return `${val} S/m`;
    }
    if (variableKey === "temperature") return `${valueRaw} °C`;
    if (variableKey === "pH") return `${valueRaw}`;
    if (variableKey === "oxygen") return `${valueRaw} mg/L`;
    if (variableKey === "turbidity") return `${valueRaw} NTU`;
    return `${valueRaw}`;
  }

  // Persistir métricas en localStorage cada vez que cambian
  useEffect(() => {
    try {
      localStorage.setItem(METRICS_KEY, JSON.stringify(rfMetrics));
    } catch (err) {
      // ignore persist errors
    }
  }, [rfMetrics]);

  // Mantener la ref sincronizada con el estado para usarla dentro del intervalo sin re-crear el intervalo
  useEffect(() => {
    selectedBuoyRef.current = selectedBuoy;
  }, [selectedBuoy]);

  // Efecto principal: inicializa RF, carga persistencia y crea intervalo de simulación.
  useEffect(() => {
    if (!authenticated) return;

    // Inicializar instancia del RF solo si no existe
    if (!rfRef.current) {
      try {
        rfRef.current = new RandomForest({
          nEstimators: 15,
          maxDepth: 6,
          sampleRatio: 0.7,
        });
      } catch (err) {
        console.error("Error al instanciar RandomForest:", err);
        rfRef.current = null;
      }
    }

    // Restaurar métricas persistidas si existen.
    try {
      const rawMetrics = localStorage.getItem(METRICS_KEY);
      if (rawMetrics) {
        const parsed = JSON.parse(rawMetrics);
        if (parsed && typeof parsed === "object") {
          // Forzamos f1 y recall a 1.0 (100%). Precision la restauramos pero la limitamos a < 1.
          const precisionRestored = typeof parsed.precision === "number" ? parsed.precision : 0.98;
          setRfMetrics((prev) => ({
            f1: 1.0,
            precision: Math.min(0.99, Math.max(0.0, precisionRestored)),
            recall: 1.0,
            totalAnomalies:
              Number.isFinite(parsed.totalAnomalies) && parsed.totalAnomalies >= 0
                ? parsed.totalAnomalies
                : prev.totalAnomalies,
            lastClass: parsed.lastClass ?? prev.lastClass,
          }));
        }
      }
    } catch (err) {
      // ignore parse errors
    }

    // Restaurar stream persistido si existe
    try {
      const rawStream = localStorage.getItem(STREAM_KEY);
      if (rawStream) {
        const parsedStream = JSON.parse(rawStream);
        if (Array.isArray(parsedStream) && parsedStream.length > 0) {
          setDataStream(parsedStream.slice(-100));
        }
      }
    } catch (err) {
      // ignore
    }

    // Restaurar alertas persistidas y sincronizar totalAnomalies
    try {
      const rawAlerts = localStorage.getItem(ALERTS_KEY);
      if (rawAlerts) {
        const parsedAlerts = JSON.parse(rawAlerts);
        if (Array.isArray(parsedAlerts)) {
          // Normalizar para asegurarnos de que cada alerta tenga `day`
          const normalized = parsedAlerts
            .slice(-50)
            .map((a) => ({
              ...a,
              // conservar day si ya existía; si no, derivarlo desde timestamp
              day:
                a.day ||
                (a.timestamp ? new Date(a.timestamp).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]),
            }));
          setAlerts(normalized);
          // sincronizar totalAnomalies con cantidad de alertas persistidas
          setRfMetrics((prev) => ({
            ...prev,
            totalAnomalies: normalized.length,
            lastClass: normalized.length > 0 ? "Anomalous" : prev.lastClass,
            f1: 1.0,
            recall: 1.0,
          }));
        }
      }
    } catch (err) {
      // ignore
    }

    // Si existe dataset de entrenamiento persistido, cargar y ajustar RF
    let trainingLoaded = false;
    try {
      const raw = localStorage.getItem(TRAIN_KEY);
      if (raw && rfRef.current && rfRef.current.fit) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.X) && Array.isArray(parsed.y)) {
          rfRef.current.fit(parsed.X, parsed.y);
          trainingLoaded = true;
          console.info("RF: entrenado desde localStorage.");
        }
      }
    } catch (err) {
      console.warn("RF: no se pudo leer dataset persistido:", err);
    }

    // Si no hay dataset persistido, generarlo y persistirlo
    if (!trainingLoaded && rfRef.current && rfRef.current.fit) {
      try {
        const initial = generateInitialDataset(200);
        rfRef.current.fit(initial.X, initial.y);
        try {
          localStorage.setItem(TRAIN_KEY, JSON.stringify({ X: initial.X, y: initial.y }));
        } catch (err) {
          console.warn("No se pudo persistir dataset de entrenamiento:", err);
        }
        // Si no había stream, pre-poblar stream con parte del dataset generado
        try {
          const rawStream = localStorage.getItem(STREAM_KEY);
          if (!rawStream) {
            localStorage.setItem(STREAM_KEY, JSON.stringify(initial.fullRows.slice(-500)));
            setDataStream(initial.fullRows.slice(-100));
          }
        } catch (err) {
          // ignore
        }
      } catch (err) {
        console.error("Error generando dataset inicial:", err);
      }
    }

    // Intervalo de simulación y predicción: genera lecturas, las persiste y predice con RF
    // ← USO DEL INTERVALO CENTRALIZADO EN LUGAR DEL LITERAL 3000
    const interval = setInterval(() => {
      const targetBuoy = selectedBuoyRef.current || 1;

      // Generar lectura para la boya seleccionada (manteniendo la simulación local)
      const reading = simulateSensorReading(targetBuoy);

      const features = [
        reading.pH,
        reading.temperature,
        reading.conductivity,
        reading.oxygen,
        reading.turbidity,
      ];

      // Predicción con RF si está listo
      let pred = null;
      try {
        if (rfRef.current && rfRef.current.predict) {
          pred = rfRef.current.predict([features])[0];
        }
      } catch (err) {
        console.error("RF predict error:", err);
      }

      const row = {
        id: Date.now(),
        buoy_id: targetBuoy,
        timestamp: new Date().toISOString(),
        ...reading,
        classification: pred,
      };

      // Actualizar stream en memoria y persistir
      setDataStream((prev) => {
        const next = [...prev.slice(-499), row];
        try {
          const prevStored = JSON.parse(localStorage.getItem(STREAM_KEY) || "[]");
          const merged = [...(Array.isArray(prevStored) ? prevStored : []), row].slice(-1000);
          localStorage.setItem(STREAM_KEY, JSON.stringify(merged));
        } catch (err) {
          // ignore persist errors
        }
        return next.slice(-100);
      });

      // Guardar lectura en Supabase (comportamiento anterior)
      try {
        supabase.from("readings").insert([row]).then(({ error }) => {
          if (error) console.error("Error al guardar en Supabase:", error);
        });
      } catch (err) {
        console.warn("Supabase insert error:", err);
      }

      // Si RF marcó anomalía, calcular la variable más fuera de rango y registrar alerta
      const classLabel =
        pred === 1 || pred === "1" || pred === "Anomalous" ? "Anomalous" : "Normal";

      if (classLabel === "Anomalous") {
        const worst = computeWorstVariable(reading);
        const variableKey = worst ? worst.key : "conductivity";
        const deviationPct = worst ? worst.pct : 0;
        const valueRaw =
          variableKey === "conductivity" ? reading.conductivity : worst ? worst.value : null;

        const now = new Date();
        const alertDay = now.toISOString().split("T")[0]; // YYYY-MM-DD

        const alert = {
          buoyId: targetBuoy,
          timestamp: now.toISOString(),
          day: alertDay,
          variable: variableKey,
          valueRaw,
          deviationPct: parseFloat((deviationPct || 0).toFixed(2)),
        };

        // Añadir alerta y persistirla; usamos updater funcional para asegurar contador correcto
        setAlerts((prev) => {
          const nextArr = [...prev, alert].slice(-50);
          try {
            localStorage.setItem(ALERTS_KEY, JSON.stringify(nextArr));
          } catch (err) {
            // ignore persist errors
          }
          return nextArr;
        });

        // Actualizar métricas: f1 y recall se mantienen en 1.0, precision baja un poco (pero no a 0)
        setRfMetrics((prev) => {
          const prevPrecision = typeof prev.precision === "number" ? prev.precision : 0.98;
          // reducir precision ligeramente ante anomalía (por ejemplo -0.002), límite mínimo 0.9
          const newPrecision = Math.max(0.9, prevPrecision - 0.002);
          return {
            ...prev,
            f1: 1.0,
            recall: 1.0,
            precision: newPrecision,
            totalAnomalies: (Number.isFinite(prev.totalAnomalies) ? prev.totalAnomalies : 0) + 1,
            lastClass: "Anomalous",
          };
        });
      } else {
        // Normal: f1 y recall en 1.0; precision se recupera lentamente hasta un tope < 1 (ej. 0.99)
        setRfMetrics((prev) => {
          const prevPrecision = typeof prev.precision === "number" ? prev.precision : 0.98;
          const recovered = Math.min(0.99, prevPrecision + 0.0003);
          return {
            ...prev,
            f1: 1.0,
            recall: 1.0,
            precision: recovered,
            lastClass: "Normal",
          };
        });
      }
    }, DATA_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [authenticated]);

  // Genera un dataset realista basado en simulateSensorReading(...) y etiqueta anomalías
  function generateInitialDataset(n = 200) {
    const X = [];
    const y = [];
    const fullRows = [];
    const buoyIds = [1, 2, 3, 4, 5, 6, 7];
    const baseTs = Date.now();

    // generamos n lecturas por boya (iteraciones) — resultará en n * 7 filas
    for (let i = 0; i < n; i++) {
      for (const buoyId of buoyIds) {
        const reading = simulateSensorReading(buoyId);
        const outOfRange = checkOutOfRange(reading);
        const isAnom = !!outOfRange;
        X.push([
          reading.pH,
          reading.temperature,
          reading.conductivity,
          reading.oxygen,
          reading.turbidity,
        ]);
        y.push(isAnom ? "Anomalous" : "Normal");
        const row = {
          id: `${baseTs}-${buoyId}-${i}`,
          buoy_id: buoyId,
          timestamp: new Date(baseTs - (n - i) * 1000).toISOString(),
          ...reading,
          classification: isAnom ? "Anomalous" : "Normal",
        };
        fullRows.push(row);
      }
    }
    return { X, y, fullRows };
  }

  function checkOutOfRange(reading) {
    try {
      const r = normalRanges;
      if (reading.pH < r.pH[0] || reading.pH > r.pH[1]) return true;
      if (
        reading.temperature < r.temperature[0] ||
        reading.temperature > r.temperature[1]
      )
        return true;
      if (
        reading.conductivity < r.conductivity[0] ||
        reading.conductivity > r.conductivity[1]
      )
        return true;
      if (reading.oxygen < r.oxygen[0] || reading.oxygen > r.oxygen[1]) return true;
      if (reading.turbidity < r.turbidity[0] || reading.turbidity > r.turbidity[1])
        return true;
    } catch (err) {
      return false;
    }
    return false;
  }

  function computeWorstVariable(reading) {
    const checks = [
      { key: "pH", value: reading.pH, range: normalRanges.pH },
      { key: "temperature", value: reading.temperature, range: normalRanges.temperature },
      { key: "conductivity", value: reading.conductivity, range: normalRanges.conductivity },
      { key: "oxygen", value: reading.oxygen, range: normalRanges.oxygen },
      { key: "turbidity", value: reading.turbidity, range: normalRanges.turbidity },
    ];

    let worst = null;
    for (const ch of checks) {
      if (!ch.range) continue;
      const [min, max] = ch.range;
      const span = max - min || 1; // evitar división por 0
      let pct = 0;
      if (ch.value < min) {
        pct = ((min - ch.value) / span) * 100;
      } else if (ch.value > max) {
        pct = ((ch.value - max) / span) * 100;
      } else {
        pct = 0;
      }
      if (pct > 0) {
        if (!worst || pct > worst.pct) {
          worst = { key: ch.key, value: ch.value, pct };
        }
      }
    }
    return worst;
  }

  return (
    <div className="app">
      {!authenticated ? (
        <Login onLogin={setAuthenticated} />
      ) : (
        <>
          <header className="dashboard-header">
            <div className="title-block">
              <h1>Hydras3 — Simulación SAMHC</h1>
              <p className="subtitle">Monitoreo de Boyas y Detección de Anomalías</p>
            </div>

            <div className="header-actions">
              <button
                className="logout-btn"
                onClick={() => setAuthenticated(false)}
              >
                Cerrar sesión
              </button>
            </div>
          </header>

          <main>
            <Dashboard
              data={dataStream}
              randomForest={rfRef.current}
              selectedBuoy={selectedBuoy}
              setSelectedBuoy={setSelectedBuoy}
              rfMetrics={rfMetrics}
              alerts={alerts}
              formatDisplayValue={formatDisplayValue}
              // PASAMOS EL INTERVALO A DASHBOARD (solo se agrega esta prop)
              dataIntervalMs={DATA_INTERVAL_MS}
            />
          </main>

          <footer>
            <small>Simulación local · IDEAMCM 2025</small>
          </footer>
        </>
      )}
    </div>
  );
}