// Genera barrios sintéticos (celdas de Voronoi) para la capital de una provincia.
// Provisorio: se reemplazará por límites reales de barrios (OSM) más adelante.
export const CITY_W = 1000, CITY_H = 700;

function rng(seed) { // mulberry32
  let a = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Recorta un polígono con el semiplano {p : n·p <= c}
function clip(poly, nx, ny, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

// Ajusta el viewBox al área que realmente ocupan los barrios (datos OSM)
export function fitView(city) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const z of city.zonas) {
    const n = z.d.match(/-?\d+\.?\d*/g).map(Number);
    for (let i = 0; i < n.length; i += 2) {
      x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]);
      y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
    }
  }
  const p = Math.max(x1 - x0, y1 - y0) * 0.04;
  city.viewBox = [x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p].map(v => +v.toFixed(1));
  return city;
}

export function generateCity(provId, ciudad, pop) {
  const rand = rng(provId);
  const n = Math.max(12, Math.min(30, Math.round(pop / 60000) + 12));
  const cols = Math.ceil(Math.sqrt(n * CITY_W / CITY_H)), rows = Math.ceil(n / cols);
  const cw = CITY_W / cols, ch = CITY_H / rows;
  const sites = [];
  for (let r = 0; r < rows && sites.length < n; r++)
    for (let c = 0; c < cols && sites.length < n; c++)
      sites.push([(c + .2 + .6 * rand()) * cw, (r + .2 + .6 * rand()) * ch]);

  // Peso poblacional: más denso hacia el centro
  const cx = CITY_W / 2, cy = CITY_H / 2;
  const w = sites.map(([x, y]) => (1.6 - Math.hypot((x - cx) / CITY_W, (y - cy) / CITY_H) * 1.6) * (.6 + rand() * .8));
  const wSum = w.reduce((a, b) => a + b, 0);

  const barrios = sites.map((s, i) => {
    let poly = [[0, 0], [CITY_W, 0], [CITY_W, CITY_H], [0, CITY_H]];
    for (let j = 0; j < sites.length && poly.length; j++) {
      if (j === i) continue;
      const o = sites[j], nx = o[0] - s[0], ny = o[1] - s[1];
      poly = clip(poly, nx, ny, (nx * (s[0] + o[0]) + ny * (s[1] + o[1])) / 2);
    }
    const d = 'M' + poly.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
    return {
      id: `b${i}`, nombre: `Barrio ${i + 1}`, d,
      cx: s[0], cy: s[1],
      pop: Math.round((pop * w[i]) / wSum / 100) * 100,
      control: 0, trust: 0,
    };
  });
  const centro = barrios.reduce((m, b) => Math.hypot(b.cx - cx, b.cy - cy) < Math.hypot(m.cx - cx, m.cy - cy) ? b : m);
  centro.nombre = 'Centro';
  return { ciudad, viewBox: [0, 0, CITY_W, CITY_H], zonas: barrios };
}
