import React from "react";

/**
 * Módulo de métricas y rendimiento del modelo Random Forest.
 * Adaptado para Hydras3-Sim con diseño visual mejorado.
 */
export default function ModelMetrics({ metricas = {}, randomForest = null }) {
  const { f1 = 0, precision = 0, recall = 0, anomalies = 0 } = metricas;

  const barras = [
    { label: "F1 Score", value: f1 * 100, color: "#38bdf8" },
    { label: "Precisión", value: precision * 100, color: "#22c55e" },
    { label: "Recall", value: recall * 100, color: "#fb923c" },
  ];

  return (
    <div className="rf-panel">
      <h3 className="rf-title">🔎 Módulo Random Forest — Detección de Anomalías</h3>

      <div className="rf-metrics">
        {barras.map((b, i) => (
          <div key={i} className="rf-bar-container">
            <div className="rf-bar-label">
              <span>{b.label}</span>
              <span>{b.value.toFixed(1)}%</span>
            </div>
            <div className="rf-bar">
              <div
                className="rf-bar-fill"
                style={{ width: `${b.value}%`, backgroundColor: b.color }}
              />
            </div>
          </div>
        ))}

        <div className="rf-summary">
          <div className="rf-summary-item">
            <span className="rf-summary-label">Anomalías detectadas</span>
            <span className="rf-summary-value">{anomalies}</span>
          </div>

          <div className="rf-summary-item">
            <span className="rf-summary-label">Estimadores</span>
            <span className="rf-summary-value">
              {randomForest?.nEstimators ?? "—"}
            </span>
          </div>

          <div className="rf-summary-item">
            <span className="rf-summary-label">Profundidad máx.</span>
            <span className="rf-summary-value">
              {randomForest?.maxDepth ?? "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
