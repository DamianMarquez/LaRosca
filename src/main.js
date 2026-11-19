import { Clock } from './core/clock.js';
import { Game } from './core/game.js';
import { fitView } from './core/city.js';
import { GameMap } from './map/map.js';
import { renderPanel, renderStats, renderLog } from './ui/ui.js';

const $ = s => document.querySelector(s);
const clock = new Clock();
let game = null, map = null, selected = null;

async function boot() {
  const [prov, cfg] = await Promise.all([
    fetch('data/provincias.json').then(r => r.json()),
    fetch('data/game.json').then(r => r.json()),
  ]);
  setSpeed(0);
  showPicker(prov, cfg);
  wireClock();
  let last = performance.now();
  (function loop(now) {
    clock.tick((now - last) / 1000);
    last = now;
    if (game) refreshLive();
    requestAnimationFrame(loop);
  })(last);
}

// Pantalla 1: elegir provincia (mapa del país)
function showPicker(prov, cfg) {
  const svg = $('#map');
  map = new GameMap(svg, prov, {
    onSelect(id) {
      if (!id) return;
      map.select(id);
      const p = prov.provincias.find(x => x.id === id), cap = cfg.capitales[id];
      $('#panel').innerHTML = `<h2>${p.nombre}</h2><p class="muted">Capital: ${cap.ciudad} (~${cap.pop.toLocaleString('es-AR')} hab.)</p>
        <button id="found" class="primary">Fundar el partido aquí</button>`;
      $('#found').onclick = () => begin(cfg, id, p.nombre);
    },
  });
  $('#panel').innerHTML = '<h2>Elegí tu provincia</h2><p class="muted">Vas a empezar desde la capital provincial, barrio por barrio.</p>';
  $('#stats').textContent = '';
}

// Pantalla 2: la capital, dividida en barrios
async function begin(cfg, provId, provName) {
  const city = await fetch(`data/ciudades/${provId}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  game = new Game(cfg, provId, provName, city && fitView(city));
  clock.day = 0; clock.acc = 0;
  clock.onDay = () => {
    game.advanceDay();
    if (game.log[0]?.kind === 'promo') setSpeed(0);   // pausa ante hitos
    refreshAll();
  };
  const old = $('#map'), fresh = old.cloneNode(false);
  old.replaceWith(fresh);
  map = new GameMap(fresh, game.city, { onSelect(id) { selected = id; map.select(id); refreshAll(); } });
  selected = null;
  document.body.classList.add('playing');
  refreshAll();
}

function refreshAll() {
  if (!game) return;
  $('#date').textContent = Clock.format(clock.day);
  map.paint(id => game.zonas[id].control);
  map.setBusy(new Set(game.jobs.map(j => j.zone)));
  $('#stats').innerHTML = renderStats(game);
  $('#panel').innerHTML = renderPanel(game, selected, clock.day);
  $('#log').innerHTML = renderLog(game);
  $('#panel').querySelectorAll('[data-start]').forEach(b => b.onclick = () => {
    if (game.start(b.dataset.start, selected)) refreshAll();
  });
}

// Actualización fluida de las barras de progreso entre días
function refreshLive() {
  const f = clock.acc;
  document.querySelectorAll('[data-job-bar]').forEach(el => {
    const j = game.jobs[+el.dataset.jobBar];
    if (j) el.style.width = Math.min(100, ((clock.day - j.start + f) / (j.end - j.start)) * 100) + '%';
  });
}

function setSpeed(s) {
  clock.setSpeed(s);
  document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === s));
}
function wireClock() {
  document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); setSpeed(clock.speed ? 0 : 1); } });
  $('#date').textContent = Clock.format(0);
}

boot();
