import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 🗺️ Coordenadas de boyas
const buoyPositions = {
  1: { lat: 11.04083, lng: -74.86389 },
  2: { lat: 11.03556, lng: -74.85389 },
  3: { lat: 11.045, lng: -74.84778 },
  4: { lat: 11.0375, lng: -74.83944 },
  5: { lat: 11.04583, lng: -74.83778 },
  6: { lat: 11.05472, lng: -74.84444 },
  7: { lat: 11.04861, lng: -74.85472 }
};

// 🔹 Fijar el ícono clásico de Leaflet (puntero azul)
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

// 🔹 Subcomponente para centrar el mapa
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14);
  }, [center, map]);
  return null;
}

export default function BuoyMap({ selectedBuoy }) {
  const pos = buoyPositions[selectedBuoy];
  const mapRef = useRef(null);

  if (!pos) return null;

  // ✅ Permite zoom con Ctrl + rueda
  useEffect(() => {
    const mapContainer = mapRef.current;
    if (!mapContainer) return;

    const leafletMap = mapContainer._leaflet_map;
    if (!leafletMap) return;

    leafletMap.scrollWheelZoom.disable();

    leafletMap.on("wheel", (e) => {
      if (e.originalEvent.ctrlKey) {
        leafletMap.scrollWheelZoom.enable();
      } else {
        leafletMap.scrollWheelZoom.disable();
      }
    });
  }, []);

  return (
    <div className="map-container">
      <MapContainer
        center={[pos.lat, pos.lng]}
        zoom={14}
        style={{ height: "280px", width: "100%", borderRadius: "10px" }}
        ref={mapRef}
        scrollWheelZoom={false}
      >
        <ChangeView center={[pos.lat, pos.lng]} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* 📍 Marcador con ícono clásico */}
        <Marker position={[pos.lat, pos.lng]}>
          <Popup>Boya {selectedBuoy}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}