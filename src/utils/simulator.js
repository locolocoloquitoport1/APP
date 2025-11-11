// Simulador de sensores para las boyas
// - Ahora exporta DATA_INTERVAL_MS y DATA_INTERVAL_SECONDS para definir el intervalo
//   entre datos (App.js / Dashboard pueden importarlo y usarlo).
// - Mantiene simulateSensorReading(buoyId) para compatibilidad.
// - Perfil de conductividad: únicamente boyas 1,6,7 cercanas a 2 S/m (~20000 µS/cm).
//   Boyas 2,3,4,5 manejan valores alrededor de 1.6 S/m (~16000 µS/cm).
// - Cada boya tiene una "base" (BUOY_BASES) para garantizar que entre boyas las
//   series aleatorias sean distintas pero consistentes durante la ejecución.
// - Turbidez: rango normal high = 6.9 - 120 (con absMax acotado a 200); low acotado menor.
// - Todas las variables siguen generándose con distribución normal y anomalías ocasionales.

export const DATA_INTERVAL_MS = 3000; // valor por defecto (ms). Cambia aquí si quieres otro intervalo.
export const DATA_INTERVAL_SECONDS = DATA_INTERVAL_MS / 1000;

const BUOY_IDS = [1, 2, 3, 4, 5, 6, 7];
const HIGH_PROFILE_IDS = new Set([1, 6, 7]);

function randn_bm() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function pickMean([a, b]) {
  return a + Math.random() * (b - a);
}

// Generamos una "base" por boya para darles identidad distinta pero estable
// durante la ejecución. Estas bases alteran ligeramente las medias de cada boya.
const BUOY_BASES = (() => {
  const map = new Map();
  for (const id of BUOY_IDS) {
    // turbidityScale: entre 0.85 y 1.25 — da diferencias entre boyas
    const turbidityScale = 0.85 + Math.random() * 0.4;
    // conductivityOffset en µS/cm: ahora entre -400 y +400 (antes era -1200 .. +1200)
    // --> así las boyas 2-5 se mantendrán cerca de la media (~16000 µS/cm = 1.6 S/m)
    const conductivityOffset = -400 + Math.random() * 800;
    // phOffset pequeño
    const phOffset = -0.15 + Math.random() * 0.3;
    // tempOffset pequeño
    const tempOffset = -1.2 + Math.random() * 2.4;
    // oxygenOffset pequeño
    const oxygenOffset = -0.6 + Math.random() * 1.2;
    map.set(id, {
      turbidityScale,
      conductivityOffset,
      phOffset,
      tempOffset,
      oxygenOffset,
    });
  }
  return map;
})();

/**
 * Genera valor con distribución normal centrada en mean, desviación std.
 * - Se limita a [min, max] para lecturas "normales".
 * - Con probabilidad anomalyRate genera un valor anómalo (por encima o por debajo)
 *   respetando providedLimits.absMin/absMax.
 */
function generateSensorValue({
  mean,
  std,
  min,
  max,
  anomalyRate = 0.03,
  anomalyMultiplier = 1.5,
  providedLimits = { absMin: -Infinity, absMax: Infinity },
}) {
  const isAnom = Math.random() < anomalyRate;

  if (!isAnom) {
    const raw = mean + randn_bm() * std;
    const clamped = clamp(raw, min, max);
    const rounded = Math.round((clamped + Number.EPSILON) * 1000) / 1000;
    return clamp(rounded, providedLimits.absMin, providedLimits.absMax);
  } else {
    // anomalía: por encima o por debajo
    const above = Math.random() < 0.5;
    const range = Math.max(Math.abs(max - min), 1);
    const extra = Math.random() * range * anomalyMultiplier;
    let val = above ? max + extra : min - extra;
    // limitar a límites absolutos
    val = clamp(val, providedLimits.absMin, providedLimits.absMax);
    const rounded = Math.round((val + Number.EPSILON) * 1000) / 1000;
    return rounded;
  }
}

/* Parámetros específicos (conductivity en µS/cm) */
const conductivityParams = {
  high: {
    // 1.9 - 2.0 S/m -> 19000 - 20000 µS/cm
    meanRange: [19000, 20000],
    std: 300, // variación pequeña
    min: 14000,
    max: 25000,
    anomalyRate: 0.03,
    anomalyMultiplier: 1.2,
    providedLimits: { absMin: 2000, absMax: 30000 },
  },
  // Para boyas 2,3,4,5 rondar ~1.6 S/m -> 16000 µS/cm
  mid16: {
    meanRange: [15500, 16500], // alrededor de 16000
    std: 250,
    min: 12000,
    max: 18000,
    anomalyRate: 0.025,
    anomalyMultiplier: 1.1,
    providedLimits: { absMin: 2000, absMax: 30000 },
  },
  low: {
    // reserva, si necesitases boyas con valores bajos (<1 S/m)
    meanRange: [7000, 11000],
    std: 600,
    min: 5000,
    max: 14000,
    anomalyRate: 0.03,
    providedLimits: { absMin: 2000, absMax: 30000 },
  },
};

