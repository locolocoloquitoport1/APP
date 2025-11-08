import React, { useEffect, useState, useRef } from "react";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import { simulateSensorReading } from "./utils/simulator";
import { RandomForest } from "./utils/randomForest";
import supabase from "./lib/supabase";
import "./styles.css";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [dataStream, setDataStream] = useState([]);
  const [selectedBuoy, setSelectedBuoy] = useState(1); // 🆕 Boya seleccionada
  const rfRef = useRef(null);

  useEffect(() => {
    if (!authenticated) return;

    const initial = generateInitialDataset(200);
    rfRef.current = new RandomForest({
      nEstimators: 15,
      maxDepth: 6,
      sampleRatio: 0.7
    });
    rfRef.current.fit(initial.X, initial.y);
    setDataStream(initial.fullRows.slice(-100));

    const interval = setInterval(() => {
      const reading = simulateSensorReading();
      const features = [
        reading.pH,
        reading.temperature,
        reading.conductivity,
        reading.oxygen,
        reading.turbidity
      ];
      const pred = rfRef.current.predict([features])[0];
      const row = {
        id: Date.now(),
        buoy_id: selectedBuoy,
        timestamp: new Date().toISOString(),
        ...reading,
        classification: pred
      };
      setDataStream((prev) => [...prev.slice(-199), row]);

      // 🆕 Guardar la lectura en Supabase
      supabase.from("readings").insert([row]).then(({ error }) => {
        if (error) console.error("Error al guardar en Supabase:", error);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [authenticated, selectedBuoy]);

  function generateInitialDataset(n = 200) {
    const X = [];
    const y = [];
    const fullRows = [];
    for (let i = 0; i < n; i++) {
      const isAnom = Math.random() < 0.08;
      const pH = randBetween(isAnom ? 4.5 : 6.6, isAnom ? 3.0 : 8.3);
      const temperature = randBetween(isAnom ? 34 : 25, isAnom ? 38 : 31);
      const conductivity = randBetween(isAnom ? 6 : 2.1, isAnom ? 10 : 4.4);
      const oxygen = randBetween(isAnom ? 0.5 : 4.0, isAnom ? 2.5 : 9.8);
      const turbidity = randBetween(isAnom ? 60 : 1.5, isAnom ? 150 : 28);
      const row = {
        timestamp: new Date(Date.now() - (n - i) * 1000).toISOString(),
        pH,
        temperature,
        conductivity,
        oxygen,
        turbidity
      };
      X.push([pH, temperature, conductivity, oxygen, turbidity]);
      y.push(isAnom ? "Anomalous" : "Normal");
      fullRows.push({ id: i, ...row, classification: y[y.length - 1] });
    }
    return { X, y, fullRows };
  }

  function randBetween(a, b) {
    return parseFloat((a + Math.random() * (b - a)).toFixed(3));
  }

  return (
    <div className="app">
      {!authenticated ? (
        <Login onLogin={setAuthenticated} />
      ) : (
        <>
          <header className="dashboard-header">
            <h1>Hydras3 — Simulación SAMHC</h1>
            <p className="subtitle">
              Monitoreo de Boyas y Detección de Anomalías
            </p>

            <button
              className="logout-btn"
              onClick={() => setAuthenticated(false)}
            >
              Cerrar sesión
            </button>
          </header>

          <main>
            <Dashboard
              data={dataStream}
              randomForest={rfRef.current}
              selectedBuoy={selectedBuoy}
              setSelectedBuoy={setSelectedBuoy}
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