import React from "react";

/**
 * Muestra métricas básicas sacadas del objeto randomForest (si existe)
 * En este prototipo RF es simple; mostramos parámetros y un resumen
 */
export default function ModelMetrics({ randomForest = null, data = [] }) {
  if (!randomForest) {
    return <div className="small">Modelo no inicializado aún</div>;
  }

  const nEstimators = randomForest.nEstimators || "—";
  const maxDepth = randomForest.maxDepth || "—";
  const sampleRatio = randomForest.sampleRatio || "—";

  // compute simple confusion-like counts from recent data if model exposes predict
  const recent = data.slice(-200);
  let counts = { Normal: 0, Anomalous: 0 };
  if (recent.length > 0) {
    recent.forEach(r => {
      counts[r.classification] = (counts[r.classification] || 0) + 1;
    });
  }

  return (
    <div>
      <div><small>Estimadores: <strong>{nEstimators}</strong></small></div>
      <div><small>Profundidad máxima: <strong>{maxDepth}</strong></small></div>
      <div><small>Muestra por árbol: <strong>{sampleRatio}</strong></small></div>

      <hr />

      <div><small>Registros en buffer: <strong>{data.length}</strong></small></div>
      <div style={{marginTop:8}}>
        <strong>Últimas clasificaciones</strong>
        <table className="table">
          <thead>
            <tr><th>Clase</th><th>Cantidad</th></tr>
          </thead>
          <tbody>
            <tr><td>Normal</td><td>{counts.Normal}</td></tr>
            <tr><td>Anomalous</td><td>{counts.Anomalous}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
