import { Clock } from './core/clock.js';
import { Game } from './core/game.js';
import { fitView } from './core/city.js';
import { GameMap } from './map/map.js';
import { validate, validarFundacion, limpiarNombre, resumen, SAVE_KEY, MAX_BYTES } from './core/save.js';
import { limpiarNombrePersona } from './core/personaje.js';
import { renderPanel, renderVistas, renderVista, renderInforme, renderStats, renderLog, renderEvento, renderFundacion, progresoMapa, marcasRivales, uiState } from './ui/ui.js';
import { initTooltips } from './ui/tooltip.js';
import { aplicarModo, setModo, toggleModo } from './ui/modo.js';
import { iniciarOnboarding } from './ui/onboarding.js';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = new Clock();
let game = null, map = null, selected = null, tab = 'zona', vista = 'mapa', tooltips = null;
const PAUSA_KEY = 'larosca.pausar';
let pausarAlTerminar = true, velPrevia = 1;
try { pausarAlTerminar = localStorage.getItem(PAUSA_KEY) !== '0'; } catch {}
let CFG = null, PROV = null;

async function boot() {
  const load = u => fetch(u).then(r => r.json()).catch(() => null);
  [PROV, CFG] = await Promise.all([load('data/provincias.json'), load('data/game.json')]);
  for (const [k, f] of [['datos', 'provincias-datos'], ['historicos', 'resultados-historicos'], ['partidos', 'partidos'], ['eventos', 'eventos'], ['principios', 'principios'], ['rivales', 'rivales'], ['linea', 'linea'], ['economia', 'economia'], ['trasfondos', 'trasfondos'], ['plantel', 'plantel'], ['escalafon', 'escalafon'], ['pactos', 'pactos'], ['habilidades', 'habilidades'], ['vida', 'vida']]) CFG[k] = await load(`data/${f}.json`);
  CFG.eventos.eventos.push(...(CFG.vida?.eventos ?? []));        // los eventos de vida los sortea el personaje, no el azar general
  CFG.glosario = await load('data/glosario.json');
  tooltips = initTooltips(CFG.glosario ?? {});
  aplicarModo();
  setSpeed(0);
  showPicker();
  wireClock();
  wireSaveButtons();
  wirePanel();
  wireUI();
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
    onHover: hoverMapa,
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
function showFounding(provId, provName, st = { nombre: '', principios: [], trasfondo: CFG.trasfondos?.trasfondos.find(t => t.id === 'empleado_publico')?.id ?? CFG.trasfondos?.trasfondos[0]?.id, familia: 'soltero', jugadorNombre: '', error: '' }) {
  const panel = $('#panel');
  panel.innerHTML = renderFundacion(CFG, provName, st);
  const name = $('#party-name'), yo = $('#player-name');
  yo.oninput = () => { st.jugadorNombre = yo.value; };
  name.oninput = () => { st.nombre = name.value; st.error = ''; $('#founding-error').textContent = ''; };
  panel.querySelectorAll('[data-familia]').forEach(c => c.onchange = () => {
    st.nombre = name.value; st.jugadorNombre = yo.value; st.error = ''; st.familia = c.dataset.familia;
    showFounding(provId, provName, st);
  });
  panel.querySelectorAll('[data-trasfondo]').forEach(c => c.onchange = () => {
    st.nombre = name.value; st.jugadorNombre = yo.value; st.error = ''; st.trasfondo = c.dataset.trasfondo;
    showFounding(provId, provName, st);
  });
  panel.querySelectorAll('[data-principio]').forEach(c => c.onchange = () => {
    st.nombre = name.value; st.jugadorNombre = yo.value; st.error = '';
    const id = c.dataset.principio;
    st.principios = c.checked ? [...st.principios, id] : st.principios.filter(x => x !== id);
    showFounding(provId, provName, st);
  });
  $('#found-confirm').onclick = () => {
    const err = validarFundacion(name.value, st.principios, CFG, st.trasfondo, st.familia);
    if (err) { st.error = err; $('#founding-error').textContent = err; return; }
    startGame(provId, provName, null, { nombre: limpiarNombre(name.value), principios: st.principios, trasfondo: st.trasfondo, familia: st.familia, jugadorNombre: limpiarNombrePersona(yo.value) });
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
    const inf = game.informes?.splice(0) ?? [];
    if (inf.length && pausarAlTerminar) {                                 // terminó algo: pausa y muestra el resultado
      if (clock.speed) velPrevia = clock.speed;
      setSpeed(0);
      uiState.informe = [...uiState.informe, ...inf].slice(-6);
    }
    refreshAll();
  };
  const old = $('#map'), fresh = old.cloneNode(false);
  old.replaceWith(fresh);
  map = new GameMap(fresh, game.city, { onHover: hoverMapa, onSelect(id) { selected = id; if (id) tab = 'zona'; map.select(id); refreshAll(); } });
  selected = null; tab = 'zona'; vista = 'mapa'; uiState.informe = []; uiState.ficha = null; velPrevia = 1;
  $('#vistas').hidden = false;
  document.body.classList.add('playing');
  refreshAll();
  iniciarOnboarding();
}

// Clicks del panel por delegación: pestañas y lanzamiento de misiones
function wirePanel() {
  const onPanelClick = e => {
    if (!game) return;
    const vs = e.target.closest('[data-vista]');
    if (vs) { cambiarVista(vs.dataset.vista); return; }
    const ps = e.target.closest('[data-psub]');
    if (ps) { uiState.psub = ps.dataset.psub; refreshAll(); return; }
    const pf = e.target.closest('[data-persona]');
    if (pf) { uiState.ficha = pf.dataset.persona; refreshAll(); document.querySelector('.ficha')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    if (e.target.closest('[data-cerrar-ficha]')) { uiState.ficha = null; refreshAll(); return; }
    const pfl = e.target.closest('[data-pfiltro]');
    if (pfl) { uiState.pfiltro = pfl.dataset.pfiltro; refreshAll(); return; }
    const pod = e.target.closest('[data-pord]');
    if (pod) { uiState.pord = pod.dataset.pord; refreshAll(); return; }
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; refreshAll(); return; }
    const ir = e.target.closest('[data-ir]');                              // franja "Ahora": ir directo a donde hay que decidir
    if (ir && !ir.disabled) { if (ir.dataset.sub) uiState.datosSub = ir.dataset.sub; if (['partido', 'yo'].includes(ir.dataset.ir)) { if (ir.dataset.ir === 'partido') uiState.psub = 'resumen'; cambiarVista(ir.dataset.ir); } else { tab = ir.dataset.ir; cambiarVista('mapa'); } return; }
    const sub = e.target.closest('[data-sub]');
    if (sub) { uiState.datosSub = sub.dataset.sub; refreshAll(); return; }
    const hab = e.target.closest('[data-habilidad]');
    if (hab && !hab.disabled) { const err = game.invertirHabilidad(hab.dataset.habilidad); if (err) toast(err); refreshAll(); return; }
    const trb = e.target.closest('[data-trabajo]');
    if (trb && !trb.disabled) {
      if (trb.dataset.trabajo === 'sin' && !confirm('Dejar el trabajo corta tu ingreso propio y no se puede revertir por tu cuenta. ¿Seguro?')) return;
      const err = game.cambiarTrabajo(trb.dataset.trabajo); if (err) toast(err); refreshAll(); return;
    }
    if (e.target.closest('[data-descansar]') && !e.target.closest('[data-descansar]').disabled) { const err = game.descansar(); if (err) toast(err); refreshAll(); return; }
    const mas = e.target.closest('[data-mas]');                            // "…" de una misión (modo Rápido)
    if (mas) { const id = mas.dataset.mas; uiState.abiertas.has(id) ? uiState.abiertas.delete(id) : uiState.abiertas.add(id); refreshAll(); return; }
    if (e.target.closest('[data-ascender]')) { const b = e.target.closest('[data-ascender]'); if (!b.disabled) { const err = game.ascender(); if (err) toast(err); else { setSpeed(0); refreshAll(); } } return; }
    const ds = e.target.closest('[data-designar]');
    if (ds && !ds.disabled) { const err = game.designar(ds.dataset.designar, ds.dataset.cand); if (err) toast(err); refreshAll(); return; }
    const dl = e.target.closest('[data-delegar]');
    if (dl && !dl.disabled) { const err = game.delegar(dl.dataset.delegar); if (err) toast(err); refreshAll(); return; }
    const rt = e.target.closest('[data-retomar]');
    if (rt && !rt.disabled) { const err = game.retomar(rt.dataset.retomar); if (err) toast(err); refreshAll(); return; }
    const cp = e.target.closest('[data-captar]');
    if (cp && !cp.disabled) { const err = game.captarCuadro(cp.dataset.captar, cp.dataset.mid, cp.dataset.con); if (err) toast(err); refreshAll(); return; }
    const pt = e.target.closest('[data-pacto]');
    if (pt && !pt.disabled) { const r = game.proponerPacto(pt.dataset.pacto, pt.dataset.tipo, { zona: selected, con: pt.dataset.con }); toast(r.error ?? r.texto); refreshAll(); return; }
    const fv = e.target.closest('[data-favor]');
    if (fv && !fv.disabled) { if (game.pagarFavor(fv.dataset.favor, fv.dataset.con)) refreshAll(); return; }
    const ln = e.target.closest('[data-linea]');
    if (ln) { if (game.responderDirectiva(ln.dataset.linea === 'aceptar')) refreshAll(); return; }
    const b = e.target.closest('[data-start]');
    if (b && !b.disabled && game.start(b.dataset.start, selected, b.dataset.pago ?? 'blanco', b.dataset.modo ?? 'personal')) refreshAll();
  };
  $('#panel').addEventListener('click', onPanelClick);
  $('#vista').addEventListener('click', onPanelClick);
  $('#vistas').addEventListener('click', onPanelClick);
  $('#informe-root').addEventListener('click', e => {
    if (e.target.closest('[data-informe-continuar]')) { continuarInforme(); return; }
    const z = e.target.closest('[data-informe-zona]');
    if (z && game.zonas[z.dataset.informeZona]) { selected = z.dataset.informeZona; tab = 'zona'; map.select(selected); cambiarVista('mapa'); }
  });
}

// Solapas generales: el mapa queda vivo (zoom y selección) mientras se mira Partido o Yo
function cambiarVista(v) {
  vista = v;
  refreshAll();
}
function continuarInforme() {
  if (!uiState.informe.length) return;
  uiState.informe = [];
  setSpeed(velPrevia || 1);
  refreshAll();
}

function refreshAll() {
  if (!game) return;
  const panel = $('#panel'), top = panel.scrollTop;
  $('#date').textContent = Clock.format(clock.day);
  map.paint(id => game.zonas[id].control);
  map.setBusy(new Set(game.jobs.map(j => j.zone)));
  map.setProgress(progresoMapa(game, clock.day, clock.acc));   // también en cada cambio, no solo por fotograma
  map.setRivalMarks(marcasRivales(game));
  $('#stats').innerHTML = renderStats(game);
  panel.innerHTML = renderPanel(game, selected, clock.day, tab);
  $('#vistas').innerHTML = renderVistas(game, vista);
  const ancha = vista !== 'mapa', vw = $('#vista'), vtop = vw.scrollTop;
  document.body.classList.toggle('vista-ancha', ancha);
  vw.hidden = !ancha;
  if (ancha) { vw.innerHTML = renderVista(game, vista, clock.day); vw.scrollTop = vtop; }
  $('#informe-root').innerHTML = renderInforme(uiState.informe);
  tooltips?.revisar();
  panel.scrollTop = top;                                   // no perder el lugar al refrescar
  $('#log').innerHTML = renderLog(game);
  $('#leyenda').hidden = false;
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
    document.querySelectorAll(`[data-job-bar="${i}"]`).forEach(bar => { bar.style.width = (frac * 100).toFixed(1) + '%'; });
    document.querySelectorAll(`[data-job-pct="${i}"]`).forEach(txt => { txt.textContent = Math.round(frac * 100) + '%'; });
  });
  map.setProgress(progresoMapa(game, clock.day, f));
  map.setRivalMarks(marcasRivales(game));
}

