import React from "react";

export default function AlertPanel({ data }) {
  if (!data || data.length === 0) return <div className="small">Sin datos</div>;

  return (
    <div>
      {data.map((r) => (
        <div key={r.id} style={{ marginBottom: 8 }}>
          {r.classification === "Anomalous" ? (
            <div className="alert">
              <strong>ANOMALÍA</strong> — {new Date(r.timestamp).toLocaleString()} · 
              pH:{r.pH} T:{r.temperature}°C O₂:{r.oxygen} NTU:{r.turbidity}
            </div>
          ) : (
            <div className="small">
              {new Date(r.timestamp).toLocaleString()} · Normal
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
