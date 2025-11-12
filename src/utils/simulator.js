// Simulador de sensores para las boyas
// - DATA_INTERVAL_MS / DATA_INTERVAL_SECONDS exportados para usar en App
// - simulateSensorReading(buoyId) genera pH, temperature, conductivity, oxygen, turbidity
// - Temperatura: random-walk por boya, rango principal 29 - 31.5 ºC, pasos pequeños,
//   anomalías raras y ligeramente fuera de rango.

export const DATA_INTERVAL_MS = 3000; // valor por defecto (ms)
export const DATA_INTERVAL_SECONDS = DATA_INTERVAL_MS / 1000;

const BUOY_IDS = [1, 2, 3, 4, 5, 6, 7];
const HIGH_PROFILE_IDS = new Set([1, 6, 7]);

// Generador normal estándar (Box-Muller)
function randn_bm() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function pickMean([a, b]) {
  return a + Math.random() * (b - a);
}

/* Parámetros específicos (conductivity en µS/cm) */
const conductivityParams = {
  high: {
    meanRange: [19000, 20000],
    std: 300,
    min: 14000,
    max: 25000,
    anomalyRate: 0.03,
    anomalyMultiplier: 1.2,
    providedLimits: { absMin: 0, absMax: 30000 },
  },
  mid16: {
    meanRange: [15500, 17000],
    std: 600,
    min: 12000,
    max: 20000,
    anomalyRate: 0.025,
    anomalyMultiplier: 1.2,
    providedLimits: { absMin: 0, absMax: 30000 },
  },
  low: {
    meanRange: [12000, 16000],
    std: 1000,
    min: 8000,
    max: 22000,
    anomalyRate: 0.03,
    anomalyMultiplier: 1.2,
    providedLimits: { absMin: 0, absMax: 30000 },
  },
};

const turbidityParams = {
  low: {
    meanRange: [6.9, 40],
    std: 25,
    min: 0,
    max: 200,
    anomalyRate: 0.02,
    anomalyMultiplier: 2.0,
    providedLimits: { absMin: 0, absMax: 500 },
  },
  high: {
    meanRange: [40, 120],
    std: 35,
    min: 0,
    max: 200,
    anomalyRate: 0.03,
    anomalyMultiplier: 2.0,
    providedLimits: { absMin: 0, absMax: 500 },
  },
};

const phParams = {
  meanRange: [7.15, 8.71],
  std: 0.18,
  min: 6.5,
  max: 9.5,
  anomalyRate: 0.015,
  providedLimits: { absMin: 0, absMax: 14 },
};