function setSpeed(s) {
  if (s > 0 && uiState.informe.length) { uiState.informe = []; $('#informe-root').innerHTML = ''; }   // seguir jugando descarta el aviso
  clock.setSpeed(s);
  document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === s));
}
function wireClock() {
  document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  $('#date').textContent = Clock.format(0);
}

// ---------- Interfaz general: modo, ayuda, menú, registro, secciones, hover del mapa y atajos ----------
function hoverMapa(id, x, y) {
  const el = $('#maphover');
  if (!id) { el.hidden = true; return; }
  const wrap = $('.mapa-wrap').getBoundingClientRect();
  let html;
  if (game) {
    const z = game.zonas[id]; if (!z) { el.hidden = true; return; }
    html = `<b>${esc(z.nombre)}</b><br>Control ${Math.round(z.control * 100)}% · ${z.pop.toLocaleString('es-AR')} hab.`;
    const rivales = Object.entries(game.bots).filter(([, b]) => b.accion?.zona === id).map(([rid, b]) => `${esc(game.rival(rid).nombre)}: ${esc((b.accion.tipo === 'propia' ? '' : b.accion.fase === 'planeada' ? 'prepara ' : '') + (b.accion.tipo === 'propia' ? game.cfg.rivales.propias : game.cfg.rivales.acciones).find(a => a.id === b.accion.accion).nombre.toLowerCase())}`);
    if (rivales.length) html += `<br><small>${rivales.join('<br>')}</small>`;
  } else {
    const p = PROV?.provincias.find(q => q.id === id); if (!p) { el.hidden = true; return; }
    html = `<b>${esc(p.nombre)}</b><br>Capital: ${esc(CFG.capitales[id]?.ciudad ?? '')}`;
  }
  el.innerHTML = html; el.hidden = false;
  el.style.left = Math.min(x - wrap.left + 14, wrap.width - 200) + 'px'; el.style.top = Math.max(8, y - wrap.top - 10) + 'px';
}

