import React from "react";
import { Wifi, HeartPulse } from "lucide-react";

export default function BuoyStatus({ buoyId, buoyName, coords, ph, temperatura, oxigeno }) {
  return (
    <div className="dashboard-header-info">
      {/* Izquierda: título y estado */}
      <div className="header-left">
        <div className="header-title">
          <Wifi size={22} color="#2563eb" />
          <h2>{buoyName || `Boya ${buoyId}`}</h2>
        </div>
        <p className="coords">
          Coordenadas: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </p>
        <p className="status">
          <HeartPulse size={18} color="#22c55e" />
          <span className="online-text">Online</span>
        </p>
      </div>

      {/* Derecha: módulos ambientales */}
      <div className="header-right">
        <div className="env-box">
          <h4>pH</h4>
          <p>{ph}</p>
        </div>
        <div className="env-box">
          <h4>Temperatura</h4>
          <p>{temperatura}</p>
        </div>
        <div className="env-box">
          <h4>O₂ Disuelto</h4>
          <p>{oxigeno}</p>
        </div>
      </div>
    </div>
  );
}
