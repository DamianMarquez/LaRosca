// Descarga límites de barrios de OpenStreetMap (ODbL) para cada capital provincial
// y los guarda como paths SVG en data/ciudades/<id>.json. Uso: node scripts/build-barrios.mjs [AR-X ...]
import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync('data/game.json', 'utf8'));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(cfg.capitales);
const W = 1000, MAX = 60, MIN = 8;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function overpass(q) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', headers: { 'User-Agent': 'game-prototype-data-fetch/0.1', Accept: '*/*', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(120000),
      });
      if (r.ok) return await r.json();
    } catch {}
    await sleep(8000 * (t + 1));
  }
  return null;
}

// Une segmentos (ways) en anillos cerrados
function rings(ways) {
  const segs = ways.map(w => w.slice()), out = [];
  const key = p => p.lon + ',' + p.lat;
  while (segs.length) {
    let ring = segs.pop(), grew = true;
    while (grew && key(ring[0]) !== key(ring.at(-1))) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (key(s[0]) === key(ring.at(-1))) ring = ring.concat(s.slice(1));
        else if (key(s.at(-1)) === key(ring.at(-1))) ring = ring.concat(s.slice(0, -1).reverse());
        else if (key(s.at(-1)) === key(ring[0])) ring = s.concat(ring.slice(1));
        else if (key(s[0]) === key(ring[0])) ring = s.slice(1).reverse().concat(ring);
        else continue;
        segs.splice(i, 1); grew = true; break;
      }
    }
    if (ring.length > 3 && key(ring[0]) === key(ring.at(-1))) out.push(ring);
  }
  return out;
}
const area = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

for (const id of ids) {
  const c = cfg.capitales[id];
  const hw = Math.min(0.2, Math.max(0.04, 0.04 + (c.pop / 1.5e6) * 0.16));
  const s = c.lat - hw, n = c.lat + hw, w = c.lon - hw, e = c.lon + hw;
  const q = `[out:json][timeout:100];(rel["boundary"="administrative"]["admin_level"~"^(9|10)$"](${s},${w},${n},${e});rel["place"~"^(neighbourhood|suburb|quarter)$"](${s},${w},${n},${e}););out geom;`;
  console.log(id, c.ciudad, 'bbox ±' + hw.toFixed(3));
  const j = await overpass(q);
  if (!j) { console.log('  sin respuesta, se usará Voronoi'); await sleep(5000); continue; }
  const cosφ = Math.cos(c.lat * Math.PI / 180), k = W / (2 * hw * cosφ), H = 2 * hw * k;
  const P = p => [(p.lon - w) * cosφ * k, (n - p.lat) * k];
  const seen = new Set(), zonas = [];
  for (const el of j.elements) {
    const name = el.tags?.name; if (!name || seen.has(name)) continue;
    const ways = el.members.filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry).map(m => m.geometry);
    const rs = rings(ways).map(r => r.map(P));
    if (!rs.length) continue;
    const ar = rs.reduce((a, r) => a + area(r), 0);
    if (ar > 0.25 * W * H || ar < 40) continue; // descarta la ciudad entera y manchas minúsculas
    let sx = 0, sy = 0, tot = 0;
    for (const r of rs) { const a = area(r); r.forEach(p => { sx += p[0] * a; sy += p[1] * a; }); tot += a * r.length; }
    const cx = sx / tot, cy = sy / tot;
    if (cx < 0 || cx > W || cy < 0 || cy > H) continue;
    seen.add(name);
    const d = rs.map(r => { let last = null; return 'M' + r.filter(p => !last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.8 ? (last = p) : false).map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z'; }).join('');
    zonas.push({ nombre: name, d, cx: +cx.toFixed(1), cy: +cy.toFixed(1), ar });
  }
  zonas.sort((a, b) => Math.hypot(a.cx - W / 2, a.cy - H / 2) - Math.hypot(b.cx - W / 2, b.cy - H / 2));
  const keep = zonas.slice(0, MAX);
  console.log('  barrios OSM:', zonas.length, '-> usados', keep.length);
  if (keep.length < MIN) { console.log('  cobertura insuficiente, se usará Voronoi'); await sleep(5000); continue; }
  // Población: reparto por área con sesgo de densidad hacia el centro
  const wts = keep.map(z => z.ar * (1.5 - Math.hypot(z.cx - W / 2, z.cy - H / 2) / W) ** 2);
  const sum = wts.reduce((a, b) => a + b, 0);
  keep.forEach((z, i) => { z.id = 'b' + i; z.pop = Math.max(100, Math.round(c.pop * wts[i] / sum / 100) * 100); delete z.ar; });
  fs.writeFileSync(`data/ciudades/${id}.json`, JSON.stringify({ ciudad: c.ciudad, fuente: 'OpenStreetMap contributors (ODbL)', viewBox: [0, 0, W, +H.toFixed(1)], zonas: keep }));
  await sleep(6000);
}
