// Genera data/provincias.json (paths SVG) desde Natural Earth (dominio público).
// Uso: node scripts/build-map.mjs <ne_50m_admin_1.geojson>
import fs from 'node:fs';
const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const feats = src.features.filter(f => f.properties.admin === 'Argentina');
// Proyección equirectangular con corrección de latitud media (-38°)
const k = Math.cos(38 * Math.PI / 180), S = 12;
const P = ([lon, lat]) => [lon * k * S, -lat * S];
const rings = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
const out = feats.map(f => {
  let d = '', cx = 0, cy = 0, n = 0;
  for (const poly of rings(f.geometry)) for (const ring of poly) {
    ring.forEach((c, i) => {
      const [x, y] = P(c);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      cx += x; cy += y; n++;
    });
    d += 'Z';
  }
  return { id: f.properties.iso_3166_2 || f.properties.name, nombre: f.properties.name, d, cx: +(cx / n).toFixed(1), cy: +(cy / n).toFixed(1) };
});
const pad = 10;
fs.writeFileSync('data/provincias.json', JSON.stringify({
  viewBox: [minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad].map(v => +v.toFixed(1)),
  provincias: out,
}));
console.log(out.length, 'provincias', out.map(p => p.nombre).join(', '));
