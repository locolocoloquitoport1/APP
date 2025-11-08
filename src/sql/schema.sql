-- ============================================================
-- Esquema de base de datos para Hydras3-Sim
-- Sistema Autónomo de Monitoreo Hidroambiental para la Ciénaga
-- ============================================================

-- 🧭 Tabla de boyas
CREATE TABLE IF NOT EXISTS buoys (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL
);

-- 🧪 Tabla de lecturas de sensores
CREATE TABLE IF NOT EXISTS readings (
  id SERIAL PRIMARY KEY,
  buoy_id INTEGER REFERENCES buoys(id),
  timestamp TIMESTAMP DEFAULT now(),
  pH DOUBLE PRECISION,
  temperature DOUBLE PRECISION,
  conductivity DOUBLE PRECISION,
  oxygen DOUBLE PRECISION,
  turbidity DOUBLE PRECISION,
  classification VARCHAR(20)
);

-- 📊 Tabla de métricas de modelos Random Forest (opcional)
CREATE TABLE IF NOT EXISTS models (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) DEFAULT 'RandomForest',
  version VARCHAR(20),
  created_at TIMESTAMP DEFAULT now(),
  accuracy DOUBLE PRECISION,
  precision DOUBLE PRECISION,
  recall DOUBLE PRECISION
);

-- 🚨 Tabla de alertas (opcional)
CREATE TABLE IF NOT EXISTS anomalies (
  id SERIAL PRIMARY KEY,
  buoy_id INTEGER REFERENCES buoys(id),
  timestamp TIMESTAMP DEFAULT now(),
  type VARCHAR(50),
  details TEXT
);

-- 🧱 Inserta las boyas iniciales
INSERT INTO buoys (name, lat, lon) VALUES
('Boya 1', 11.04083, -74.86389),
('Boya 2', 11.03556, -74.85389),
('Boya 3', 11.04500, -74.84778),
('Boya 4', 11.03750, -74.83944),
('Boya 5', 11.04583, -74.83778),
('Boya 6', 11.05472, -74.84444),
('Boya 7', 11.04861, -74.85472);

-- ✅ Índices recomendados para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_readings_buoy ON readings (buoy_id);
CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings (timestamp DESC);
