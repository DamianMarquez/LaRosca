import { Clock } from './core/clock.js';
import { Game } from './core/game.js';
import { fitView } from './core/city.js';
import { GameMap } from './map/map.js';
import { validate, validarFundacion, limpiarNombre, resumen, SAVE_KEY, MAX_BYTES } from './core/save.js';
import { renderPanel, renderStats, renderLog, renderEvento, renderFundacion, progresoMapa } from './ui/ui.js';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = new Clock();
let game = null, map = null, selected = null, tab = 'zona';
let CFG = null, PROV = null;

async function boot() {
  const load = u => fetch(u).then(r => r.json()).catch(() => null);
  [PROV, CFG] = await Promise.all([load('data/provincias.json'), load('data/game.json')]);
  for (const [k, f] of [['datos', 'provincias-datos'], ['historicos', 'resultados-historicos'], ['partidos', 'partidos'], ['eventos', 'eventos'], ['principios', 'principios'], ['rivales', 'rivales']]) CFG[k] = await load(`data/${f}.json`);
  setSpeed(0);
  showPicker();
  wireClock();
  wireSaveButtons();
  wirePanel();
  wireResizer();
  let last = performance.now();
  (function loop(now) {
    if (!game?.pending) clock.tick((now - last) / 1000);   // el tiempo espera la decisión del jugador
    last = now;
    if (game) refreshLive();
    requestAnimationFrame(loop);
  })(last);
}

// ---------- Layout: panel lateral de ancho ajustable ----------
const PANEL_KEY = 'larosca.panelw', PANEL_MIN = 320, PANEL_DEF = 420;
function setPanelWidth(px, persist = true) {
  const stage = $('.stage'), max = Math.max(PANEL_MIN, stage.clientWidth - 180);
  const w = Math.round(Math.min(max, Math.max(PANEL_MIN, px)));
  stage.style.setProperty('--panel-w', w + 'px');
  if (persist) try { localStorage.setItem(PANEL_KEY, String(w)); } catch {}
  return w;
}
function wireResizer() {
  const r = $('#resizer');
  let saved = PANEL_DEF; try { saved = Number(localStorage.getItem(PANEL_KEY)) || PANEL_DEF; } catch {}
  setPanelWidth(saved, false);
  addEventListener('resize', () => setPanelWidth(parseInt(getComputedStyle($('.stage')).getPropertyValue('--panel-w')) || PANEL_DEF, false));
  r.addEventListener('pointerdown', e => {
    r.setPointerCapture(e.pointerId);
    const move = ev => setPanelWidth($('.stage').getBoundingClientRect().right - ev.clientX, false);
    const up = ev => { r.releasePointerCapture(ev.pointerId); r.removeEventListener('pointermove', move); r.removeEventListener('pointerup', up); setPanelWidth($('.stage').getBoundingClientRect().right - ev.clientX); };
    r.addEventListener('pointermove', move); r.addEventListener('pointerup', up);
  });
  r.addEventListener('dblclick', () => setPanelWidth(PANEL_DEF));
  r.addEventListener('keydown', e => {
    const cur = $('.panel').getBoundingClientRect().width;
    if (e.key === 'ArrowLeft') { setPanelWidth(cur + 24); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setPanelWidth(cur - 24); e.preventDefault(); }
  });
}

// ---------- Guardado: autoguardado en el navegador + exportar/importar archivo JSON ----------
const readSave = () => {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    return d && !validate(d, CFG) ? d : null;
  } catch { return null; }
};
const autosave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch { /* sin almacenamiento: se puede exportar a mano */ } };

