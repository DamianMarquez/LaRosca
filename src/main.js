import { Clock } from './core/clock.js';
import { horaDe, noche, restante } from './core/hora.js';
import * as ofensivas from './core/ofensivas.js';
import * as el from './core/elecciones.js';
import { Game } from './core/game.js';
import { fitView } from './core/city.js';
import { GameMap } from './map/map.js';
import { validate, validarFundacion, limpiarNombre, resumen, SAVE_KEY, MAX_BYTES } from './core/save.js';
import { limpiarNombrePersona } from './core/personaje.js';
import { vistasDe, renderPanel, renderVistas, renderVista, renderInforme, renderStats, renderLog, renderEvento, renderFundacion, progresoMapa, marcasRivales, uiState } from './ui/ui.js';
import { initTooltips } from './ui/tooltip.js';
import { aplicarModo, setModo, toggleModo } from './ui/modo.js';
import { iniciarOnboarding } from './ui/onboarding.js';
import { renderAyuda, renderGuia } from './ui/ayuda.js';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = new Clock();
let game = null, map = null, selected = null, tab = 'zona', vista = 'mapa', tooltips = null;
const PAUSA_KEY = 'larosca.pausar';
let pausarAlTerminar = true;
const NOCHE_KEY = 'larosca.noche';
let simularNoche = (() => { try { return localStorage.getItem(NOCHE_KEY) !== '0'; } catch { return true; } })();   // preferencia del navegador: 'no' deja el mapa siempre de día
try { pausarAlTerminar = localStorage.getItem(PAUSA_KEY) !== '0'; } catch {}
let CFG = null, PROV = null;

