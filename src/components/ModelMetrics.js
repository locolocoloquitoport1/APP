  import React from "react";

  /**
   * ModelMetrics
   * Ahora acepta:
   * - metricas: { f1, precision, recall, anomalies, lastClass }
   * - randomForest: referencia opcional al modelo
   * - alerts: array de alertas { buoyId, timestamp, variable, valueRaw, deviationPct }
   * - formatDisplayValue: función opcional para formatear el valor mostrado
   */
  export default function ModelMetrics({
    metricas = {},
    randomForest,
    alerts = [],
    formatDisplayValue,
  }) {
    const { f1 = 0, precision = 0, recall = 0, anomalies = 0, lastClass = "Normal" } =
      metricas;

    const barras = [
      { label: "F1 Score", value: f1 * 100, color: "#38bdf8" },
      { label: "Precisión", value: precision * 100, color: "#22c55e" },
      { label: "Recall", value: recall * 100, color: "#fb923c" },
    ];

    return (
      <div className="rf-panel">
        <h3 className="rf-title"> Detección de Anomalías</h3>

        <div className="rf-metrics">
          {barras.map((b, i) => (
            <div key={i} className="rf-bar-container">
              <div className="rf-bar-label">
                <span>{b.label}</span>
                <span style={{ fontWeight: 700 }}>{Math.round(b.value)}%</span>
              </div>
              <div className={`rf-bar rf-bar-${i}`}>
                <div
                  className="rf-bar-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, b.value))}%`,
                    background:
                      i === 0
                        ? "linear-gradient(90deg,#60a5fa,#3b82f6)"
                        : i === 1
                        ? "linear-gradient(90deg,#34d399,#10b981)"
                        : "linear-gradient(90deg,#fbbf24,#f59e0b)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <strong>Estado del Modelo:</strong>{" "}
              <span style={{ color: lastClass === "Anomalous" ? "#ffc857" : "#2ee08a", fontWeight: 700 }}>
                {lastClass}
              </span>
            </div>
            <div>
              <strong>Anomalías (totales):</strong> <span style={{ fontWeight: 700 }}>{anomalies}</span>
            </div>
          </div>
        </div>

        {/* -------------------------
            Tabla de alertas recientes
          ------------------------- */}
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: "8px 0", color: "#dff6ff" }}>Alertas recientes</h4>
          {alerts && alerts.length > 0 ? (
            <div style={{ maxHeight: 220, overflow: "auto", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#cfeffd", opacity: 0.95 }}>
                    <th style={{ padding: "6px 8px", width: 80 }}>Boya</th>
                    <th style={{ padding: "6px 8px", width: 110 }}>Hora</th>
                    <th style={{ padding: "6px 8px" }}>Variable</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Valor</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Fuera de rango</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts
                    .slice()
                    .reverse()
                    .map((a, i) => {
                      const hora = new Date(a.timestamp).toLocaleTimeString();
                      const varNameDisplay =
                        a.variable === "conductivity"
                          ? "Conductividad"
                          : a.variable === "temperature"
                          ? "Temperatura"
                          : a.variable === "pH"
                          ? "pH"
                          : a.variable === "oxygen"
                          ? "Oxígeno"
                          : a.variable === "turbidity"
                          ? "Turbidez"
                          : a.variable;
                      const valueDisplay = formatDisplayValue
                        ? formatDisplayValue(a.variable, a.valueRaw)
                        : a.valueRaw;
                      return (
                        <tr key={`${a.buoyId}-${a.timestamp}-${i}`} style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                          <td style={{ padding: "8px" }}>Boya {a.buoyId}</td>
                          <td style={{ padding: "8px" }}>{hora}</td>
                          <td style={{ padding: "8px" }}>{varNameDisplay}</td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>{valueDisplay}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#ffc857", fontWeight: 700 }}>
                            {a.deviationPct}%{" "}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.65)", padding: "8px 0" }}>No hay alertas recientes</div>
          )}
        </div>
      </div>
    );
  }