// Temperatura: rango principal 29 - 31.5
// - stepStd / maxStep controlan la suavidad del random-walk
// - anomalyRate baja para anomalías raras y anomalyRange pequeña para que no salgan muy lejos
const tempParams = {
  meanRange: [29, 31.5],
  std: 0.9, // conservado para compatibilidad si se quiere usar en generador genérico
  min: 5,
  max: 40,
  anomalyRate: 0.005, // 0.5% por lectura -> raro
  anomalyRange: 0.8, // cuánto puede salirse la anomalía respecto al rango principal
  stepStd: 0.08, // desviación estándar del paso del random-walk (~0.08°C)
  maxStep: 0.25, // máximo cambio absoluto por paso (evita saltos grandes)
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

// Generamos una "base" por boya para darles identidad distinta pero estable
// durante la ejecución. Además almacenamos lastTemperature para el random-walk.
const BUOY_BASES = (() => {
  const map = new Map();
  for (const id of BUOY_IDS) {
    // turbidityScale: entre 0.85 y 1.25 — da diferencias entre boyas
    const turbidityScale = 0.85 + Math.random() * 0.4;
    // conductivityOffset en µS/cm: ahora entre -400 y +400
    const conductivityOffset = -400 + Math.random() * 800;
    // phOffset pequeño
    const phOffset = -0.15 + Math.random() * 0.3;
    // tempOffset pequeño (afecta la media local de la boya)
    const tempOffset = -1.2 + Math.random() * 2.4;
    // oxygenOffset pequeño
    const oxygenOffset = -0.6 + Math.random() * 1.2;

    // Inicializamos lastTemperature dentro del rango principal (media + offset)
    const initTemp = clamp(
      pickMean(tempParams.meanRange) + tempOffset,
      tempParams.meanRange[0],
      tempParams.meanRange[1]
    );

    map.set(id, {
      turbidityScale,
      conductivityOffset,
      phOffset,
      tempOffset,
      oxygenOffset,
      lastTemperature: initTemp,
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
  // anomalía simple: aleatoriamente por encima o por debajo con cierta magnitud
  if (Math.random() < anomalyRate) {
    const direction = Math.random() < 0.5 ? -1 : 1;
    const magnitude = Math.abs(randn_bm()) * std * anomalyMultiplier;
    let val = mean + direction * magnitude;
    val = clamp(val, providedLimits.absMin, providedLimits.absMax);
    return clamp(val, min, max);
  }

  // valor normal
  const sample = mean + randn_bm() * (std || 1);
  return clamp(sample, min, max);
}

/**
 * Genera la temperatura para una boya usando random-walk (poca variación entre lecturas)
 * - buoyBase: objeto de BUOY_BASES (contiene lastTemperature y tempOffset)
 * - tempParams contiene stepStd, maxStep, anomalyRate, anomalyRange, providedLimits
 */
function generateTemperatureForBuoy(buoyId, buoyBase = {}, params = tempParams) {
  const mean = pickMean(params.meanRange) + (buoyBase.tempOffset || 0);
  // Estado previo
  let current = typeof buoyBase.lastTemperature === "number" ? buoyBase.lastTemperature : mean;

  // Anomalía muy rara: salir ligeramente fuera del rango principal (poco probable)
  if (Math.random() < params.anomalyRate) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    // anomalía pequeña fuera del rango principal (ej. 0.05 .. anomalyRange)
    const over = 0.05 + Math.random() * params.anomalyRange;
    let candidate = dir < 0 ? params.meanRange[0] - over : params.meanRange[1] + over;
    // respetar límites absolutos
    candidate = clamp(candidate, params.providedLimits.absMin, params.providedLimits.absMax);
    // guardar y devolver (sin forzar al min/max "normal")
    buoyBase.lastTemperature = candidate;
    return candidate;
  }

  // Paso normal: small random step, con pequeña fuerza hacia la media para evitar drift
  let step = randn_bm() * params.stepStd;
  // limitar el paso a maxStep absoluto
  if (step > params.maxStep) step = params.maxStep;
  if (step < -params.maxStep) step = -params.maxStep;

  // fuerza de retorno: 2% hacia la media en cada paso (evita drifting acumulativo)
  const pullToMean = (mean - current) * 0.02;

  let nextTemp = current + step + pullToMean;
  // Asegurar que se mantenga dentro del rango "normal" [meanRange[0], meanRange[1]]
  nextTemp = clamp(nextTemp, params.meanRange[0], params.meanRange[1]);

  // actualizar estado en la base de la boya
  buoyBase.lastTemperature = nextTemp;
  return nextTemp;
}

/**
 * simulateSensorReading(buoyId)
 * - devuelve un objeto con pH, temperature, conductivity (µS/cm), oxygen, turbidity.
 */
export function simulateSensorReading(buoyId = 1) {
  const id = Number(buoyId) || 1;
  const isHigh = HIGH_PROFILE_IDS.has(id);

  const buoyBase = BUOY_BASES.get(id) || {
    turbidityScale: 1,
    conductivityOffset: 0,
    phOffset: 0,
    tempOffset: 0,
    oxygenOffset: 0,
    lastTemperature: pickMean(tempParams.meanRange),
  };

  // Conductividad (µS/cm)
  let cParams;
  if (isHigh) {
    cParams = conductivityParams.high;
  } else if ([2, 3, 4, 5].includes(id)) {
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

  // Temperatura: usamos random-walk por boya para suavizar variaciones
  const temperature = generateTemperatureForBuoy(id, buoyBase, tempParams);

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

  // Formato final: números con precisión razonable (mantengo 2 decimales)
  return {
    pH: Math.round((ph + Number.EPSILON) * 100) / 100,
    temperature: Math.round((temperature + Number.EPSILON) * 100) / 100,
    conductivity: Math.round((conductivity + Number.EPSILON) * 1000) / 1000, // µS/cm
    oxygen: Math.round((oxygen + Number.EPSILON) * 100) / 100,
    turbidity: Math.round((turbidity + Number.EPSILON) * 1000) / 1000,
  };
}