const turbidityParams = {
  high: {
    // Observado: 6.9 - 120 (valores tomados). Ponemos esos límites normales.
    meanRange: [20, 60], // media 20-60, luego escalada por boya
    std: 12,
    min: 6.9,
    max: 120,
    anomalyRate: 0.06,
    anomalyMultiplier: 1.3,
    providedLimits: { absMin: 0, absMax: 200 }, // tope absoluto razonable (no 1000)
  },
  low: {
    meanRange: [0.6, 1.8], // NTU (valores bajos, cercanos a <2)
    std: 0.6,
    min: 0,
    max: 4,
    anomalyRate: 0.04,
    anomalyMultiplier: 2.0,
    providedLimits: { absMin: 0, absMax: 50 }, // si hay anomalía puede subir, pero acotado
  },
};

/* Otras variables (valores acordes con la tabla de la imagen) */
const phParams = {
  meanRange: [7.15, 8.71],
  std: 0.18,
  min: 6.5,
  max: 9.5,
  anomalyRate: 0.015,
  providedLimits: { absMin: 0, absMax: 14 },
};

const tempParams = {
  meanRange: [29, 31.5],
  std: 0.9,
  min: 5,
  max: 40,
  anomalyRate: 0.02,
  providedLimits: { absMin: -10, absMax: 60 },
};

const oxygenParams = {
  meanRange: [3.98, 6.01],
  std: 0.5,
  min: 0,
  max: 15,
  anomalyRate: 0.03,
  providedLimits: { absMin: 0, absMax: 20 },
};

export function simulateSensorReading(buoyId = 1) {
  const id = Number(buoyId) || 1;
  const isHigh = HIGH_PROFILE_IDS.has(id);

  const buoyBase = BUOY_BASES.get(id) || {
    turbidityScale: 1,
    conductivityOffset: 0,
    phOffset: 0,
    tempOffset: 0,
    oxygenOffset: 0,
  };

  // Conductividad (µS/cm)
  let cParams;
  if (isHigh) {
    cParams = conductivityParams.high;
  } else if ([2, 3, 4, 5].includes(id)) {
    // explicitly set 2-5 to rondar ~1.6 S/m
    cParams = conductivityParams.mid16;
  } else {
    cParams = conductivityParams.low;
  }
  const cMeanBase = pickMean(cParams.meanRange) + (buoyBase.conductivityOffset || 0);
  const conductivity = generateSensorValue({
    mean: cMeanBase,
    std: cParams.std,
    min: cParams.min,
    max: cParams.max,
    anomalyRate: cParams.anomalyRate,
    anomalyMultiplier: cParams.anomalyMultiplier,
    providedLimits: cParams.providedLimits,
  });

  // Turbidez (NTU) — aplicamos escala por boya para variar entre boyas
  const tParams = isHigh ? turbidityParams.high : turbidityParams.low;
  const rawTMean = pickMean(tParams.meanRange) * (buoyBase.turbidityScale || 1);
  const turbidity = generateSensorValue({
    mean: rawTMean,
    std: tParams.std,
    min: tParams.min,
    max: tParams.max,
    anomalyRate: tParams.anomalyRate,
    anomalyMultiplier: tParams.anomalyMultiplier,
    providedLimits: tParams.providedLimits,
  });

  // pH
  const phMean = pickMean(phParams.meanRange) + (buoyBase.phOffset || 0);
  const ph = generateSensorValue({
    mean: phMean,
    std: phParams.std,
    min: phParams.min,
    max: phParams.max,
    anomalyRate: phParams.anomalyRate,
    providedLimits: phParams.providedLimits,
  });

  // Temperatura (°C)
  const tempMean = pickMean(tempParams.meanRange) + (buoyBase.tempOffset || 0);
  const temperature = generateSensorValue({
    mean: tempMean,
    std: tempParams.std,
    min: tempParams.min,
    max: tempParams.max,
    anomalyRate: tempParams.anomalyRate,
    providedLimits: tempParams.providedLimits,
  });

  // Oxígeno disuelto (mg/L)
  const oxyMean = pickMean(oxygenParams.meanRange) + (buoyBase.oxygenOffset || 0);
  const oxygen = generateSensorValue({
    mean: oxyMean,
    std: oxygenParams.std,
    min: oxygenParams.min,
    max: oxygenParams.max,
    anomalyRate: oxygenParams.anomalyRate,
    providedLimits: oxygenParams.providedLimits,
  });

  // Formato final: números con precisión razonable
  return {
    pH: Math.round((ph + Number.EPSILON) * 100) / 100,
    temperature: Math.round((temperature + Number.EPSILON) * 100) / 100,
    conductivity: Math.round((conductivity + Number.EPSILON) * 1000) / 1000, // µS/cm
    oxygen: Math.round((oxygen + Number.EPSILON) * 100) / 100,
    turbidity: Math.round((turbidity + Number.EPSILON) * 1000) / 1000,
  };
}