function continueButton() {
  const d = readSave();
  return d ? `<button id="continue" class="primary">Continuar: ${esc(resumen(d).partido)} · ${esc(resumen(d).provincia)} · ${Clock.format(d.day)}</button>` : '';
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

// ---------- Pantalla 1: elegir provincia ----------
function showPicker() {
  map = new GameMap($('#map'), PROV, {
    onSelect(id) {
      if (!id) return;
      map.select(id);
      const p = PROV.provincias.find(x => x.id === id), cap = CFG.capitales[id];
      $('#panel').innerHTML = `${continueButton()}<h2>${esc(p.nombre)}</h2><p class="muted">Capital: ${esc(cap.ciudad)} (~${cap.pop.toLocaleString('es-AR')} hab.)</p>
        <button id="found" class="primary">Fundar el partido aquí</button>`;
      $('#found').onclick = () => showFounding(id, p.nombre);
      wireContinue();
    },
  });
  $('#panel').innerHTML = `${continueButton()}<h2>Elegí tu provincia</h2><p class="muted">Vas a empezar desde la capital provincial, barrio por barrio.</p>`;
  wireContinue();
  $('#stats').textContent = '';
}

// ---------- Pantalla 2: fundación (nombre + principios) ----------
function showFounding(provId, provName, st = { nombre: '', principios: [], error: '' }) {
  const panel = $('#panel');
  panel.innerHTML = renderFundacion(CFG, provName, st);
  const name = $('#party-name');
  name.oninput = () => { st.nombre = name.value; st.error = ''; $('#founding-error').textContent = ''; };
  panel.querySelectorAll('[data-principio]').forEach(c => c.onchange = () => {
    st.nombre = name.value; st.error = '';
    const id = c.dataset.principio;
    st.principios = c.checked ? [...st.principios, id] : st.principios.filter(x => x !== id);
    showFounding(provId, provName, st);
  });
  $('#found-confirm').onclick = () => {
    const err = validarFundacion(name.value, st.principios, CFG);
    if (err) { st.error = err; $('#founding-error').textContent = err; return; }
    startGame(provId, provName, null, { nombre: limpiarNombre(name.value), principios: st.principios });
  };
  name.focus();
}

// ---------- Pantalla 3: la capital, dividida en barrios ----------
// saved: partida validada para continuar (o null) · partido: fundación de una partida nueva
async function startGame(provId, provName, saved = null, partido = null) {
  const city = await fetch(`data/ciudades/${provId}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const c = city && fitView(city);
  game = saved ? Game.fromJSON(CFG, saved, c) : new Game(CFG, provId, provName, c, partido);
  clock.day = game.day; clock.acc = 0;
  setSpeed(0);
  clock.onDay = () => {
    game.advanceDay();
    if (game.log[0]?.kind === 'promo' || game.pending) setSpeed(0);   // pausa ante hitos y eventos
    refreshAll();
  };
  const old = $('#map'), fresh = old.cloneNode(false);
  old.replaceWith(fresh);
  map = new GameMap(fresh, game.city, { onSelect(id) { selected = id; if (id) tab = 'zona'; map.select(id); refreshAll(); } });
  selected = null; tab = 'zona';
  document.body.classList.add('playing');
  refreshAll();
}

// Clicks del panel por delegación: pestañas y lanzamiento de misiones
function wirePanel() {
  $('#panel').addEventListener('click', e => {
    if (!game) return;
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; refreshAll(); return; }
    const b = e.target.closest('[data-start]');
    if (b && !b.disabled && game.start(b.dataset.start, selected, b.dataset.pago ?? 'blanco', b.dataset.modo ?? 'personal')) refreshAll();
  });
}

function refreshAll() {
  if (!game) return;
  const panel = $('#panel'), top = panel.scrollTop;
  $('#date').textContent = Clock.format(clock.day);
  map.paint(id => game.zonas[id].control);
  map.setBusy(new Set(game.jobs.map(j => j.zone)));
  $('#stats').innerHTML = renderStats(game);
  panel.innerHTML = renderPanel(game, selected, clock.day, tab);
  panel.scrollTop = top;                                   // no perder el lugar al refrescar
  $('#log').innerHTML = renderLog(game);
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

// Actualización fluida del avance entre días (panel y mapa)
function refreshLive() {
  const f = clock.acc;
  game.jobs.forEach((j, i) => {
    const frac = Math.min(1, Math.max(0, (clock.day - j.start + f) / (j.end - j.start)));
    const bar = document.querySelector(`[data-job-bar="${i}"]`), txt = document.querySelector(`[data-job-pct="${i}"]`);
    if (bar) bar.style.width = (frac * 100).toFixed(1) + '%';
    if (txt) txt.textContent = Math.round(frac * 100) + '%';
  });
  map.setProgress(progresoMapa(game, clock.day, f));
}

function setSpeed(s) {
  clock.setSpeed(s);
  document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === s));
}
function wireClock() {
  document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  addEventListener('keydown', e => {
    if (e.code === 'Space' && !/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); setSpeed(clock.speed ? 0 : 1); }
  });
  $('#date').textContent = Clock.format(0);
}

boot();
