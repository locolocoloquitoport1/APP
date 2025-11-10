// Simulación avanzada de sensores de calidad de agua
// con ligeras variaciones entre boyas para realismo

export function simulateSensorReading(buoyId = 1) {
  // Offset pseudoaleatorio por boya (para diferenciar lecturas)
  const offset = (buoyId * 13.37) % 7;

  // Baseline de condiciones (físicamente coherentes)
  const pH = noise(7.5 + offset * 0.01, 0.45);
  const temperature = noise(29.2 + offset * 0.02, 0.6); // Menor variación
  const conductivityBase =
    buoyId === 1 || buoyId === 6 || buoyId === 7
      ? 25000 // Mayor conductividad en estas boyas
      : 12000;
  const conductivity = noise(conductivityBase, 2000);
  const oxygen = noise(5.3 - offset * 0.05, 0.9);
  const turbidity = Math.abs(noise(50 + offset * 2, 20));

  // Inyección aleatoria de anomalías (≈6%)
  if (Math.random() < 0.06) {
    return {
      pH: round(pH + (Math.random() > 0.5 ? 2.5 : -3.0)),
      temperature: round(temperature + randBetween(4, 10)),
      conductivity: round(conductivity + randBetween(3000, 8000)),
      oxygen: round(oxygen - randBetween(2, 5)),
      turbidity: Math.max(0.1, round(turbidity + randBetween(60, 200))),
    };
  }

  // Lectura normal
  return {
    pH: round(pH, 2),
    temperature: round(temperature, 2),
    conductivity: round(conductivity, 2),
    oxygen: round(oxygen, 2),
    turbidity: round(turbidity, 2),
  };
}

// === Funciones auxiliares ===

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