function mostrarAyuda() {
  const root = $('#ayuda-root'), g = CFG.glosario ?? {};
  const atajos = [['Espacio', 'Pausa / seguir'], ['0 · 1 · 2 · 3', 'Pausa, x1, x2, x4'], ['Z · R · D', 'Panel del mapa: Zona, Rivales, Datos'], ['P · Y', 'Abrir o cerrar la vista Partido o Yo'], ['Espacio / Enter', 'Continuar cuando termina una acción'], ['M', 'Cambiar Rápido / Detallado'], ['?', 'Esta ayuda'], ['Esc', 'Cerrar']];
  root.innerHTML = `<div class="modal" data-cerrar-ayuda><div class="card ayuda" role="dialog" aria-modal="true" aria-label="Ayuda y glosario">
    <div class="ayuda-head"><h2>Ayuda</h2><button id="cerrar-ayuda" aria-label="Cerrar ayuda">✕</button></div>
    <p class="muted small-p">Modo <b>Rápido</b>: lo esencial. Modo <b>Detallado</b>: todos los números y explicaciones. Pasá el mouse (o enfocá con Tab) sobre cualquier dato subrayado para ver qué significa.</p>
    <h3>Atajos de teclado</h3><div class="kv">${atajos.map(([k, d]) => `<span><kbd>${esc(k)}</kbd></span><b>${esc(d)}</b>`).join('')}</div>
    <h3>Glosario</h3><dl class="glosario">${Object.values(g).map(x => `<dt>${esc(x.titulo)}</dt><dd>${esc(x.texto)}</dd>`).join('')}</dl></div></div>`;
  const cerrar = () => { root.innerHTML = ''; };
  root.querySelector('#cerrar-ayuda').onclick = cerrar;
  root.querySelector('[data-cerrar-ayuda]').onclick = e => { if (e.target.hasAttribute('data-cerrar-ayuda')) cerrar(); };
  root.querySelector('#cerrar-ayuda').focus();
}

