import React, { useEffect } from "react";

/**
 * ChartModal - simple reusable modal para ampliar gráficas.
 * Comportamiento:
 *  - Se cierra al hacer click fuera del contenido o presionar ESC
 *  - Previene el scroll del body mientras está abierto
 *  - Evita que clicks dentro del contenido cierren el modal
 *
 * Uso:
 *  <ChartModal title="..." onClose={...}>
 *    <div style={{ width: '100%', height: '70vh' }}> ...gráfica... </div>
 *  </ChartModal>
 */
export default function ChartModal({ children, onClose, title }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const backdropStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.6)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
    backdropFilter: "blur(2px)",
  };

  const contentStyle = {
    position: "relative",
    background: "linear-gradient(180deg, rgba(2,20,34,0.96), rgba(3,36,60,0.98))",
    borderRadius: 12,
    boxShadow: "0 30px 80px rgba(2,6,23,0.8)",
    padding: 12,
    maxHeight: "92vh",
    width: "min(1100px, 96vw)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  const closeBtnStyle = {
    position: "absolute",
    top: 8,
    right: 10,
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 28,
    lineHeight: 1,
    cursor: "pointer",
  };

  const titleStyle = {
    color: "#e6f6ff",
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    paddingLeft: 6,
  };

  return (
    <div style={backdropStyle} onClick={onClose} role="dialog" aria-modal="true">
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={closeBtnStyle}
          title="Cerrar (Esc)"
        >
          ×
        </button>
        {title ? <h3 style={titleStyle}>{title}</h3> : null}
        <div style={{ flex: 1, minWidth: 200 }}>{children}</div>
      </div>
    </div>
  );
}