async function boot() {
  const load = u => fetch(u).then(r => r.json()).catch(() => null);
  [PROV, CFG] = await Promise.all([load('data/provincias.json'), load('data/game.json')]);
  for (const [k, f] of [['datos', 'provincias-datos'], ['historicos', 'resultados-historicos'], ['partidos', 'partidos'], ['eventos', 'eventos'], ['principios', 'principios'], ['rivales', 'rivales'], ['linea', 'linea'], ['economia', 'economia'], ['trasfondos', 'trasfondos'], ['plantel', 'plantel'], ['escalafon', 'escalafon'], ['pactos', 'pactos'], ['habilidades', 'habilidades'], ['vida', 'vida'], ['organizacion', 'organizacion'], ['origenes', 'origenes'], ['elecciones', 'elecciones'], ['revelado', 'revelado'], ['calendario', 'calendario'], ['ofensivas', 'ofensivas'], ['movilidad', 'movilidad'], ['medios', 'medios'], ['ideologia', 'ideologia'], ['ayuda', 'ayuda']]) CFG[k] = await load(`data/${f}.json`);
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
    if (game && game.viajeTick(clock.acc)) refreshAll();          // llegaste: arranca la acción que esperaba
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
        <button id="found" class="primary">Empezar aquí</button>`;
      $('#found').onclick = () => showFounding(id, p.nombre);
      wireContinue();
    },
  });
  $('#panel').innerHTML = `${continueButton()}<h2>Elegí tu provincia</h2><p class="muted">Vas a empezar desde la capital provincial, barrio por barrio.</p>`;
  wireContinue();
  $('#stats').textContent = '';
}

// ---------- Pantalla 2: fundación (nombre + principios) ----------
function showFounding(provId, provName, st = { nombre: '', principios: [], trasfondo: CFG.trasfondos?.trasfondos.find(t => t.id === 'empleado_publico')?.id ?? CFG.trasfondos?.trasfondos[0]?.id, familia: 'soltero', estilo: 'equilibrado', puntos: {}, jugadorNombre: '', error: '', modo: 'fundador', partidoBase: null, origen: 'abajo', perfil: 'economista', desprendeDe: null, provId }) {
  const panel = $('#panel');
  const sc = []; for (let e = panel; e; e = e.parentElement) if (e.scrollTop) sc.push([e, e.scrollTop]);   // cada clic redibuja: se mantiene el scroll
  panel.innerHTML = renderFundacion(CFG, provName, st);
  for (const [e, t] of sc) e.scrollTop = t;
  const name = $('#party-name') ?? { value: st.nombre }, yo = $('#player-name');
  yo.oninput = () => { st.jugadorNombre = yo.value; };
  if ($('#party-name')) name.oninput = () => { st.nombre = name.value; st.error = ''; $('#founding-error').textContent = ''; };
  const guardar = () => { st.nombre = name.value; st.jugadorNombre = yo.value; st.error = ''; };
  panel.querySelectorAll('[data-modo-inicio]').forEach(c => c.onchange = () => { guardar(); st.modo = c.dataset.modoInicio; showFounding(provId, provName, st); });
  panel.querySelectorAll('[data-origen]').forEach(c => c.onchange = () => { guardar(); st.origen = c.dataset.origen; showFounding(provId, provName, st); });
  panel.querySelectorAll('[data-perfil]').forEach(c => c.onchange = () => { guardar(); st.perfil = c.dataset.perfil; showFounding(provId, provName, st); });
  panel.querySelectorAll('[data-desprende]').forEach(c => c.onchange = () => { guardar(); st.desprendeDe = c.dataset.desprende; showFounding(provId, provName, st); });
  panel.querySelectorAll('[data-base]').forEach(c => c.onchange = () => { guardar(); st.partidoBase = c.dataset.base; showFounding(provId, provName, st); });
  panel.querySelectorAll('[data-familia]').forEach(c => c.onchange = () => {
    st.nombre = name.value; st.jugadorNombre = yo.value; st.error = ''; st.familia = c.dataset.familia;
    showFounding(provId, provName, st);
  });
  panel.querySelectorAll('[data-estilo]').forEach(c => c.onchange = () => { guardar(); st.estilo = c.dataset.estilo; showFounding(provId, provName, st); });
  panel.querySelectorAll('[data-punto]').forEach(b => b.onclick = () => {
    guardar(); st.puntos ??= {}; const id = b.dataset.punto; st.puntos[id] = Math.max(0, (st.puntos[id] ?? 0) + +b.dataset.delta);
    showFounding(provId, provName, st);
  });
  panel.querySelectorAll('[data-trasfondo]').forEach(c => c.onchange = () => {
    st.puntos = {};
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
    const unirse = st.modo === 'afiliado', base = unirse ? CFG.partidos.partidos.find(p => p.id === st.partidoBase) : null;
    const err = unirse && !base ? 'Elegí el partido al que te sumás.' : validarFundacion(name.value, st.principios, CFG, st.trasfondo, st.familia, base?.id, unirse ? null : { origen: st.origen, perfil: st.perfil, desprendeDe: st.desprendeDe ?? CFG.partidos.partidos[0].id }, { estilo: st.estilo, puntos: st.puntos });
    if (err) { st.error = err; $('#founding-error').textContent = err; return; }
    startGame(provId, provName, null, unirse
      ? { progresivo: true, nombre: base.nombre, principios: base.principios, modo: 'afiliado', partidoBase: base.id, trasfondo: st.trasfondo, familia: st.familia, estilo: st.estilo, puntos: st.puntos, jugadorNombre: limpiarNombrePersona(yo.value) }
      : { progresivo: true, nombre: limpiarNombre(name.value), principios: st.principios, modo: 'fundador', origen: st.origen, perfil: st.perfil, desprendeDe: st.origen === 'desprendimiento' ? (st.desprendeDe ?? CFG.partidos.partidos[0].id) : null, trasfondo: st.trasfondo, familia: st.familia, estilo: st.estilo, puntos: st.puntos, jugadorNombre: limpiarNombrePersona(yo.value) });
  };
  if (!st.yaVisto) { name.focus?.({ preventScroll: true }); st.yaVisto = true; }   // el foco inicial no debe volver a mover el scroll
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
      setSpeed(0);
      uiState.informe = [...uiState.informe, ...inf].slice(-6);
    }
    refreshAll();
  };
  const old = $('#map'), fresh = old.cloneNode(false);
  old.replaceWith(fresh);
  map = new GameMap(fresh, game.city, { onHover: hoverMapa, onSelect(id) { selected = id; if (id) tab = 'zona'; map.select(id); refreshAll(); } });
  selected = null; tab = 'zona'; vista = 'mapa'; uiState.informe = []; uiState.ficha = null;
  $('#vistas').hidden = !game.ve('ui.vistas');
  document.body.classList.add('playing');
  refreshAll();
  iniciarOnboarding({ pasos: CFG.ayuda?.tour.comun ?? [], final: game.guia?.progresivo ? CFG.ayuda?.tour.final : null });
}

// Clicks del panel por delegación: pestañas y lanzamiento de misiones
function wirePanel() {
  const onPanelClick = e => {
    if (!game) return;
    const vs = e.target.closest('[data-vista]');
    if (vs) { if (vs.dataset.osubIr) uiState.osub = vs.dataset.osubIr; cambiarVista(vs.dataset.vista); return; }
    const ps = e.target.closest('[data-psub]');
    if (ps) { uiState.psub = ps.dataset.psub; refreshAll(); return; }
    const act = (sel, fn) => { const b = e.target.closest(sel); if (!b || b.disabled) return false; const err = fn(b); if (err) toast(err); refreshAll(); return true; };
    if (act('[data-el-toggle]', b => game.alternarCandidato(b.dataset.elToggle, b.dataset.q))) return;
    if (act('[data-el-auto]', b => game.armarLista(b.dataset.elAuto))) return;
    if (act('[data-el-presentar]', b => game.presentarLista(b.dataset.elPresentar))) return;
    if (act('[data-el-retirar]', b => game.retirarLista(b.dataset.elRetirar))) return;
    if (act('[data-el-lugar]', b => game.pedirLugar(b.dataset.elLugar))) return;
    if (act('[data-el-frente]', b => game.proponerFrente(b.dataset.elFrente))) return;
    if (act('[data-el-encuesta]', () => game.encargarEncuesta())) return;
    const mAb = e.target.closest('[data-mesa-abrir]'); if (mAb) { uiState.mesaForm.rid = uiState.mesaForm.rid === mAb.dataset.mesaAbrir ? null : mAb.dataset.mesaAbrir; refreshAll(); return; }
    const mSet = e.target.closest('[data-mesa-set]'); if (mSet) { const [k, v] = mSet.dataset.mesaSet.split('|'); const F = uiState.mesaForm; if (k === 'dinero') F.dinero = v === '1'; else if (k === 'lugares') F.lugares = +v; else F[k] = v; if (k === 'tipo') F.cid = null; refreshAll(); return; }
    if (act('[data-mesa-enviar]', b => { const F = uiState.mesaForm, conts = el.contiendasDe(game, game.elecciones.proceso.tipo).filter(c => el.cupoElegible(game, c) && !game.elecciones.proceso.cupos[c.id]); const err = game.ofrecerMesa(b.dataset.mesaEnviar, { tipo: F.tipo, cid: F.cid ?? conts[0]?.id, lugares: F.lugares, pago: F.pago, cabeza: F.cabeza, dinero: F.dinero }); if (!err) F.rid = null; return err; })) return;
    if (act('[data-mesa-resp]', b => { const [id, v] = b.dataset.mesaResp.split('|'); return game.responderMesa(+id, v === '1'); })) return;
    if (act('[data-mesa-retirar]', b => game.retirarMesa(+b.dataset.mesaRetirar))) return;
        const ofM = e.target.closest('[data-of-menu]'); if (ofM) { uiState.ofRival = uiState.ofRival === ofM.dataset.ofMenu ? null : ofM.dataset.ofMenu; refreshAll(); return; }
    const ofL = e.target.closest('[data-of-lanzar]'); if (ofL) { const err = ofensivas.lanzar(game, ofL.dataset.rival, selected, ofL.dataset.ofLanzar); if (err) { toast?.(err); } else uiState.ofRival = null; refreshAll(); return; }
    const calA = e.target.closest('[data-cal-anio]'); if (calA) { uiState.calAnio = +calA.dataset.calAnio; refreshAll(); return; }
    const calC = e.target.closest('[data-cal-cat]'); if (calC) { uiState.calCats[calC.dataset.calCat] = uiState.calCats[calC.dataset.calCat] === false; refreshAll(); return; }
    const calI = e.target.closest('[data-cal-ir]'); if (calI) { try { irA(JSON.parse(calI.dataset.calIr)); } catch { /* dato inválido */ } return; }
    const osub = e.target.closest('[data-osub]');
    if (osub) { uiState.osub = osub.dataset.osub; refreshAll(); return; }
    if (act('[data-org-tramite]', () => game.iniciarTramite())) return;
    if (act('[data-org-comite]', b => game.abrirComite(b.dataset.orgComite))) return;
    if (act('[data-org-medios]', b => game.aparecer(b.dataset.orgMedios))) return;
    const cup = e.target.closest('[data-cupo]');
    if (cup && !cup.disabled) { const [cid, host, L] = cup.dataset.cupo.split('|'); const err = game.proponerCupo(cid, host, +L, uiState.cupoPago ?? 'apoyo'); if (err) toast(err); refreshAll(); return; }
    const cpg = e.target.closest('[data-cupo-pago]');
    if (cpg) { uiState.cupoPago = cpg.dataset.cupoPago; refreshAll(); return; }
    if (act('[data-cupo-toggle]', b => game.alternarCupo(b.dataset.cupoToggle, b.dataset.q))) return;
    if (act('[data-cupo-auto]', b => game.armarCupo(b.dataset.cupoAuto))) return;
    if (act('[data-bloque-romper]', b => (confirm('Romper el bloque te deja con tus electos pero con un enemigo nuevo y menos confianza entre los demás partidos. ¿Seguro?') ? game.romperBloque(b.dataset.bloqueRomper) : null))) return;
    if (act('[data-org-cerrar]', b => game.cerrarComite(b.dataset.orgCerrar))) return;
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
    if (ir && !ir.disabled) {
      if (ir.dataset.ir === 'ayuda') { mostrarAyuda('progreso'); return; }
      if (ir.dataset.sub) uiState.datosSub = ir.dataset.sub;
      if (['partido', 'yo', 'organizacion', 'elecciones', 'calendario'].includes(ir.dataset.ir)) { if (ir.dataset.ir === 'partido') uiState.psub = 'resumen'; cambiarVista(ir.dataset.ir); } else { tab = ir.dataset.ir; cambiarVista('mapa'); }
      return;
    }
    const gok = e.target.closest('[data-guia-ok]');
    if (gok) { guiaVista(gok.dataset.guiaOk); refreshAll(); return; }
    const gab = e.target.closest('[data-ayuda-abrir]');
    if (gab) { mostrarAyuda(gab.dataset.ayudaAbrir); return; }
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
    const mm = e.target.closest('[data-mov-medio]');
    if (mm && !mm.disabled) { game.elegirMedio(mm.dataset.movMedio === game.movilidad.preferido ? null : mm.dataset.movMedio); refreshAll(); return; }
    const mu = e.target.closest('[data-mov-mudarse]');
    if (mu && !mu.disabled) { const err = game.mudarse(mu.dataset.movMudarse); if (err) toast(err); refreshAll(); return; }
    const mb = e.target.closest('[data-mov-comprar]');
    if (mb && !mb.disabled) { const err = game.comprarMovilidad(mb.dataset.movComprar); if (err) toast(err); refreshAll(); return; }
    if (e.target.closest('[data-mov-cancelar]')) { const err = game.cancelarViaje(); if (err) toast(err); refreshAll(); return; }
    const iv = e.target.closest('[data-inv]');
    if (iv) { const err = iv.dataset.inv === 'aceptar' ? game.aceptarInvitacion(iv.dataset.tipo) : game.rechazarInvitacion(iv.dataset.tipo); if (err) toast(err); refreshAll(); return; }
    const md = e.target.closest('[data-modalidad]');
    if (md) { game.elegirModalidad(md.dataset.modalidad, md.dataset.mod); uiState.abiertas.add(md.dataset.modalidad); refreshAll(); return; }
    const b = e.target.closest('[data-start]');
    if (b && !b.disabled && game.start(b.dataset.start, selected, b.dataset.pago ?? 'blanco', b.dataset.modo ?? 'personal', { modalidad: game.modalidad(game.mission(b.dataset.start))?.id })) refreshAll();
  };
  $('#panel').addEventListener('click', onPanelClick);
  $('#vista').addEventListener('click', onPanelClick);
  $('#vistas').addEventListener('click', onPanelClick);
  $('#stats').addEventListener('click', onPanelClick);
  $('#informe-root').addEventListener('click', e => {
    if (e.target.closest('[data-informe-continuar]')) { continuarInforme(); return; }
    const ir = e.target.closest('[data-informe-ir]');
    if (ir) { try { irA(JSON.parse(ir.dataset.informeIr)); } catch { /* dato inválido */ } return; }
    const z = e.target.closest('[data-informe-zona]');
    if (z && game.zonas[z.dataset.informeZona]) { selected = z.dataset.informeZona; tab = 'zona'; map.select(selected); cambiarVista('mapa'); }
  });
}

// Mini-guías de la primera vez en cada solapa (preferencia del navegador, no de la partida)
const GUIAS_KEY = 'larosca.guias';
function guiaVista(id, soloConsultar = false) {
  let vistas = []; try { vistas = JSON.parse(localStorage.getItem(GUIAS_KEY) ?? '[]'); } catch { /* sin almacenamiento */ }
  if (soloConsultar) return vistas.includes(id);
  if (!vistas.includes(id)) { vistas.push(id); try { localStorage.setItem(GUIAS_KEY, JSON.stringify(vistas)); } catch { /* sin almacenamiento */ } }
  return true;
}

// Solapas generales: el mapa queda vivo (zoom y selección) mientras se mira Partido o Yo
function cambiarVista(v) {
  if (!game || !vistasDe(game).some(([id]) => id === v)) return;
  vista = v;
  refreshAll();
}
// «Mostrame» de una tarjeta de desbloqueo: lleva al lugar y deja el juego en pausa
function irA(d) {
  if (!d?.vista || !game) return;
  if (d.vista === 'mapa') { tab = d.tab ?? 'zona'; } else if (d.vista === 'partido' && d.sub) uiState.psub = d.sub; else if (d.vista === 'organizacion' && d.sub) uiState.osub = d.sub;
  uiState.informe = [];
  cambiarVista(d.vista);
}
function continuarInforme() {
  if (!uiState.informe.length) return;
  uiState.informe = [];     // el juego sigue en pausa: reanuda el jugador
  refreshAll();
}

// Revelado progresivo: el body lleva una clase r-<id> por cada elemento revelado y el CSS oculta el resto
let clasesRevelado = [];
function sincronizarRevelado() {
  const b = document.body, G = game.guia;
  b.classList.toggle('progresivo', !!G?.progresivo);
  const nuevas = (G?.revelado ?? []).map(id => 'r-' + id.replace(/\./g, '-'));
  for (const c of clasesRevelado) if (!nuevas.includes(c)) b.classList.remove(c);
  for (const c of nuevas) b.classList.add(c);
  clasesRevelado = nuevas;
  // lo que no está disponible no se puede mostrar: vuelve a lo básico
  if (!vistasDe(game).some(([id]) => id === vista)) vista = 'mapa';
  if (!game.ve({ rivales: 'tab.rivales', datos: 'tab.datos' }[tab] ?? 'mision.base')) tab = 'zona';
  const vio = vista === 'mapa' ? { rivales: 'vio_rivales', datos: 'vio_datos' }[tab] : { yo: 'vio_yo', partido: 'vio_partido', organizacion: 'vio_org', elecciones: 'vio_elecciones', calendario: 'vio_calendario' }[vista];
  if (vio) game.vio(vio);
  game.marcarVisto(vista === 'mapa' ? { vista, tab } : vista === 'partido' ? { vista, sub: uiState.psub } : vista === 'organizacion' ? { vista, sub: uiState.osub } : { vista });
}

function refreshAll() {
  if (!game) return;
  sincronizarRevelado();
  const panel = $('#panel'), top = panel.scrollTop;
  $('#date').textContent = Clock.format(clock.day);
  pintarHora();
  map.paint(id => game.zonas[id].control);
  map.setBusy(new Set(game.jobs.map(j => j.zone)));
  map.setProgress(progresoMapa(game, clock.day, clock.acc));   // también en cada cambio, no solo por fotograma
  map.setRivalMarks(game.ve('map.rivales') ? marcasRivales(game) : []);
  $('#stats').innerHTML = renderStats(game);
  const gid = game.guia?.progresivo ? (vista === 'mapa' ? (['rivales', 'datos'].includes(tab) ? `tab:${tab}` : null) : `vista:${vista}`) : null;
  const cartel = gid && !guiaVista(gid, true) ? renderGuia(gid, CFG.ayuda) : '';
  panel.innerHTML = (vista === 'mapa' ? cartel : '') + renderPanel(game, selected, clock.day, tab);
  const navVistas = renderVistas(game, vista);
  $('#vistas').innerHTML = navVistas;
  $('#vistas').hidden = !navVistas;
  const ancha = vista !== 'mapa', vw = $('#vista'), vtop = vw.scrollTop;
  document.body.classList.toggle('vista-ancha', ancha);
  vw.hidden = !ancha;
  if (ancha) { vw.innerHTML = `<div class="vista-in vista-guia">${cartel}</div>` + renderVista(game, vista, clock.day); vw.scrollTop = vtop; }
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
// Hora del día: texto, arco de sol y oscuridad del mapa (sin re-render)
function pintarHora(f = clock.acc) {
  const H = horaDe(f), n = simularNoche ? noche(f) : 0, box = $('#hora');
  $('#hora-txt').textContent = H.texto; $('#franja').textContent = H.franja;
  const ang = Math.PI * Math.min(1, Math.max(0, (H.h + H.m / 60 - 5) / 16)), a = $('#astro');   // arco de 5 h a 21 h; de noche queda abajo a la izquierda
  const visible = H.h >= 5 && H.h < 21;
  a.setAttribute('cx', visible ? (22 - 19 * Math.cos(ang)).toFixed(1) : 3); a.setAttribute('cy', visible ? (22 - 19 * Math.sin(ang)).toFixed(1) : 22);
  box.classList.toggle('noche', simularNoche && (!visible || n > 0.6));
  const luz = $('#luz'); luz.style.setProperty('--noche', n.toFixed(2)); luz.classList.toggle('alba', simularNoche && (H.h >= 5 && H.h < 8 || H.h >= 18 && H.h < 21));
}

// Texto sobre el personaje mientras viaja: hacia dónde, cuánto falta y a qué hora llega
function etiquetaViaje(p) {
  if (!p?.viajando) return '';
  const llega = horaDe(p.llega - Math.floor(p.llega)).texto;
  return `${p.etapa === 'vuelta' ? 'Volviendo a casa' : 'Yendo a ' + p.destino} · ${restante(p.restante)} · llega ${llega}`;
}

function refreshLive() {
  const f = clock.acc;
  pintarHora(f);
  game.jobs.forEach((j, i) => {
    const frac = Math.min(1, Math.max(0, (clock.day - j.start + f) / (j.end - j.start)));
    document.querySelectorAll(`[data-job-bar="${i}"]`).forEach(bar => { bar.style.width = (frac * 100).toFixed(1) + '%'; });
    document.querySelectorAll(`[data-job-eta="${i}"]`).forEach(t => { t.textContent = restante(Math.max(0, j.end - clock.day - f)); });
    document.querySelectorAll(`[data-job-pct="${i}"]`).forEach(txt => { txt.textContent = Math.round(frac * 100) + '%'; });
  });
  map.setProgress(progresoMapa(game, clock.day, f));
  map.setViajero(game.posicionJugador(f), etiquetaViaje(game.posicionJugador(f)));
  document.querySelectorAll('[data-viaje-bar]').forEach(bar => { const p = game.posicionJugador(f); if (p?.viajando) { bar.style.width = (p.frac * 100).toFixed(1) + '%'; const t = document.querySelector('[data-viaje-eta]'); if (t) t.textContent = restante(p.restante); } });
  map.setRivalMarks(game.ve('map.rivales') ? marcasRivales(game) : []);
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

function mostrarAyuda(sec = 'como') {
  const root = $('#ayuda-root'), glos = CFG.glosario ?? {};
  if (game && clock.speed) setSpeed(0);                       // mientras leés, el tiempo no corre
  const atajos = [['Espacio', 'Pausa / seguir'], ['0 · 1 · 2 · 3', 'Pausa, x1, x2, x4'], ['+ / −', 'Subir / bajar velocidad'], ['Z · R · D', 'Panel del mapa: Zona, Rivales, Datos'], ['P · O · E · Y', 'Abrir o cerrar Partido, Organización, Elecciones o Yo'], ['Espacio / Enter', 'Cerrar el aviso (el juego sigue en pausa)'], ['M', 'Cambiar Rápido / Detallado'], ['?', 'Esta ayuda'], ['Esc', 'Cerrar']];
  const pintar = s => {
    uiState.ayudaSec = s;
    const cuerpo = root.querySelector('.ayuda-cuerpo'), top = cuerpo?.scrollTop ?? 0;
    root.innerHTML = renderAyuda(game, CFG.ayuda, glos, s, atajos);
    const c2 = root.querySelector('.ayuda-cuerpo'); if (c2 && cuerpo && s === uiState.ayudaSec) c2.scrollTop = top;
    root.querySelector('#cerrar-ayuda').onclick = cerrar;
    root.querySelector('[data-cerrar-ayuda]').onclick = e => { if (e.target.hasAttribute('data-cerrar-ayuda')) cerrar(); };
    root.querySelectorAll('[data-ayuda-sec]').forEach(b => b.onclick = () => pintar(b.dataset.ayudaSec));
    root.querySelectorAll('[data-ayuda-ir]').forEach(b => b.onclick = () => { try { const d = JSON.parse(b.dataset.ayudaIr); cerrar(); irA(d); } catch { /* dato inválido */ } });
    const tour = root.querySelector('[data-ayuda-tour]'); if (tour) tour.onclick = () => { cerrar(); iniciarOnboarding({ pasos: CFG.ayuda.tour.comun, final: game?.guia?.progresivo ? CFG.ayuda.tour.final : null, forzar: true }); };
    root.querySelector('.ayuda-nav .on')?.focus();
  };
  const cerrar = () => { root.innerHTML = ''; };
  pintar(sec);
}

function wireUI() {
  document.querySelectorAll('[data-modo-btn]').forEach(b => b.addEventListener('click', () => setModo(b.dataset.modoBtn)));
  $('#btn-ayuda').onclick = () => mostrarAyuda(uiState.ayudaSec ?? 'como');
  const bpr = $('#btn-progresivo'), pintaProg = () => { if (!game) { bpr.textContent = 'Modo progresivo: sí'; return; } bpr.textContent = `Modo progresivo: ${game.guia?.progresivo ? 'sí' : 'no (se ve todo)'}`; bpr.setAttribute('aria-checked', String(!!game.guia?.progresivo)); };
  bpr.onclick = () => { if (!game) return; game.setProgresivo(!game.guia.progresivo); pintaProg(); refreshAll(); };
  $('#menu-partida').addEventListener('toggle', pintaProg);
  const bn = $('#btn-noche'), pintaNoche = () => { bn.textContent = `Simular día y noche: ${simularNoche ? 'sí' : 'no'}`; bn.setAttribute('aria-checked', String(simularNoche)); };
  pintaNoche();
  bn.onclick = () => { simularNoche = !simularNoche; try { localStorage.setItem(NOCHE_KEY, simularNoche ? '1' : '0'); } catch {} pintaNoche(); if (game) pintarHora(); };
  const bp = $('#btn-pausa'), pintaPausa = () => { bp.textContent = `Pausar con avisos: ${pausarAlTerminar ? 'sí' : 'no'}`; bp.setAttribute('aria-checked', String(pausarAlTerminar)); };
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
    if ((k === '+' || k === '=' || k === '-') && game) { const v = [0, 1, 2, 4], i = v.indexOf(clock.speed); setSpeed(v[Math.min(3, Math.max(0, i + (k === '-' ? -1 : 1)))]); return; }
    if ({ 0: 0, 1: 1, 2: 2, 3: 4 }[k] !== undefined && game) { setSpeed({ 0: 0, 1: 1, 2: 2, 3: 4 }[k]); return; }
    if (k === 'm') { toggleModo(); return; }
    if (k === '?') { mostrarAyuda(uiState.ayudaSec ?? 'como'); return; }
    if (!game) return;
    if (k === 'p') { cambiarVista(vista === 'partido' ? 'mapa' : 'partido'); return; }
    if (k === 'y') { cambiarVista(vista === 'yo' ? 'mapa' : 'yo'); return; }
    if (k === 'o' && game?.org) { cambiarVista(vista === 'organizacion' ? 'mapa' : 'organizacion'); return; }
    if (k === 'e') { cambiarVista(vista === 'elecciones' ? 'mapa' : 'elecciones'); return; }
    const pestaña = { z: 'zona', r: 'rivales', d: 'datos' }[k];
    if (pestaña && game.ve({ rivales: 'tab.rivales', datos: 'tab.datos' }[pestaña] ?? 'mision.base')) { tab = pestaña; vista = 'mapa'; refreshAll(); }
  });
}

boot();