function wireUI() {
  document.querySelectorAll('[data-modo-btn]').forEach(b => b.addEventListener('click', () => setModo(b.dataset.modoBtn)));
  $('#btn-ayuda').onclick = mostrarAyuda;
  const bp = $('#btn-pausa'), pintaPausa = () => { bp.textContent = `Pausar al terminar: ${pausarAlTerminar ? 'sí' : 'no'}`; bp.setAttribute('aria-checked', String(pausarAlTerminar)); };
  pintaPausa();
  bp.onclick = () => { pausarAlTerminar = !pausarAlTerminar; try { localStorage.setItem(PAUSA_KEY, pausarAlTerminar ? '1' : '0'); } catch {} pintaPausa(); };
  const menu = $('#menu-partida');                                  // el menú se cierra al elegir algo o al tocar afuera
  menu.addEventListener('click', e => { if (e.target.closest('.menu button')) menu.open = false; });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.open = false; });
  // Registro: filtro y "ver más"
  $('#log').addEventListener('click', e => {
    const f = e.target.closest('[data-log-filtro]'), t = e.target.closest('[data-log-toggle]');
    if (f) uiState.logFiltro = f.dataset.logFiltro; else if (t) uiState.logAbierto = !uiState.logAbierto; else return;
    $('#log').innerHTML = renderLog(game);
  });
  // Secciones plegables de la zona: recordar cuáles dejó abiertas
  $('#panel').addEventListener('toggle', e => { const sec = e.target.dataset?.sec; if (sec) uiState.secs[sec] = e.target.open; }, true);
  // Atajos de teclado (no se activan mientras se escribe)
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { $('#ayuda-root').innerHTML = ''; return; }
    if ((e.code === 'Space' || k === 'enter') && uiState.informe.length && !/BUTTON|SUMMARY/.test(e.target.tagName)) { e.preventDefault(); continuarInforme(); return; }
    if (e.code === 'Space' && !/BUTTON|SUMMARY/.test(e.target.tagName)) { e.preventDefault(); setSpeed(clock.speed ? 0 : 1); return; }
    if ({ 0: 0, 1: 1, 2: 2, 3: 4 }[k] !== undefined && game) { setSpeed({ 0: 0, 1: 1, 2: 2, 3: 4 }[k]); return; }
    if (k === 'm') { toggleModo(); return; }
    if (k === '?') { mostrarAyuda(); return; }
    if (!game) return;
    if (k === 'p') { cambiarVista(vista === 'partido' ? 'mapa' : 'partido'); return; }
    if (k === 'y') { cambiarVista(vista === 'yo' ? 'mapa' : 'yo'); return; }
    const pestaña = { z: 'zona', r: 'rivales', d: 'datos' }[k];
    if (pestaña) { tab = pestaña; vista = 'mapa'; refreshAll(); }
  });
}

boot();
