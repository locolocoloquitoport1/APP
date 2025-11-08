// simple sensor simulation helpers used by App.js and testing
export function simulateSensorReading() {
  // baseline "normal" ranges
  const pH = noise(7.5, 0.45);
  const temperature = noise(28.4, 1.3);
  const conductivity = noise(3.1, 0.6);
  const oxygen = noise(6.4, 1.2);
  const turbidity = Math.abs(noise(8.5, 6.0));

  // occasionally create anomalies
  if (Math.random() < 0.06) {
    // spike or drop
    return {
      pH: round(pH + (Math.random() > 0.5 ? 2.5 : -3.0)),
      temperature: round(temperature + randBetween(4, 10)),
      conductivity: round(conductivity + randBetween(2, 6)),
      oxygen: round(oxygen - randBetween(2, 5)),
      turbidity: Math.max(0.1, round(turbidity + randBetween(30, 120)))
    }
  }

  return {
    pH: round(pH),
    temperature: round(temperature),
    conductivity: round(conductivity, 3),
    oxygen: round(oxygen, 3),
    turbidity: round(turbidity, 2)
  }
}

function noise(mean, sd) {
  // simple gaussian noise (Box-Muller)
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * sd;
}

function randBetween(a,b){ return a + Math.random()*(b-a) }

function round(v, digits = 2) {
  const m = Math.pow(10, digits);
  return Math.round(v*m)/m;
}
