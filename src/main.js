import { Clock } from './core/clock.js';
import { Game } from './core/game.js';
import { fitView } from './core/city.js';
import { GameMap } from './map/map.js';
import { validate, resumen, SAVE_KEY, MAX_BYTES } from './core/save.js';
import { renderPanel, renderStats, renderLog, renderEvento } from './ui/ui.js';

const $ = s => document.querySelector(s);
const clock = new Clock();
let game = null, map = null, selected = null;

let CFG = null, PROV = null;

async function boot() {
  const load = u => fetch(u).then(r => r.json()).catch(() => null);
  [PROV, CFG] = await Promise.all([load('data/provincias.json'), load('data/game.json')]);
  CFG.datos = await load('data/provincias-datos.json');
  CFG.historicos = await load('data/resultados-historicos.json');
  CFG.partidos = await load('data/partidos.json');
  CFG.eventos = await load('data/eventos.json');
  setSpeed(0);
  showPicker();
  wireClock();
  wireSaveButtons();
  let last = performance.now();
  (function loop(now) {
    if (!game?.pending) clock.tick((now - last) / 1000);   // el tiempo espera la decisión del jugador
    last = now;
    if (game) refreshLive();
    requestAnimationFrame(loop);
  })(last);
}

// --- Guardado: autoguardado en el navegador + exportar/importar archivo JSON ---
const readSave = () => {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    return d && !validate(d, CFG) ? d : null;
  } catch { return null; }
};
const autosave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch { /* sin almacenamiento: se puede exportar a mano */ } };

function continueButton() {
  const d = readSave();
  return d ? `<button id="continue" class="primary">Continuar: ${esc(resumen(d).provincia)} · ${Clock.format(d.day)}</button>` : '';
}
function wireContinue() {
  const b = $('#continue');
  if (b) b.onclick = () => startGame(readSave().prov.id, readSave().prov.nombre, readSave());
}

function exportGame() {
  if (!game) { toast('Todavía no hay una partida para exportar.'); return; }
  const url = URL.createObjectURL(new Blob([JSON.stringify(game, null, 1)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `larosca-${game.prov.id}-${Clock.format(game.day).replace(/ /g, '-')}.json` });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function importFile(file) {
  if (!file) return;
  if (file.size > MAX_BYTES) { toast('El archivo es demasiado grande para ser una partida.'); return; }
  let d;
  try { d = JSON.parse(await file.text()); } catch { toast('El archivo no es un JSON válido.'); return; }
  const err = validate(d, CFG);
  if (err) { toast(err); return; }
  if (game && !confirm('Se reemplazará la partida actual por la importada. ¿Continuar?')) return;
  await startGame(d.prov.id, d.prov.nombre, d);
  toast('Partida importada.');
}

function wireSaveButtons() {
  $('#btn-export').onclick = exportGame;
  $('#btn-import').onclick = () => $('#import-file').click();
  $('#import-file').onchange = e => { importFile(e.target.files[0]); e.target.value = ''; };
  $('#btn-new').onclick = () => {
    if (!confirm('Se borrará la partida guardada en este navegador. Exportala antes si querés conservarla. ¿Empezar de nuevo?')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    location.reload();
  };
}

let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Pantalla 1: elegir provincia (mapa del país)
function showPicker() {
  map = new GameMap($('#map'), PROV, {
    onSelect(id) {
      if (!id) return;
      map.select(id);
      const p = PROV.provincias.find(x => x.id === id), cap = CFG.capitales[id];
      $('#panel').innerHTML = `${continueButton()}<h2>${esc(p.nombre)}</h2><p class="muted">Capital: ${esc(cap.ciudad)} (~${cap.pop.toLocaleString('es-AR')} hab.)</p>
        <button id="found" class="primary">Fundar el partido aquí</button>`;
      $('#found').onclick = () => startGame(id, p.nombre);
      wireContinue();
    },
  });
  $('#panel').innerHTML = `${continueButton()}<h2>Elegí tu provincia</h2><p class="muted">Vas a empezar desde la capital provincial, barrio por barrio.</p>`;
  wireContinue();
  $('#stats').textContent = '';
}

// Pantalla 2: la capital, dividida en barrios. saved: partida validada para continuar (o null = partida nueva)
async function startGame(provId, provName, saved = null) {
  const city = await fetch(`data/ciudades/${provId}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const c = city && fitView(city);
  game = saved ? Game.fromJSON(CFG, saved, c) : new Game(CFG, provId, provName, c);
  clock.day = game.day; clock.acc = 0;
  setSpeed(0);
  clock.onDay = () => {
    game.advanceDay();
    if (game.log[0]?.kind === 'promo' || game.pending) setSpeed(0);   // pausa ante hitos y eventos
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
    if (game.start(b.dataset.start, selected, b.dataset.pago ?? 'blanco')) refreshAll();
  });
  showEvent();
  autosave();
}

// Muestra (o quita) el modal del evento pendiente; el juego queda en pausa hasta decidir
function showEvent() {
  $('#modal-root').innerHTML = renderEvento(game);
  $('#modal-root').querySelectorAll('[data-event-choice]').forEach(b => b.onclick = () => {
    if (game.choose(+b.dataset.eventChoice)) refreshAll();
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
