// Simulador de lecturas de sensores para las boyas.
// Esta versión genera valores realistas y, con cierta probabilidad,
// fuerza una variable a estar ligeramente fuera del rango "normal"
// (pero no demasiado).
//
// Exporta: simulateSensorReading(buoyId) -> { pH, temperature, conductivity, oxygen, turbidity }

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Genera una lectura para una boya.
 * - Los valores base están centrados en rangos realistas.
 * - Con probabilidad `anomProb` se marca UNA variable como "ligeramente anómala",
 *   desplazándola fuera del rango normal entre un 5% y un 15% del span.
 *
 * Las unidades son:
 * - conductivity: µS/cm (como esperaba la lógica en App)
 * - temperature: °C
 * - oxygen: mg/L
 * - turbidity: NTU
 * - pH: escala pH
 */
export function simulateSensorReading(buoyId = 1) {
  // Rangos "normales" (los mismos usados en App para etiquetado)
  const normal = {
    pH: [7.0, 8.8],
    temperature: [28, 32], // °C
    conductivity: [5000, 30000], // µS/cm
    oxygen: [3.5, 6.8], // mg/L
    turbidity: [40, 250], // NTU
  };

  // Valores base (centro del rango) y ruido pequeño para variabilidad natural
  const base = {
    pH: (normal.pH[0] + normal.pH[1]) / 2,
    temperature: (normal.temperature[0] + normal.temperature[1]) / 2,
    conductivity: (normal.conductivity[0] + normal.conductivity[1]) / 2,
    oxygen: (normal.oxygen[0] + normal.oxygen[1]) / 2,
    turbidity: (normal.turbidity[0] + normal.turbidity[1]) / 2,
  };

  // Introducimos un pequeño sesgo por boya para dar variedad entre boyas
  const buoyBias = (Math.sin(buoyId * 1.7) + 1) / 2; // 0..1
  const timeBias = Math.sin(Date.now() / 10000 + buoyId) * 0.5; // -0.5..0.5

  // Ruido natural en torno al valor base (muy leve)
  const natural = {
    pH: base.pH + rand(-0.15, 0.15) + (buoyBias - 0.5) * 0.05 + timeBias * 0.02,
    temperature: base.temperature + rand(-0.6, 0.6) + (buoyBias - 0.5) * 0.2 + timeBias * 0.3,
    conductivity: base.conductivity + rand(-400, 400) + (buoyBias - 0.5) * 200 + timeBias * 50,
    oxygen: base.oxygen + rand(-0.25, 0.25) + (buoyBias - 0.5) * 0.1 + timeBias * 0.05,
    turbidity: base.turbidity + rand(-6, 6) + (buoyBias - 0.5) * 4 + timeBias * 2,
  };

  // Decidir si generamos una anomalía ligera y en qué variable (solo UNA variable)
  const anomProb = 0.28; // ~28% de lecturas tendrán una variable fuera de rango
  const keys = ["pH", "temperature", "conductivity", "oxygen", "turbidity"];
  let anomalyKey = null;
  if (Math.random() < anomProb) {
    anomalyKey = keys[Math.floor(rand(0, keys.length))];
  }

  // Empujar ligeramente fuera de rango: entre 5% y 15% del span
  const final = { ...natural };
  if (anomalyKey) {
    const range = normal[anomalyKey];
    const span = Math.max(range[1] - range[0], 1);
    const pctBeyond = rand(0.05, 0.15); // 5%..15%
    // Decidir dirección: por debajo del mínimo o por encima del máximo (según natural)
    const dir = Math.random() < 0.5 ? -1 : 1;

    if (dir === -1) {
      // colocar ligeramente por debajo del mínimo (pero no dramáticamente)
      final[anomalyKey] = range[0] - span * pctBeyond + rand(-0.02 * span, 0.02 * span);
    } else {
      // por encima del máximo
      final[anomalyKey] = range[1] + span * pctBeyond + rand(-0.02 * span, 0.02 * span);
    }
  }

  // Asegurar algunos límites razonables (por si el ruido produce valores absurdos)
  final.pH = Number(clamp(final.pH, 0, 14).toFixed(2));
  final.temperature = Number(clamp(final.temperature, -5, 40).toFixed(2));
  final.conductivity = Math.round(clamp(final.conductivity, 0, 1e6)); // µS/cm entero
  final.oxygen = Number(clamp(final.oxygen, 0, 20).toFixed(2));
  final.turbidity = Number(clamp(final.turbidity, 0, 5000).toFixed(1));

  return {
    pH: final.pH,
    temperature: final.temperature,
    conductivity: final.conductivity,
    oxygen: final.oxygen,
    turbidity: final.turbidity,
  };
}