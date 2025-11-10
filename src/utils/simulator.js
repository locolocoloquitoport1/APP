// ======== ESTADO PERSISTENTE DE CONDUCTIVIDAD ========
// Mantiene la última base por cada boya entre llamadas sucesivas
const conductivityState = {};

export function simulateSensorReading(buoyId = 1) {
  // Desfase pseudoaleatorio único por boya
  const offset = (buoyId * 13.37) % 7;

  // ======== Rangos base físicos ========
  const phBase = 7.6 + offset * 0.015;
  const tempBase = 29.5 + offset * 0.03; // menor variación térmica
  const oxyBase = 5.2 - offset * 0.08;
  const turbBase = 70 + offset * 3;

  // ==== CONDUCTIVIDAD BASE AJUSTADA SEGÚN UBICACIÓN ====
  const seaBuoys = [1, 6, 7];
  let conductivityBase;

  // Si la boya tiene un estado previo, lo usamos como base
  if (conductivityState[buoyId] !== undefined) {
    conductivityBase = conductivityState[buoyId];
    // Le agregamos una pequeña deriva suave, evitando saltos bruscos
    const drift =
      seaBuoys.includes(buoyId) ? randBetween(-150, 150) : randBetween(-300, 300);
    conductivityBase = clamp(conductivityBase + drift, 5000, 30000);
  } else {
    // Primera lectura (inicializa la base según ubicación)
    if (seaBuoys.includes(buoyId)) {
      conductivityBase = 26000 + Math.sin(Date.now() / 1.5e7 + buoyId) * 800;
    } else {
      conductivityBase = 8000 + Math.sin(Date.now() / 1.5e7 + buoyId) * 1200;
    }
  }

  // Guardamos el nuevo valor para la próxima llamada
  conductivityState[buoyId] = conductivityBase;

  // Pequeñas variaciones instantáneas sobre el patrón
  const conductivity = noise(
    conductivityBase,
    seaBuoys.includes(buoyId) ? 400 : 700
  );

  // ======== Generación normal (ruido físico leve) ========
  const pH = noise(phBase, 0.3);
  const temperature = noise(tempBase, 0.25);
  const oxygen = noise(oxyBase, 0.6);
  const turbidity = Math.abs(noise(turbBase, 15));

  // ======== Generación aleatoria de anomalías (~6%) ========
  if (Math.random() < 0.06) {
    const anomalyType = weightedChoice([
      ["turbidity", 0.45],
      ["conductivity", 0.25],
      ["temperature", 0.15],
      ["oxygen", 0.1],
      ["pH", 0.05],
    ]);

    let anom = { pH, temperature, conductivity, oxygen, turbidity };

    switch (anomalyType) {
      case "pH":
        anom.pH = round(pH + (Math.random() > 0.5 ? 2.5 : -3.0));
        break;
      case "temperature":
        anom.temperature = round(temperature + randBetween(4, 12));
        break;
      case "conductivity":
        anom.conductivity = round(conductivity + randBetween(4000, 10000));
        break;
      case "oxygen":
        anom.oxygen = round(Math.max(0.5, oxygen - randBetween(2, 4)));
        break;
      case "turbidity":
        anom.turbidity = round(turbidity + randBetween(100, 250));
        break;
      default:
        break;
    }

    return {
      pH: clamp(round(anom.pH, 2), 4, 12),
      temperature: clamp(round(anom.temperature, 2), 0, 50),
      conductivity: clamp(round(anom.conductivity, 2), 0, 40000),
      oxygen: clamp(round(anom.oxygen, 2), 0, 12),
      turbidity: clamp(round(anom.turbidity, 2), 0, 500),
    };
  }

  // ======== Lectura normal ========
  return {
    pH: round(clamp(pH, 7.0, 8.8), 2),
    temperature: round(clamp(temperature, 28, 32), 2),
    conductivity: round(clamp(conductivity, 5000, 30000), 2),
    oxygen: round(clamp(oxygen, 3.5, 6.8), 2),
    turbidity: round(clamp(turbidity, 40, 250), 2),
  };
}

// ======== Funciones auxiliares ========

function noise(mean, sd) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * sd;
}

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

function round(v, digits = 2) {
  const m = Math.pow(10, digits);
  return Math.round(v * m) / m;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Selección ponderada (para escoger tipo de anomalía)
function weightedChoice(weightedOptions) {
  const total = weightedOptions.reduce((sum, [, w]) => sum + w, 0);
  const r = Math.random() * total;
  let accum = 0;
  for (const [value, weight] of weightedOptions) {
    accum += weight;
    if (r <= accum) return value;
  }
  return weightedOptions[0][0];
}
