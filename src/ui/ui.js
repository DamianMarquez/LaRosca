// Vistas HTML (cadenas). Sin estado propio.
import { rivales as rivalesDe, amenaza, presencia, efectosActivos, choques, agenda, certeza, presenciaCiudad, defAccion } from '../core/rivals.js';
import { progreso as progresoDirectiva, etiqueta as etiquetaRelacion } from '../core/linea.js';
import * as plantel from '../core/plantel.js';
import { nombreVacante, cargoDef, titular, probCaptar } from '../core/plantel.js';
import { relacion as relacionRival, pactoCon, tipoDef, etiquetaRelacion as etiquetaRel } from '../core/pactos.js';
import { NOMBRE_MAX } from '../core/save.js';
import { consejos } from '../core/consejos.js';
import { perfil } from '../core/electoral.js';
import { ico } from './iconos.js';
import { renderElecciones } from './elecciones.js';
import { ve, nuevoVista, nuevoTab, nuevoSub } from '../core/revelado.js';
import { renderOrganizacion } from './organizacion.js';
import { diasHastaGeneral, FASE_NOMBRE } from '../core/elecciones.js';
import * as personaje from '../core/personaje.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const pct = v => Math.round(v * 100) + '%';
const approx5 = v => '~' + Math.round(v * 20) * 5 + '%';          // estimaciones: nunca exactas
import { restante } from '../core/hora.js';
import * as of from '../core/ofensivas.js';
import { renderCalendario } from './calendario.js';
const jobFrac = (j, day, acc = 0) => Math.min(1, Math.max(0, (day - j.start + acc) / (j.end - j.start)));

export const TABS = [['zona', 'Zona'], ['rivales', 'Rivales'], ['datos', 'Datos']];       // panel lateral (depende del mapa)
export const vistasDe = g => [['mapa', 'Mapa'], ...(ve(g, 'vista.partido') ? [['partido', 'Partido']] : []), ...(g.org && ve(g, 'vista.organizacion') ? [['organizacion', 'Organización']] : []), ...(ve(g, 'vista.elecciones') ? [['elecciones', 'Elecciones']] : []), ...(ve(g, 'vista.calendario') ? [['calendario', 'Calendario']] : []), ...(ve(g, 'vista.yo') ? [['yo', 'Yo']] : [])];   // solapas generales (Organización: solo quien fundó)
export const partidoSubs = g => (g.modo === 'fundador' ? [['resumen', 'Resumen'], ['organigrama', 'Estructura'], ['personas', 'Personas'], ['principios', 'Principios']] : [['resumen', 'Resumen'], ['organigrama', 'Organigrama'], ['personas', 'Personas'], ['escalafon', 'Escalafón'], ['linea', 'Línea'], ['principios', 'Principios']])
  .filter(([id]) => ve(g, { organigrama: 'partido.estructura', escalafon: 'partido.escalafon', linea: 'partido.linea' }[id] ?? 'vista.partido'));

// Estado de la interfaz que sobrevive a los refrescos (no es parte de la partida)
export const uiState = { abiertas: new Set(), secs: { terr: true, recaud: false, ilegal: false, rivZona: false }, datosSub: 'finanzas', logFiltro: 'todo', logAbierto: false, osub: 'estado', ofRival: null, mesaForm: { rid: null, tipo: 'frente', cid: null, lugares: 1, pago: 'apoyo', cabeza: 'yo', dinero: false }, calAnio: null, calCats: {}, ayudaSec: 'como', cupoPago: 'apoyo', psub: 'resumen', ficha: null, pfiltro: 'todos', pord: 'cargo', informe: [] };

// ---------- Barra superior: tres grupos (rango · recursos · fuerza) con tooltips; lo que vale cero no se muestra ----------
export function renderStats(g) {
  const p = g.player, next = g.nextXp, flujo = g.flujo.neto, voto = g.intencionVoto * 100;
  const chip = (tip, icono, html, cls = '') => `<span class="chip ${cls}" tabindex="0" data-tip="${tip}">${ico(icono)}${html}</span>`;
  const v = id => ve(g, id);
  const rangoVisible = g.modo === 'fundador' ? v('hud.influencia') : v('hud.rango');
  return `${rangoVisible ? `<div class="grp">${chip('rango', 'rango', `<b>${esc(g.rankName)}</b>${next && g.modo !== 'fundador' ? `<small class="detalle">${Math.floor(p.xp)}/${next} XP</small>` : ''}`)}</div>` : ''}
    <div class="grp">${chip('dinero', 'dinero', `<b>${money(p.money)}</b>${v('hud.flujo') ? `<small class="${flujo < 0 ? 'neg' : 'pos'}">${flujo >= 0 ? '+' : '−'}${money(Math.abs(flujo))}/mes</small>` : ''}`, p.money < 0 ? 'rojo' : '')}
      ${p.black > 0 && v('hud.negro') ? chip('negro', 'negro', `<b>${money(p.black)}</b>`) : ''}
      ${g.exposure >= 1 && v('hud.negro') ? chip('exposicion', 'alerta', `<b>${Math.round(g.exposure)}%</b>`, g.exposure >= 60 ? 'hi' : g.exposure >= 30 ? 'mid' : '') : ''}</div>
    <div class="grp">${v('hud.afiliados') ? chip('afiliados', 'afiliados', `<b>${g.afiliados.toLocaleString('es-AR')}</b>`) : ''}
      ${v('hud.seguidores') ? chip('seguidores', 'seguidores', `<b>${g.followers.toLocaleString('es-AR')}</b>`, 'detalle') : ''}
      ${v('hud.voto') ? chip('voto', 'voto', `<b>${voto.toFixed(voto < 1 ? 2 : 1)}%</b>`) : ''}</div>
    ${v('hud.elecciones') ? renderChipElecciones(g) : ''}`;
}

// Cuenta regresiva de la próxima elección
function renderChipElecciones(g) {
  const P = g.elecciones?.proceso, d = diasHastaGeneral(g);
  if (!P || d === null || d < 0) return '';
  const cerca = ['listas', 'campana', 'veda'].includes(P.fase);
  return `<div class="grp"><button class="chip chip-el ${cerca ? 'mid' : ''}" data-vista="elecciones" data-tip-texto="${esc(`Elecciones ${P.anio}: ${FASE_NOMBRE[P.fase]}. Faltan ${d} días para votar.`)}">${ico('voto')}<b>${d} d</b><small class="detalle">${esc(FASE_NOMBRE[P.fase])}</small></button></div>`;
}

// ---------- Fundación del partido ----------
export function renderFundacion(cfg, provincia, estado) {
  const cat = cfg.principios.principios, k = cfg.principios.elegir, unirse = estado.modo === 'afiliado';
  const cards = cat.map(p => {
    const on = estado.principios.includes(p.id), full = estado.principios.length >= k && !on;
    return `<label class="principle ${on ? 'on' : ''} ${full ? 'off' : ''}">
      <input type="checkbox" data-principio="${esc(p.id)}" ${on ? 'checked' : ''} ${full ? 'disabled' : ''}>
      <span><b>${esc(p.nombre)}</b><br><small>${esc(p.texto)}</small><br><small class="muted">${esc(modsTexto(p, cfg))}</small></span></label>`;
  }).join('');
  const ps = cfg.partidos.partidos.filter(p => p.id !== 'otros');
  const hist = estado.provId ? perfilElectoral(cfg, estado.provId)[0] : null;
  const rivales = ps.map(p =>
    `<div class="rival-line"><span class="dot" style="background:${p.color}"></span><span><b>${esc(p.nombre)}</b> · <small class="muted">${esc(p.principios.map(id => cat.find(c => c.id === id)?.nombre).join(', '))}</small></span></div>`).join('');
  const modos = `<h3>¿Cómo empezás?</h3><div class="principles">
    <label class="principle ${!unirse ? 'on' : ''}"><input type="radio" name="modo" data-modo-inicio="fundador" ${!unirse ? 'checked' : ''}><span><b>Fundar un partido</b><br><small>Sos la cabeza desde el día 1: no tenés superiores, tenés que construir todo. Elegís cómo arrancás: como figura pública, desde abajo o rompiendo con otro partido.</small></span></label>
    <label class="principle ${unirse ? 'on' : ''}"><input type="radio" name="modo" data-modo-inicio="afiliado" ${unirse ? 'checked' : ''}><span><b>Sumarme a un partido</b><br><small>Entrás como afiliado a un partido que ya existe y vas subiendo en su escalafón, con un superior y una línea partidaria.</small></span></label></div>`;
  const bases = unirse ? `<h3>¿A qué partido te sumás?</h3><div class="principles">${ps.map(p => {
    const v = hist?.partidos?.[p.id];
    return `<label class="principle ${estado.partidoBase === p.id ? 'on' : ''}"><input type="radio" name="base" data-base="${esc(p.id)}" ${estado.partidoBase === p.id ? 'checked' : ''}>
      <span><span class="dot" style="background:${p.color}"></span> <b>${esc(p.nombre)}</b><br><small>${esc(p.espacio)}</small><br><small class="muted">${esc(p.principios.map(id => cat.find(c => c.id === id)?.nombre).join(', '))}</small>${v != null ? `<br><small class="muted">En ${esc(provincia)} sacó ${pct(v)} en ${esc(hist.año)}</small>` : ''}</span></label>`;
  }).join('')}</div>` : '';
  const oris = cfg.origenes?.origenes ?? [], ori = estado.origen ?? 'abajo';
  const origenHtml = unirse || !oris.length ? '' : `<h3>Tu origen</h3><div class="principles">${oris.map(o => `<label class="principle ${ori === o.id ? 'on' : ''}"><input type="radio" name="origen" data-origen="${esc(o.id)}" ${ori === o.id ? 'checked' : ''}><span><b>${esc(o.nombre)}</b><br><small>${esc(o.texto)}</small></span></label>`).join('')}</div>
    ${ori === 'figura' ? `<h3>¿Qué tipo de figura pública sos?</h3><div class="principles">${cfg.origenes.perfiles.map(p => `<label class="principle ${(estado.perfil ?? 'economista') === p.id ? 'on' : ''}"><input type="radio" name="perfil" data-perfil="${esc(p.id)}" ${(estado.perfil ?? 'economista') === p.id ? 'checked' : ''}><span><b>${esc(p.nombre)}</b><br><small>${esc(p.texto)}</small><br><small class="muted">Notoriedad ${p.fama} · ${money(p.dinero)} · ${p.contactos} contactos · ${p.cuadros} cuadro${p.cuadros === 1 ? '' : 's'}</small></span></label>`).join('')}</div>` : ''}
    ${ori === 'desprendimiento' ? `<h3>¿De qué partido te vas?</h3><div class="principles">${ps.map(p => `<label class="principle ${(estado.desprendeDe ?? ps[0].id) === p.id ? 'on' : ''}"><input type="radio" name="desprende" data-desprende="${esc(p.id)}" ${(estado.desprendeDe ?? ps[0].id) === p.id ? 'checked' : ''}><span><span class="dot" style="background:${p.color}"></span> <b>${esc(p.nombre)}</b><br><small class="muted">${esc(p.espacio)}</small></span></label>`).join('')}</div>` : ''}`;
  const bloqueFundar = unirse ? '' : `<label class="field">Nombre del partido
      <input id="party-name" type="text" maxlength="${NOMBRE_MAX}" value="${esc(estado.nombre)}" placeholder="Ej.: Vecinos en Acción" autocomplete="off"></label>`;
  const principiosHtml = unirse ? '' : `<h3>Tus principios (elegí ${k}) · ${estado.principios.length}/${k}</h3>
    <div class="principles">${cards}</div>
    <p class="muted small">Son la identidad de tu partido: marcan cómo trabajás y qué te cuesta. Más adelante serán la base de tus habilidades.</p>
    <h3>Otros partidos y lo que defienden</h3>${rivales}`;
  return `<div class="city">${unirse ? 'Afiliación' : 'Fundación'} · ${esc(provincia)}</div><h2>${unirse ? 'Sumate a un partido' : 'Fundá tu partido'}</h2>
    ${modos}${bases}${origenHtml}${bloqueFundar}
    <label class="field">Tu nombre <small class="muted">(opcional)</small>
      <input id="player-name" type="text" maxlength="30" value="${esc(estado.jugadorNombre ?? '')}" placeholder="Si lo dejás vacío, te ponemos uno" autocomplete="off"></label>
    <h3>Tu situación familiar</h3>
    <div class="principles">${(cfg.vida?.familia ?? []).map(f => `<label class="principle ${estado.familia === f.id ? 'on' : ''}">
      <input type="radio" name="familia" data-familia="${esc(f.id)}" ${estado.familia === f.id ? 'checked' : ''}>
      <span><b>${esc(f.nombre)}</b><br><small>${esc(f.texto)}</small></span></label>`).join('')}</div>
    <h3>Tu trasfondo: de qué vivís</h3>
    <div class="principles">${(cfg.trasfondos?.trasfondos ?? []).map(t => `<label class="principle ${estado.trasfondo === t.id ? 'on' : ''}">
      <input type="radio" name="trasfondo" data-trasfondo="${esc(t.id)}" ${estado.trasfondo === t.id ? 'checked' : ''}>
      <span><b>${esc(t.nombre)}</b><br><small>${esc(t.texto)}</small><br><small class="muted">${esc(trasfondoTexto(t, cfg))}</small></span></label>`).join('')}</div>
    ${principiosHtml}
    <p id="founding-error" class="error" role="alert">${esc(estado.error ?? '')}</p>
    <button id="found-confirm" class="primary">${unirse ? 'Sumarme' : 'Fundar el partido'}</button>`;
}

const perfilElectoral = (cfg, provId) => perfil(cfg.historicos, cfg.partidos?.partidos ?? [], provId);

// Resumen legible de un trasfondo: qué da y qué cuesta
export function trasfondoTexto(t, cfg) {
  const out = [`Aporte ${money(t.ingresoMensual)}/mes`, `ahorros ${money(t.dineroInicial)}`];
  if (t.duracionMult > 1) out.push(`tus acciones duran +${Math.round((t.duracionMult - 1) * 100)}%`);
  if (t.duracionMult < 1) out.push(`tus acciones duran −${Math.round((1 - t.duracionMult) * 100)}%`);
  if (t.donMult > 1) out.push(`recaudás +${Math.round((t.donMult - 1) * 100)}%`);
  if (t.gastoMult < 1) out.push(`gastos fijos −${Math.round((1 - t.gastoMult) * 100)}%`);
  if (t.escandaloMult < 1) out.push(`los escándalos te pegan ${Math.round((1 - t.escandaloMult) * 100)}% menos`);
  for (const [id, v] of Object.entries(t.chance ?? {})) out.push(`${cfg.missions.find(m => m.id === id)?.nombre ?? id} ${v > 0 ? '+' : ''}${v}% éxito`);
  return out.join(' · ');
}

// Resumen legible de los efectos de un principio
export function modsTexto(p, cfg) {
  const x = p.mods ?? {}, out = [];
  for (const [id, v] of Object.entries(x.chance ?? {})) out.push(`${cfg.missions.find(m => m.id === id)?.nombre ?? id} ${v > 0 ? '+' : ''}${v}% éxito`);
  if (x.expoMult > 1) out.push(`Dinero negro: exposición ×${x.expoMult}`);
  if (x.expoMult < 1) out.push(`Dinero negro: exposición ×${x.expoMult}`);
  if (x.negroConfianzaMult < 1) out.push('Con dinero negro ganás menos confianza');
  if (x.alcanceMult > 1) out.push(`Alcance de misiones +${Math.round((x.alcanceMult - 1) * 100)}%`);
  return out.join(' · ');
}

// ---------- Eventos ----------
export function renderEvento(g) {
  const ev = g.pending;
  if (!ev) return '';
  const ops = ev.opciones.map((op, i) => {
    const c = op.costo ?? {}, parts = [];
    if (c.money) parts.push(money(c.money) + ' blancos');
    if (c.black) parts.push(money(c.black) + ' negros');
    if (op.azar) parts.push(Math.round(op.azar.p * 100) + '% de salir bien');
    const lock = (c.money ?? 0) > 0 && c.money > g.player.money ? 'Falta dinero blanco' : (c.black ?? 0) > 0 && c.black > g.player.black ? 'Falta dinero negro' : null;
    return `<button data-event-choice="${i}" ${lock ? 'disabled' : ''}>${esc(op.label)}<small>${esc(lock ?? (parts.join(' · ') || 'Sin costo'))}</small></button>`;
  }).join('');
  return `<div class="modal"><div class="card ${ev.tipo === 'escandalo' ? 'scandal' : ''}"><h2>${esc(ev.titulo)}</h2><p>${esc(ev.texto)}</p><div class="choices">${ops}</div></div></div>`;
}

// ---------- Acciones en curso (siempre visibles arriba del panel) ----------
export function renderAcciones(g, day) {
  const jobs = g.jobs.map((j, i) => {
    const m = g.mission(j.mission), f = jobFrac(j, day);
    return `<div class="job" data-job-zone="${esc(j.zone)}">
      <div class="job-head"><b>${esc(m.nombre)}</b><span class="badge">${ico(j.modo === 'delegada' ? 'equipo' : 'persona')}${j.modo === 'delegada' ? 'Equipo' : 'Vos'}${j.pago === 'negro' ? ' · negro' : ''}</span></div>
      <div class="job-sub">${esc(g.zonas[j.zone].nombre)} · termina en <span data-job-eta="${i}">${restante(Math.max(0, j.end - day))}</span></div>
      <div class="bar big"><i data-job-bar="${i}" style="width:${(f * 100).toFixed(1)}%"></i><span data-job-pct="${i}">${Math.round(f * 100)}%</span></div></div>`;
  }).join('');
  const desc = g.jugador.descanso, free = g.freeSlots > 0;
  const descTxt = desc ? `<div class="job"><div class="job-head"><b>Descansando</b><span class="badge">${ico('persona')}Vos</span></div><div class="job-sub">Recuperás fuerzas · terminás en ${Math.max(0, desc.hasta - day)} d</div></div>` : '';
  const equipo = !ve(g, 'hud.equipo') ? '' : g.equipo > 0 ? `<span tabindex="0" data-tip="equipo">${ico('equipo')}Equipo ${g.freeEquipo}/${g.equipo}</span>` : `<span class="detalle" tabindex="0" data-tip="equipo">${ico('equipo')}Equipo desde ${esc(g.rangos[g.cfg.delegacion.rangoMin])}</span>`;
  return `<section class="actions"><div class="actions-head"><h3>En curso</h3>
      <span class="slots"><span class="${free ? 'free' : 'busy-txt'}" tabindex="0" data-tip="accion">${ico('persona')}${desc ? 'Descansando' : free ? 'Libre' : 'Ocupado'}</span> ${equipo}</span></div>
    ${descTxt}${jobs || (desc ? '' : '<p class="muted">Sin acciones en curso. Sos una sola persona: una acción personal a la vez.</p>')}</section>`;
}

// ---------- Pestañas ----------
export function renderPanel(g, zoneId, day, tab = 'zona') {
  const cs = consejos(g);
  const pendiente = id => cs.some(c => c.tab === id && c.nivel !== 'info');
  const visibles = TABS.filter(([id]) => ve(g, { rivales: 'tab.rivales', datos: 'tab.datos' }[id] ?? 'mision.base'));
  const tabs = visibles.length < 2 ? '' : `<nav class="tabs" role="tablist">${visibles.map(([id, label]) => `<button role="tab" data-tab="${id}" class="${id === tab ? 'on' : ''}" aria-selected="${id === tab}">${label}${nuevoTab(g, id) ? ' <span class="nuevo">Nuevo</span>' : ''}${pendiente(id) ? ' <span class="ping" role="img" aria-label="hay algo pendiente">●</span>' : ''}</button>`).join('')}</nav>`;
  const body = tab === 'datos' && ve(g, 'tab.datos') ? renderDatos(g) : tab === 'rivales' && ve(g, 'tab.rivales') ? renderTabRivales(g, zoneId) : renderZona(g, zoneId);
  return `<div class="city">${esc(g.partido.nombre)} · ${esc(g.city.ciudad)}, ${esc(g.prov.nombre)}</div>${renderAcciones(g, day)}${renderAhora(cs)}${tabs}<div class="tab-body">${body}</div>`;
}

// ---------- Solapas generales: Mapa · Partido · Yo ----------
export function renderVistas(g, vista) {
  const cs = consejos(g);
  const ping = id => cs.some(c => (id === 'mapa' ? ['zona', 'rivales', 'datos'].includes(c.tab) : c.tab === id) && c.nivel !== 'info');
  if (!ve(g, 'ui.vistas')) return '';
  return vistasDe(g).map(([id, label]) => `<button role="tab" data-vista="${id}" class="${id === vista ? 'on' : ''}" aria-selected="${id === vista}">${label}${nuevoVista(g, id) && id !== vista ? ' <span class="nuevo">Nuevo</span>' : ''}${ping(id) ? ' <span class="ping" role="img" aria-label="hay algo pendiente">●</span>' : ''}</button>`).join('');
}

export function renderVista(g, vista, day) {
  const cuerpo = vista === 'yo' ? `<div class="yo-vista">${renderYo(g)}</div>` : vista === 'elecciones' ? renderElecciones(g) : vista === 'calendario' ? renderCalendario(g, uiState) : vista === 'organizacion' ? renderOrganizacion(g) : renderPartidoVista(g);
  return `<div class="vista-in"><div class="vista-top">${renderAcciones(g, day)}</div>${cuerpo}</div>`;
}

const prName = (g, id) => g.cfg.principios.principios.find(p => p.id === id)?.nombre ?? id;
const rolDe = (g, m) => !m.cargo ? 'Militante' : m.cargo.startsWith('ref:') ? `Referente de ${g.zonas[m.cargo.slice(4)]?.nombre ?? 'un barrio'}` : (cargoDef(g, m.cargo)?.nombre ?? 'Cargo');
const sem = (v, inv = false) => { const x = inv ? 100 - v : v; return x >= 66 ? 'alto' : x >= 40 ? 'medio' : 'bajo'; };
const dias = n => n < 30 ? `${n} d` : n < 365 ? `${Math.round(n / 30)} m` : `${(n / 365).toFixed(1).replace('.', ',')} a`;

function personaChip(g, m) {
  return `<button class="persona" data-persona="${esc(m.id)}" data-tip-texto="Ver ficha"><b>${esc(m.nombre)}</b><small>${esc(rolDe(g, m))}</small>
    <span class="sems"><i class="s ${sem(m.capacidad)}" title="Capacidad ${m.capacidad}"></i><i class="s ${sem(m.lealtad)}" title="Lealtad ${m.lealtad}"></i><i class="s ${sem(m.ambicion, true)}" title="Ambición ${m.ambicion}"></i></span></button>`;
}

function renderPartidoVista(g) {
  const subs = partidoSubs(g), sub = subs.some(([id]) => id === uiState.psub) ? uiState.psub : 'resumen';
  const nav = `<nav class="subtabs" role="tablist">${subs.map(([id, l]) => `<button role="tab" data-psub="${id}" class="${id === sub ? 'on' : ''}" aria-selected="${id === sub}">${l}${nuevoSub(g, 'partido', id) ? ' <span class="nuevo">Nuevo</span>' : ''}</button>`).join('')}</nav>`;
  const cuerpo = sub === 'organigrama' ? renderOrganigrama(g) : sub === 'personas' ? renderPersonas(g)
    : sub === 'escalafon' ? `<div class="ancho-lectura">${renderEscalafon(g)}</div>` : sub === 'linea' ? `<div class="ancho-lectura">${renderLinea(g)}</div>`
    : sub === 'principios' ? renderPrincipios(g) : renderResumen(g);
  return `<h2 class="vista-h">${esc(g.partido.nombre)}</h2>${nav}<div class="psub-body">${cuerpo}</div>`;
}

const estadoLegalNombre = g => g.cfg.organizacion.estados.find(e => e.id === g.org?.estado)?.nombre ?? '';

function renderResumen(g) {
  const S = g.plantel, P = g.cfg.plantel, p = g.player, next = g.nextXp;
  const cargos = S.miembros.filter(m => m.cargo && !m.cargo.startsWith('ref:')), refs = S.miembros.filter(m => m.cargo?.startsWith('ref:'));
  const mios = plantel.cargosDe(g).filter(c => plantel.puedoAdministrar(g, c.id));
  const barrios = Object.values(g.zonas).filter(z => z.control >= 0.05).length;
  const kv = (a, b) => `<span>${a}</span><b>${b}</b>`;
  const lider = g.linea?.lider;
  return `<div class="resumen-grid">
    <section class="card"><h3>Quiénes somos</h3>
      <p class="small-p">${esc(g.partido.nombre)} · ${esc(g.city.ciudad)}, ${esc(g.prov.nombre)}${g.trasfondo ? ` · fundado por ${esc(g.jugador.nombre)} (${esc(g.trasfondo.nombre)})` : ''}</p>
      <div class="chips">${g.principios.map(x => `<span class="tag">${esc(x.nombre)}</span>`).join('')}</div>
      <div class="kv">${kv('Etapa', esc(g.etapa.nombre))}${kv('Afiliados', g.afiliados.toLocaleString('es-AR'))}${kv('Barrios con presencia', barrios)}${g.org ? `${kv('Estado legal', esc(estadoLegalNombre(g)))}${kv('Tu influencia', esc(g.rankName))}${kv('Notoriedad', `${Math.round(g.org.fama)}/100`)}` : `${kv('Tu rango', esc(g.rankName))}${kv('Tu superior', lider ? esc(lider.nombre) : 'vacante')}`}</div></section>
    <section class="card"><h3>Equipo con nombre</h3>
      <div class="kv">${kv('Personas del plantel', S.miembros.length)}${kv('Cargos cubiertos', `${cargos.length}${mios.length ? ' / ' + mios.length : ''}`)}${kv('Referentes de barrio', refs.length)}${kv('Sin cargo', S.miembros.filter(m => !m.cargo).length)}${kv('Vacantes abiertas', S.vacantes.length)}</div>
      <p class="muted small-p detalle">Los afiliados son la base del partido; las personas con nombre son los cuadros que podés designar y delegar.</p>
      <button data-psub="organigrama" class="full">Ver el organigrama</button></section>
    <section class="card"><h3>Recursos</h3>
      <div class="kv">${kv('Dinero blanco', money(p.money))}${kv('Dinero negro', money(p.black))}${kv('Exposición', Math.round(g.exposure) + '%')}${kv('Intención de voto', (g.intencionVoto * 100).toFixed(g.intencionVoto < 0.01 ? 3 : 1) + '%')}${next ? kv('XP', `${Math.floor(p.xp)}/${next}`) : ''}</div></section>
    <section class="card ancho-2"><h3>Ahora</h3>${renderAhora(consejos(g)) || '<p class="muted small-p">Nada urgente.</p>'}</section></div>`;
}

function renderOrganigrama(g) {
  const S = g.plantel, P = g.cfg.plantel, rank = g.player.rank, lider = g.linea?.lider;
  const fund = g.modo === 'fundador';
  const arriba = fund ? [] : P.cargos.filter(c => rank <= c.rango);
  const mios = fund ? plantel.cargosDe(g) : P.cargos.filter(c => rank > c.rango);
  const nodoCargo = c => {
    const abierto = g.afiliados >= g.umbral(c.desdeAfiliados), m = plantel.modo(g, c.id), t = titular(g, c.id);
    const cuerpo = !abierto ? `<small class="muted">Con ${g.umbral(c.desdeAfiliados)} afiliados</small>` : m === 'propio' ? `<small>Lo manejás vos · rinde ${plantel.capPropia(g, c)}%</small>` : t ? personaChip(g, t) : '<small class="warn-txt">Vacante: elegí a alguien abajo</small>';
    return `<div class="nodo"><b>${esc(c.nombre)}</b>${abierto ? `<span class="tag ${m === 'delegado' ? 'warn' : ''}">${m === 'delegado' ? 'delegado' : 'propio'}</span>` : ''}${cuerpo}</div>`;
  };
  const refs = S.miembros.filter(m => m.cargo?.startsWith('ref:')), libres = S.miembros.filter(m => !m.cargo);
  const nivel = (titulo, html, vacio) => `<div class="org-nivel"><h4>${titulo}</h4><div class="org-fila">${html || `<small class="muted">${vacio}</small>`}</div></div>`;
  return `<div class="org">
    ${fund ? '' : nivel('Conducción (por encima tuyo)', `${lider ? `<div class="nodo ext"><b>${esc(lider.nombre)}</b><small>${esc(g.rangos[Math.min(g.rangos.length - 1, rank + 1)])} · tu superior</small></div>` : '<div class="nodo ext"><small>Superior vacante</small></div>'}${arriba.map(c => `<div class="nodo ext"><b>${esc(c.nombre)}</b><small>Lo maneja la conducción hasta rango ${esc(g.rangos[c.rango + 1])}</small></div>`).join('')}`, '')}
    ${nivel(fund ? 'Presidencia' : 'Vos', `<div class="nodo yo"><b>${esc(g.jugador.nombre)}</b><small>${fund ? `Presidente de ${esc(g.partido.nombre)}` : esc(g.rankName)}</small><button data-vista="yo">Ver mi perfil</button></div>`, '')}
    ${nivel('Cargos bajo tu mando', mios.map(nodoCargo).join(''), fund ? 'Todavía no hay estructura: hacés todo vos. Los órganos se habilitan al sumar afiliados.' : 'Todavía no tenés cargos a cargo: hacés todo vos. Se habilitan al subir de rango.')}
    ${fund || rank > P.referente.rango ? nivel('Referentes de barrio', refs.map(m => personaChip(g, m)).join(''), 'Sin referentes todavía: aparecen donde tengas presencia.') : ''}
    ${nivel('Militantes sin cargo', libres.map(m => personaChip(g, m)).join(''), 'No hay militantes sin cargo.')}
  </div>
  <h3>${fund ? 'Órganos y delegación' : 'Cargos y delegación'}</h3>${renderPlantel(g)}${uiState.ficha ? renderFicha(g, S.miembros.find(m => m.id === uiState.ficha)) : ''}`;
}

function renderPersonas(g) {
  const S = g.plantel, f = uiState.pfiltro, o = uiState.pord;
  const filtros = [['todos', 'Todos'], ['cargo', 'Con cargo'], ['libres', 'Sin cargo'], ['riesgo', 'En riesgo']];
  const riesgoDe = m => plantel.riesgoMensual(g, m);
  let lista = S.miembros.filter(m => f === 'cargo' ? m.cargo : f === 'libres' ? !m.cargo : f === 'riesgo' ? riesgoDe(m) >= 0.05 : true);
  const ordenes = { cargo: (a, b) => (b.cargo ? 1 : 0) - (a.cargo ? 1 : 0) || b.capacidad - a.capacidad, nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'), cap: (a, b) => b.capacidad - a.capacidad, leal: (a, b) => a.lealtad - b.lealtad, riesgo: (a, b) => riesgoDe(b) - riesgoDe(a), antig: (a, b) => (a.desde ?? 0) - (b.desde ?? 0) };
  lista = lista.sort(ordenes[o] ?? ordenes.cargo);
  const th = (id, l) => `<th><button class="th ${o === id ? 'on' : ''}" data-pord="${id}">${l}</button></th>`;
  const filas = lista.map(m => { const r = riesgoDe(m);
    return `<tr data-persona="${esc(m.id)}" tabindex="0"><td><b>${esc(m.nombre)}</b></td><td>${esc(rolDe(g, m))}</td><td>${m.capacidad}${meter(m.capacidad)}</td><td>${m.lealtad}${meter(m.lealtad, m.lealtad < 40 ? 'bad' : '')}</td><td class="detalle">${m.ambicion}</td><td class="detalle">${dias(plantel.antiguedad(g, m))}</td><td class="${r >= 0.1 ? 'neg' : ''}">${(r * 100).toFixed(r < 0.1 ? 1 : 0).replace('.', ',')}%</td></tr>`; }).join('');
  return `<div class="filtros">${filtros.map(([id, l]) => `<button class="chip-f ${f === id ? 'on' : ''}" data-pfiltro="${id}">${l}</button>`).join('')}<small class="muted">${lista.length} persona${lista.length === 1 ? '' : 's'} · tocá una fila para ver la ficha</small></div>
    <div class="tabla-wrap"><table class="tabla"><thead><tr>${th('nombre', 'Nombre')}<th>Rol</th>${th('cap', 'Capacidad')}${th('leal', 'Lealtad')}<th class="detalle">Ambición</th>${th('antig', 'Antigüedad').replace('<th>', '<th class="detalle">')}${th('riesgo', 'Riesgo mensual')}</tr></thead><tbody>${filas || '<tr><td colspan="7" class="muted">No hay personas con ese filtro.</td></tr>'}</tbody></table></div>
    ${uiState.ficha ? renderFicha(g, S.miembros.find(m => m.id === uiState.ficha)) : ''}`;
}

function renderFicha(g, m) {
  if (!m) return '';
  const cargo = m.cargo, esRef = cargo?.startsWith('ref:'), c = cargo && !esRef ? cargoDef(g, cargo) : null;
  const coord = esRef && plantel.modo(g, 'territorial') === 'delegado' ? titular(g, 'territorial') : null;
  const reporta = coord ? coord.nombre : 'Vos';
  const r = plantel.riesgoMensual(g, m);
  const aporta = c ? `${esc(c.efecto)} (${m.capacidad}% de capacidad)` : esRef ? `+${Math.round(g.cfg.plantel.referente.chancePorCap * m.capacidad / 100)} puntos de éxito en ${esc(g.zonas[cargo.slice(4)]?.nombre ?? 'su barrio')}` : 'Sin aporte hasta que tenga un cargo.';
  const ambTxt = m.ambicion > 70 ? 'Muy ambicioso: puede irse con un rival.' : m.ambicion > 40 ? 'Ambición moderada.' : 'Poco ambicioso.';
  return `<section class="ficha" aria-label="Ficha de ${esc(m.nombre)}"><div class="ficha-h"><h3>${esc(m.nombre)}</h3><button data-cerrar-ficha aria-label="Cerrar ficha">✕</button></div>
    <p class="small-p">${esc(rolDe(g, m))} · ${esc(origenTxt[m.origen] ?? '')} · hace ${dias(plantel.antiguedad(g, m))} en el partido</p>
    <div class="m-stats">${['capacidad', 'lealtad', 'ambicion'].map(k => `<span tabindex="0" data-tip="${k}">${k === 'ambicion' ? 'Amb.' : k === 'capacidad' ? 'Cap.' : 'Leal.'} ${m[k]}${meter(m[k], k === 'lealtad' && m[k] < 40 ? 'bad' : k === 'ambicion' && m[k] > 70 ? 'warn' : '')}</span>`).join('')}</div>
    <div class="kv"><span>Reporta a</span><b>${esc(reporta)}</b><span>Principios</span><b>${m.principios.map(id => esc(prName(g, id))).join(', ') || '—'}</b><span>Aporta</span><b>${aporta}</b><span tabindex="0" data-tip="riesgo">Riesgo de irse (30 días)</span><b class="${r >= 0.1 ? 'neg' : ''}">${(r * 100).toFixed(1).replace('.', ',')}%</b></div>
    <small class="muted">${esc(ambTxt)} ${m.lealtad < 40 ? 'Su lealtad es baja.' : ''}</small>
    ${c && plantel.modo(g, c.id) === 'delegado' ? `<div class="btns"><button data-retomar="${esc(c.id)}">Retomar este cargo</button></div>` : ''}</section>`;
}

function renderPrincipios(g) {
  const cat = g.cfg.principios.principios;
  const mine = g.principios.map(x => `<div class="principle on static"><span><b>${esc(x.nombre)}</b><br><small>${esc(x.texto)}</small><br><small class="muted">${esc(modsTexto(x, g.cfg))}</small></span></div>`).join('');
  const rivals = rivalesDe(g).map(r =>
    `<div class="rival-line"><span class="dot" style="background:${r.color}"></span><span><b>${esc(r.nombre)}</b> <small class="muted">· ${esc(r.espacio)}</small><br><small>${esc(r.principios.map(id => cat.find(c => c.id === id)?.nombre).join(', '))}</small></span></div>`).join('');
  return `<div class="resumen-grid"><section class="card"><h3>Nuestros principios</h3>${mine}</section><section class="card"><h3>Otros partidos y lo que defienden</h3>${rivals}</section></div>`;
}

// ---------- Informe flotante al terminar una acción ----------
const fmtCambio = c => {
  const bueno = c.k === 'Exposición' ? c.d < 0 : c.d > 0, signo = c.d > 0 ? '+' : '−', a = Math.abs(c.d);
  const v = c.k === 'Dinero' || c.k === 'Negro' ? money(a) : a.toFixed(1).replace('.', ',') + (c.k === 'XP' ? '' : ' pts');
  return `<span class="cambio ${bueno ? 'pos' : 'neg'}">${esc(c.k)} ${signo}${v}</span>`;
};
export function renderInforme(lista) {
  if (!lista?.length) return '';
  const items = lista.map(i => `<div class="inf ${i.ok === null ? 'neutro' : i.ok ? 'ok' : 'mal'}"><div class="inf-h"><b>${i.ok === null ? '▸' : i.ok ? '✔' : '✖'} ${esc(i.nombre)}${i.modo === 'delegada' ? ' (equipo)' : ''}</b>${i.zonaNombre ? `<small class="muted">${esc(i.zonaNombre)}</small>` : ''}</div>
    <p>${esc(i.texto)}</p>${i.cambios?.length ? `<div class="cambios">${i.cambios.map(fmtCambio).join('')}</div>` : ''}${i.zona ? `<button data-informe-zona="${esc(i.zona)}">Ver zona</button>` : ''}${i.donde ? `<button class="primary" data-informe-ir="${esc(JSON.stringify(i.donde))}">Mostrame</button>` : ''}</div>`).join('');
  return `<aside class="informe" role="status" aria-live="polite"><h3>${lista.every(i => i.tipo === 'desbloqueo') ? (lista.length > 1 ? `Se abrieron ${lista.length} cosas nuevas` : 'Se abrió algo nuevo') : lista.some(i => i.tipo === 'desbloqueo') ? 'Novedades' : lista.every(i => i.tipo === 'eleccion') ? (lista.length > 1 ? `${lista.length} novedades electorales` : 'Novedad electoral') : lista.length > 1 ? `Terminaron ${lista.length} acciones` : 'Terminó una acción'}</h3>${items}
    <div class="btns"><button class="primary" data-informe-continuar>Continuar</button></div><small class="muted">Juego en pausa · Espacio también continúa</small></aside>`;
}

// Franja "Ahora": lo más importante del momento. Rápido muestra solo la primera; Detallado, todas.
function renderAhora(cs) {
  if (!cs.length) return '';
  const items = cs.map((c, i) => {
    const icono = ico(c.nivel === 'urgente' || c.nivel === 'alerta' ? 'alerta' : c.nivel === 'oportunidad' ? 'flecha' : 'ayuda');
    const attrs = c.tab ? `data-ir="${c.tab}"${c.sub ? ` data-sub="${c.sub}"` : ''}` : 'disabled';
    return `<button class="ahora ${c.nivel} ${i ? 'detalle' : ''}" ${attrs}>${icono}<span>${esc(c.texto)}</span></button>`;
  }).join('');
  return `<section class="ahora-box" aria-label="Qué hacer ahora"><h3>Ahora</h3>${items}${cs.length > 1 ? `<small class="muted solo-rapido">+${cs.length - 1} más en modo Detallado</small>` : ''}</section>`;
}

// Datos: finanzas y provincia en una sola pestaña, con selector interno
function renderDatos(g) {
  const sub = uiState.datosSub;
  return `<div class="seg" role="tablist">${[['finanzas', 'Finanzas'], ['provincia', 'Provincia']].map(([id, l]) => `<button role="tab" data-sub="${id}" class="${sub === id ? 'on' : ''}" aria-selected="${sub === id}">${l}</button>`).join('')}</div>${sub === 'provincia' ? renderProvincia(g) : renderFinanzas(g)}`;
}

function btnLabel(lock, ok) { return lock ? esc(lock) : ok; }

const diasTxt = n => (n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} d`);
const certTxt = c => `<span class="cert" tabindex="0" data-tip="certeza">${c === 'confirmado' ? '✔ confirmado' : '❓ rumor'}</span>`;

// Línea de aviso: qué hace un rival que se cruza con la misión que estás planificando y qué riesgo trae (siempre visible)
function avisoChoque(g, c) {
  const r = g.rival(c.rival), a = c.accion;
  const que = c.tipo === 'propia' ? `${a.texto}` : c.enCurso ? `tiene en curso «${a.nombre.toLowerCase()}»` : `planea «${a.nombre.toLowerCase()}» (${diasTxt(c.enDias)})`;
  const efecto = `${c.chance} puntos de éxito${c.bloqueo ? ' y bloquea la misión' : ''}`;
  return `<div class="clash ${c.certeza}"><span class="dot" style="background:${r.color}"></span><span>⚠ <b>${esc(r.nombre)}</b> ${esc(que)} · <em>${certTxt(c.certeza)}</em> → ${esc(efecto)}</span></div>`;
}

// Valor esperado por día de trabajo: sirve para marcar la opción recomendada de cada sección
function valorMision(g, m, z) {
  const ch = g.chance(m, z).c / 100;
  if (m.categoria === 'finanzas') return (g.ingresoEsperado(m, z) * ch - m.costo) / g.dias(m);
  return g.alcance(m, z).control * 100 * ch / (g.dias(m) * (1 + m.costo / 2000));
}
function recomendada(g, lista, z, zoneId) {
  let mejor = null, v = -Infinity;
  for (const m of lista) { if (g.canStart(m, zoneId)) continue; const x = valorMision(g, m, z); if (x > v) { v = x; mejor = m.id; } }
  return mejor;
}

// Tarjeta de misión: fila compacta (nombre · éxito · tiempo · costo · Lanzar). El resto vive en "…" (Rápido) o a la vista (Detallado).
function misionCard(g, m, z, zoneId, rec) {
  const lock = g.canStart(m, zoneId), ch = g.chance(m, z), al = g.alcance(m, z), fin = m.categoria === 'finanzas';
  const why = ch.factors.map(f => `<li class="${f[1] < 0 ? 'neg' : 'pos'}"><span>${esc(f[0])}</span><b>${f[1] >= 0 ? '+' : ''}${f[1]}</b></li>`).join('');
  const delLock = g.canStart(m, zoneId, 'blanco', 'delegada');
  const avisos = choques(g, m, zoneId, g.day, g.day + g.dias(m)).map(c => avisoChoque(g, c)).join('');
  const abierta = uiState.abiertas.has(m.id);
  const resultado = fin
    ? `<span>${ico(m.ilegal ? 'negro' : 'dinero')}~${money(g.ingresoEsperado(m, z))}${m.ilegal ? ` en negro · exposición +${Math.round(m.expo * g.modsPrincipios(m).expoMult)}` : ''}</span>`
    : `<span>${ico('seguidores')}~${al.personas.toLocaleString('es-AR')} pers. (+${(al.control * 100).toFixed(1)}% <span tabindex="0" data-tip="control">control</span>)</span>`;
  return `<div class="mission compact ${lock ? 'locked' : ''} ${m.ilegal ? 'ilegal' : ''} ${abierta ? 'abierta' : ''}" data-m="${esc(m.id)}">
      <div class="m-row">
        <div class="m-name"><b>${esc(m.nombre)}</b>${rec ? ' <span class="rec" tabindex="0" data-tip-titulo="Recomendada" data-tip-texto="La mejor opción disponible ahora, según su resultado esperado por día de trabajo.">★ Recomendada</span>' : ''}${m.ilegal ? ' <span class="tag">ilegal</span>' : ''}</div>
        <div class="m-quick"><span tabindex="0" data-tip="exito">${ico('objetivo')}${ch.c}%</span><span>${ico('reloj')}${g.dias(m)} d</span><span>${ico('dinero')}${m.costo ? money(m.costo) : 'gratis'}</span></div>
        <button class="go" data-start="${m.id}" ${lock ? 'disabled' : ''}>Lanzar</button>
        <button class="mas-btn" data-mas="${esc(m.id)}" aria-expanded="${abierta}" aria-label="Más opciones de ${esc(m.nombre)}">${ico('mas')}</button>
      </div>
      ${lock ? `<small class="lock-why">${esc(lock)}</small>` : ''}
      ${avisos}
      <div class="detalle m-extra">
        <small class="muted">${esc(m.desc)}</small>
        <div class="meta">${resultado}</div>
        <details><summary>Por qué ${ch.c}%</summary><ul class="factors">${why}</ul></details>
        <div class="btns">${m.negro ? negroBtn(g, m, z, zoneId) : ''}
          ${m.delegable ? `<button data-start="${m.id}" data-modo="delegada" ${delLock ? 'disabled' : ''} data-tip-texto="${delLock ? esc(delLock) : 'Un equipo la hace por vos, con menos éxito. No ocupa tu acción personal.'}">${ico('equipo')} Delegar${delLock ? ' 🔒' : ''}</button>` : ''}</div>
      </div></div>`;
}

const seccion = (id, titulo, nota, cards, n) => `<details class="sec" data-sec="${id}" ${uiState.secs[id] ? 'open' : ''}><summary><span>${titulo}</span><span class="count">${n}</span></summary>${nota ? `<p class="muted small-p">${nota}</p>` : ''}${cards}</details>`;

function renderZona(g, zoneId) {
  if (!zoneId) return '<p class="muted">Elegí un barrio en el mapa para ver sus datos, a los rivales que hay y lanzar misiones.</p>';
  const z = g.zonas[zoneId], ms = g.cfg.missions;
  const base = ve(g, 'mision.mas') ? null : ['volantes', 'visitas'];
  const lejos = m => !!g.guia?.progresivo && (m.minRank > g.player.rank + 1 || g.day < (m.minDia ?? 0) - 3);       // las misiones que exigen mucho más rango no se muestran todavía
  const grupo = (f) => ms.filter(m => f(m) && !lejos(m)), terr = grupo(m => m.categoria !== 'finanzas' && (!base || base.includes(m.id))), legal = grupo(m => m.categoria === 'finanzas' && !m.ilegal), ilegal = grupo(m => m.ilegal);
  const proxima = ms.filter(m => lejos(m) || (m.minRank > g.player.rank)).sort((a, b) => a.minRank - b.minRank)[0];
  const cards = (lista, rec) => lista.map(m => misionCard(g, m, z, zoneId, m.id === rec)).join('');
  return `<h2>${esc(z.nombre)}</h2>
    <p class="z-resumen"><span tabindex="0" data-tip="control">Control <b>${pct(z.control)}</b></span> · <span tabindex="0" data-tip="confianza">Confianza <b>${Math.round(z.trust)}</b></span> · ${z.pop.toLocaleString('es-AR')} hab.${z.popFuente ? '' : ' (est.)'}<span class="detalle muted"> · ${z.densidad ? z.densidad.toLocaleString('es-AR') + ' hab/km²' : ''}${g.electores(z) !== null ? ' · ~' + g.electores(z).toLocaleString('es-AR') + ' electores' : ''}</span></p>
    ${seccion('terr', 'Misiones', '', cards(terr, recomendada(g, terr, z, zoneId)), terr.length)}
    ${ve(g, 'zona.recaudacion') ? seccion('recaud', 'Recaudación', 'Plata para sostener el partido. Hacerlo ocupa tu única acción personal.', cards(legal, recomendada(g, legal, z, zoneId)), legal.length) : ''}
    ${ve(g, 'zona.ilegal') ? seccion('ilegal', 'Dinero ilegal', 'Mucha plata rápido, en negro. Sube la exposición y te deja deudas de favor.', cards(ilegal, null), ilegal.length) : ''}
    ${proxima && ve(g, 'mision.mas') ? `<p class="muted small-p">Próxima misión: <b>${esc(proxima.nombre)}</b> (con rango ${esc(g.rangos[proxima.minRank])}).</p>` : ''}
    ${ve(g, 'zona.rivales') ? seccion('rivZona', 'Rivales en esta zona', '', renderRivalesBody(g, z), 5) : ''}`;
}

function negroBtn(g, m, z, zoneId) {
  const lock = g.canStart(m, zoneId, 'negro'), ch = g.chance(m, z, 'negro').c;
  return `<button class="negro" data-start="${m.id}" data-pago="negro" ${lock ? 'disabled' : ''} title="Éxito ${ch}% · exposición +${Math.round(m.negro.expo * g.modsPrincipios(m).expoMult)}">🕶 ${lock ? esc(lock) : 'Con negro · ' + ch + '%'}</button>`;
}

// Rivales en la zona: presencia, principios, estimación de reacciones y acciones vigentes
// Menú «Atacar»: ofensivas contra un rival en el barrio elegido (sabotaje, desprestigio, captación, medios)
const GRUPOS_OF = { sabotaje: 'Sabotaje de campaña', desprestigio: 'Desprestigio y operaciones', captacion: 'Robar gente', medios: 'Medios y debates' };
function ofensivaMenu(g, rid, zoneId) {
  if (!ve(g, 'zona.ofensiva')) return '';
  if (!zoneId) return '<small class="muted">Elegí un barrio en el mapa para atacar.</small>';
  const abierto = uiState.ofRival === rid, nivel = of.nivelRencor(g, rid), z = g.zonas[zoneId];
  const rnc = nivel === 'ninguno' ? '' : ` <small class="muted">· rencor <b class="rc-${nivel}">${nivel}</b></small>`;
  const btn = `<button class="ghost atacar" data-of-menu="${esc(rid)}" aria-expanded="${abierto}">⚔ Atacar…</button>`;
  if (!abierto) return `<div class="of-fila">${btn}${rnc}</div>`;
  const grupos = Object.entries(GRUPOS_OF).map(([id, titulo]) => {
    const items = of.acciones(g).filter(a => a.grupo === id && (!g.guia?.progresivo || a.minRank <= g.player.rank + 1)).map(a => {
      const mot = of.motivo(g, a, rid, zoneId), c = of.chance(g, a, zoneId, rid).c, exp = of.exposicionPrevista(a);
      return `<div class="of-a ${mot ? 'lock' : ''}"><div><b>${esc(a.nombre)}</b><small class="muted"> ${esc(a.texto)}</small><br><small>${ico('objetivo')}${c}% · ${ico('reloj')}${g.dias(a)} d · ${ico('dinero')}${a.costo ? money(a.costo) : 'gratis'}${exp ? ` · exposición +${exp}` : ''}${a.rebote ? ' · riesgo de rebote' : ''}</small>${mot ? `<br><small class="of-mot">${esc(mot)}</small>` : ''}</div>
        <button class="danger" data-of-lanzar="${esc(a.id)}" data-rival="${esc(rid)}" ${mot ? 'disabled' : ''}>Lanzar</button></div>`;
    }).join('');
    return items ? `<h5>${esc(titulo)}</h5>${items}` : '';
  }).join('');
  return `<div class="of-menu"><div class="of-fila">${btn}${rnc}</div><p class="muted small-p">En <b>${esc(z.nombre)}</b>. Cada golpe usa tu acción personal, enoja al rival y puede volverse en tu contra.</p>${grupos || '<p class="muted small-p">Todavía no tenés golpes disponibles.</p>'}</div>`;
}

function renderRivalesBody(g, z) {
  const pres = presencia(g, z.id), am = amenaza(g, z), cat = g.cfg.principios.principios;
  const activos = efectosActivos(g, z.id).map(e => {
    const a = g.cfg.rivales.acciones.find(x => x.id === e.accion), r = g.rival(e.rival);
    const bl = a.bloquea?.length ? ` · bloquea: ${a.bloquea.map(id => g.mission(id).nombre).join(', ')}` : '';
    return `<div class="alert-rival"><span class="dot" style="background:${r.color}"></span><span><b>${esc(r.nombre)}</b>: ${esc(a.nombre.toLowerCase())} — ${e.hasta - g.day} d${esc(bl)}</span></div>`;
  }).join('');
  const enZona = agenda(g).filter(a => a.zona === z.id).map(a => {
    const r = g.rival(a.rival), cert = certeza(g, z), estado = a.fase === 'planeada' ? `prepara «${a.def.nombre.toLowerCase()}» (${diasTxt(a.inicio - g.day)})` : a.tipo === 'propia' ? `${a.def.texto} (${Math.max(0, a.fin - g.day)} d)` : `«${a.def.nombre.toLowerCase()}» en curso (${Math.max(0, a.fin - g.day)} d)`;
    return `<div class="alert-rival ${a.tipo}"><span class="dot" style="background:${r.color}"></span><span><b>${esc(r.nombre)}</b> ${esc(estado)} · <em>${certTxt(cert)}</em></span></div>`;
  }).join('');
  const rows = am.detalle.map(d => {
    const r = d.partido, ps = r.principios.map(id => cat.find(c => c.id === id)?.nombre).filter(Boolean).join(', ');
    const react = d.prob30 > 0.01 && d.accion ? `<small class="react">Podría: ${esc(d.accion.nombre.toLowerCase())} · ${approx5(d.prob30)} en 30 d</small>` : '';
    return `<div class="rival"><div class="rival-top"><span class="dot" style="background:${r.color}"></span><span class="rn">${esc(r.nombre)}</span><span class="rp">${approx5(pres[r.id])}</span></div>
      <div class="bar thin"><i style="width:${(pres[r.id] * 100).toFixed(0)}%;background:${r.color}"></i></div>
      <small class="muted detalle">${esc(ps)}</small>${react}${ofensivaMenu(g, r.id, z.id)}</div>`;
  }).join('');
  const nivelTxt = { ninguna: 'Todavía no te toman como amenaza: con poco control en el barrio, los rivales no reaccionan.', baja: 'Riesgo de reacción rival: <b>bajo</b>.', media: 'Riesgo de reacción rival: <b class="mid">medio</b>.', alta: 'Riesgo de reacción rival: <b class="hi">alto</b>.' }[am.nivel];
  return `<p class="muted small-p">${nivelTxt} <small>(estimación)</small></p>${enZona}${activos}${rows}`;
}

// Pestaña Rivales: qué está haciendo cada partido ahora y qué hizo hace poco
function renderTabRivales(g, zoneId) {
  const cat = g.cfg.principios.principios, ag = Object.fromEntries(agenda(g).map(a => [a.rival, a]));
  const rs = rivalesDe(g).sort((a, b) => presenciaCiudad(g, b.id) - presenciaCiudad(g, a.id));
  const cards = rs.map(r => {
    const a = ag[r.id], bot = g.bots[r.id];
    let estado;
    if (a) {
      const z = g.zonas[a.zona], cert = certeza(g, z), dur = a.fin - a.inicio || 1;
      const frac = a.fase === 'planeada' ? Math.min(1, (g.day - a.planDesde) / Math.max(1, a.inicio - a.planDesde)) : Math.min(1, (g.day - a.inicio) / dur);
      const txt = a.fase === 'planeada' ? `Prepara «${a.def.nombre.toLowerCase()}» contra vos` : a.tipo === 'propia' ? a.def.nombre : `«${a.def.nombre}» contra vos`;
      estado = `<div class="r-act ${a.tipo === 'hostil' ? 'hostil' : ''}"><b>${esc(txt)}</b><br><small>${esc(z.nombre)} · ${a.fase === 'planeada' ? 'empieza ' + diasTxt(a.inicio - g.day) : `faltan ${Math.max(0, a.fin - g.day)} d`} · <em>${certTxt(cert)}</em></small>
        <div class="bar thin"><i style="width:${(frac * 100).toFixed(0)}%;background:${r.color}"></i></div></div>`;
    } else estado = `<div class="r-act idle"><small class="muted">${g.day < g.cfg.rivales.base.arranque ? 'Todavía se está organizando.' : bot && g.day >= bot.libreDesde ? 'Evaluando su próximo paso…' : 'En pausa.'}</small></div>`;
    const K = g.cfg.plantel.captar;
    // Pactos: relación con este partido, pacto vigente o propuestas posibles
    const rel = Math.round(relacionRival(g, r.id)), pc = pactoCon(g, r.id), PC = g.cfg.pactos, cd = (g.alianzas.enfriamiento[r.id] ?? 0) - g.day;
    const zsel = zoneId ? g.zonas[zoneId] : null;
    const tiposHtml = PC.tipos.map(t => {
      const o = g.ofertaPacto(r.id, t.id);
      const motivo = pc ? 'Ya hay un pacto' : g.alianzas.pactos.length >= PC.max ? `Máximo ${PC.max} pactos` : cd > 0 ? `Esperá ${cd} d` : rel < t.requiere ? `Relación mínima ${t.requiere}` : t.zona && !zsel ? 'Elegí un barrio en el mapa' : null;
      const costoTxt = o.costo ? money(o.costo) : (t.recibe ? `recibís ${money(t.recibe)}` : 'sin costo');
      return `<div class="tipo-pacto"><b>${esc(t.nombre)}</b> <small class="muted">· ${t.dias} d · ${esc(costoTxt)} · acepta ${motivo === `Relación mínima ${t.requiere}` ? '—' : approx5(o.p)}</small><br><small>${esc(t.texto)}${t.zona && zsel ? ` (barrio: ${esc(zsel.nombre)})` : ''}</small>
        <div class="btns"><button data-pacto="${esc(r.id)}" data-tipo="${esc(t.id)}" data-con="blanco" ${motivo ? 'disabled' : ''}>${motivo ? esc(motivo) : 'Proponer'}</button>${o.costo && !motivo ? `<button class="negro" data-pacto="${esc(r.id)}" data-tipo="${esc(t.id)}" data-con="negro" ${g.player.black < o.costo ? 'disabled' : ''} title="Pagar en negro: exposición +6">🕶 negro</button>` : ''}</div></div>`;
    }).join('');
    const pactoHtml = pc
      ? `<div class="pacto activo">🤝 <b>${esc(tipoDef(g, pc.tipo).nombre)}</b>${pc.zona ? ' en ' + esc(g.zonas[pc.zona]?.nombre ?? '') : ''} · quedan ${Math.max(0, pc.hasta - g.day)} d</div>`
      : `<details class="pactos"><summary>Proponer un pacto</summary>${tiposHtml}<small class="muted">Un rival aliado te puede traicionar si crecés demasiado. Tu superior opina sobre con quién te aliás.</small></details>`;
    const cuadros = (g.rivalesPlantel[r.id] ?? []).map(m => {
      const aprox = v => Math.round(v / 10) * 10, lider = m.rol === 'Líder';
      return `<div class="cuadro"><span><b>${esc(m.nombre)}</b> <small class="muted">${lider ? 'Líder' : 'Cuadro'} · capacidad ~${aprox(m.capacidad)} · lealtad ~${aprox(m.lealtad)}</small></span>
        ${lider ? '' : `<span class="btns"><button data-captar="${esc(r.id)}" data-mid="${esc(m.id)}" data-con="blanco" ${g.player.money < K.costoBlanco ? 'disabled' : ''} title="Probabilidad estimada ${approx5(probCaptar(m))}">Captar ${money(K.costoBlanco)}</button><button class="negro" data-captar="${esc(r.id)}" data-mid="${esc(m.id)}" data-con="negro" ${g.player.black < K.costoNegro ? 'disabled' : ''} title="Con dinero negro: exposición +${K.exposicionNegro}">🕶 ${money(K.costoNegro)}</button></span>`}</div>`;
    }).join('');
    return `<div class="rcard"><div class="rival-top"><span class="dot" style="background:${r.color}"></span><span class="rn">${esc(r.nombre)}</span><span class="rp" title="Presencia media en la ciudad (estimada)">${approx5(presenciaCiudad(g, r.id))}</span></div>
      <small class="muted detalle">${esc(r.espacio)} · ${esc(r.principios.map(id => cat.find(c => c.id === id)?.nombre).join(', '))}</small>
      <div class="rel-line"><small class="muted"><span tabindex="0" data-tip="relacion">Relación</span> contigo: <b>${esc(etiquetaRel(rel))}</b><span class="detalle"> (${rel})</span></small><span class="meter ${rel < 30 ? 'bad' : ''}"><i style="width:${rel}%"></i></span></div>${pactoHtml}${estado}
      ${ofensivaMenu(g, r.id, zoneId)}
      <details class="cuadros detalle"><summary>Sus cuadros</summary>${cuadros}<small class="muted">Captar a alguien lo suma a tu plantel, pero el rival se entera del intento si falla.</small></details></div>`;
  }).join('');
  const feed = g.historialRivales.slice(0, 8).map(h => {
    const r = g.rival(h.rival), z = g.zonas[h.zona], def = defAccion(g, h);
    return `<div class="feed-item"><span class="dot" style="background:${r.color}"></span><span><b>${esc(r.nombre)}</b> ${esc(def.texto)} en ${esc(z.nombre)} <small class="muted">· ${esc(Math.max(0, g.day - h.fin) === 0 ? 'hoy' : 'hace ' + (g.day - h.fin) + ' d')} · ${certTxt(certeza(g, z))}</small></span></div>`;
  }).join('') || '<p class="muted small-p">Todavía no hay movimientos para contar.</p>';
  return `<h2>Qué están haciendo</h2><p class="muted small-p">Cada partido hace una acción a la vez. Lo que ocurre en barrios donde no tenés presencia ni confianza llega solo como rumor.</p>${cards}<h3>Últimos movimientos</h3>${feed}`;
}

// Línea partidaria: tu líder superior y las bajadas de línea
function renderLinea(g) {
  const L = g.linea, cat = g.cfg.principios.principios;
  if (!L?.lider) return `<h3>Línea partidaria</h3><p class="muted small-p">${g.modo === 'fundador' || g.player.rank + 1 >= g.rangos.length ? 'Sos la máxima conducción: no tenés superior.' : 'Tu superior dejó el cargo: el puesto está vacante y se cubrirá en unos días. Es una oportunidad para ascender.'}</p>`;
  const l = L.lider, rel = Math.round(l.relacion), et = etiquetaRelacion(g, rel);
  const ps = l.principios.map(id => cat.find(c => c.id === id)?.nombre).filter(Boolean).map(n => `<span class="chip ${g.partido.principios.includes(cat.find(c => c.nombre === n)?.id) ? 'common' : ''}">${esc(n)}</span>`).join('');
  let dir;
  const d = L.directiva;
  if (!d) dir = `<p class="muted small-p">Sin directivas por ahora. La próxima baja de línea llega en unos ${Math.max(1, L.proxima - g.day)} días.</p>`;
  else {
    const quien = d.fuente === 'partido' ? 'Línea partidaria' : `${esc(l.nombre)}`;
    if (d.estado === 'propuesta') dir = `<div class="directive new"><small class="muted">${quien} baja línea · respondé en ${Math.max(0, d.venceRespuesta - g.day)} d</small><p>${esc(d.texto)}</p>
      <div class="btns"><button class="primary" data-linea="aceptar">Aceptar</button><button class="danger" data-linea="rechazar">Rechazar</button></div>
      <small class="muted">Cumplirla sube tu relación con el líder y da recompensa; rechazarla o fallarla, la baja.</small></div>`;
    else { const pr = progresoDirectiva(g, d); dir = `<div class="directive"><small class="muted">${quien} · vence en ${Math.max(0, d.hasta - g.day)} d</small><p>${esc(d.texto)}</p><div class="bar big"><i style="width:${(pr.frac * 100).toFixed(0)}%"></i><span>${esc(pr.texto)}</span></div></div>`; }
  }
  const hist = L.historial.slice(0, 5).map(h => `<div class="feed-item ${h.resultado}"><span>${esc(h.texto)} <small class="muted">· relación ${h.relacion > 0 ? '+' : ''}${h.relacion}</small></span></div>`).join('');
  return `<h3>Línea partidaria</h3>
    <div class="leader"><div class="leader-head"><b>${esc(l.nombre)}</b><small class="muted">${esc(l.cargo)} · tu superior</small></div><div class="chips">${ps}</div>
      <div class="bar"><i style="width:${rel}%;background:${rel < 30 ? '#e4604f' : rel >= 70 ? '#7fd1a0' : 'var(--accent)'}"></i></div>
      <small class="muted">Relación: <b>${esc(et)}</b> (${rel}/100) · coincidís en ${l.comunes} principio${l.comunes === 1 ? '' : 's'}. Más adelante: apoyarlo o disputarle el puesto.</small></div>
    ${dir}${hist ? `<h3>Directivas anteriores</h3>${hist}` : ''}`;
}

// Finanzas: flujo mensual proyectado, historial de cierres y deudas de favor
function renderFinanzas(g) {
  const P = g.flujo, h = g.economia.historial, favs = g.favores;
  const lineas = o => Object.entries(o).map(([k, v]) => `<span>${esc(k)}</span><b>${money(v)}</b>`).join('');
  const diasCierre = g.cfg.economia.ciclo - (g.day % g.cfg.economia.ciclo);
  const hist = h.map(x => `<div class="kv2"><span>Día ${x.dia}</span><span>+${money(x.ingresos)} / −${money(x.gastos)}</span><b class="${x.neto < 0 ? 'neg' : 'pos'}">${x.neto >= 0 ? '+' : '−'}${money(Math.abs(x.neto))}</b></div>`).join('') || '<p class="muted small-p">Todavía no hubo un cierre de mes.</p>';
  const favores = favs.map(f => `<div class="favor ${f.hasta - g.day <= 7 ? 'urgente' : ''}"><div><b>${esc(f.nombre)}</b><br><small class="muted">Te pide ${money(f.valor)} · vence en ${Math.max(0, f.hasta - g.day)} d${f.extendido ? ' · ya te dieron una prórroga' : ''}</small></div>
      <div class="btns"><button data-favor="${esc(f.id)}" data-con="blanco" ${g.player.money < f.valor ? 'disabled' : ''}>Pagar (blanco)</button><button class="negro" data-favor="${esc(f.id)}" data-con="negro" ${g.player.black < f.valor ? 'disabled' : ''}>🕶 Pagar (negro)</button></div></div>`).join('')
    || '<p class="muted small-p">No le debés favores a nadie.</p>';
  return `<h2>Finanzas</h2>
    <div class="kv"><span>Dinero blanco</span><b class="${g.player.money < 0 ? 'neg' : ''}">${money(g.player.money)}</b><span>Dinero negro</span><b>${money(g.player.black)}</b><span>Afiliados</span><b>${g.afiliados.toLocaleString('es-AR')}</b><span>Próximo cierre</span><b>en ${diasCierre} d</b></div>
    ${g.player.money < 0 ? '<p class="error">Estás en números rojos: no podés gastar plata hasta recuperarte. Recaudá (colecta, aporte de comerciantes).</p>' : ''}
    <h3>Cada mes entra</h3><div class="kv">${lineas(P.ingresos)}<span><b>Total</b></span><b class="pos">${money(P.totalIngresos)}</b></div>
    <h3>Cada mes sale</h3><div class="kv">${lineas(P.gastos)}<span><b>Total</b></span><b class="neg">${money(P.totalGastos)}</b></div>
    <p class="${P.neto < 0 ? 'error' : 'muted'} small-p">Resultado proyectado: <b>${P.neto >= 0 ? '+' : '−'}${money(Math.abs(P.neto))}</b> por mes. ${P.neto < 0 ? 'Con este ritmo perdés plata: hay que recaudar más o crecer.' : ''}</p>
    <h3>Deudas de favor</h3>${favores}
    <h3>Últimos cierres</h3>${hist}`;
}

// Checklist del próximo ascenso
function renderEscalafon(g) {
  const q = g.requisitos;
  if (!q) return '<h3>Tu próximo ascenso</h3><p class="muted small-p">Llegaste a la cima del escalafón.</p>';
  const lineas = q.items.map(i => `<div class="req ${i.ok ? 'ok' : 'no'}"><span>${i.ok ? '✔' : '✖'}</span><span>${esc(i.texto)}${i.ayuda ? `<br><small class="muted">${esc(i.ayuda)}</small>` : ''}</span><b>${esc(i.actual)}${i.meta != null ? ' / ' + esc(i.meta) : ''}</b></div>`).join('');
  return `<h3>Tu próximo ascenso: ${esc(q.rango)}</h3>${lineas}
    <button class="primary full" data-ascender ${q.todos ? '' : 'disabled'}>${q.todos ? `Pedir el ascenso a ${esc(q.rango)}` : 'Todavía no cumplís los requisitos'}</button>
    <p class="muted small-p">Etapa del partido: <b>${esc(g.etapa.nombre)}</b> · ${g.afiliados.toLocaleString('es-AR')} afiliados.</p>`;
}

const meter = (v, cls = '') => `<span class="meter ${cls}"><i style="width:${v}%"></i></span>`;
const origenTxt = { fundador: 'fundador', interno: 'ascenso interno', externo: 'incorporado', captado: 'captado de un rival', interino: 'interino', rival: 'rival' };
export const miembroCard = (m, extra = '') => `<div class="miembro"><div class="m-head"><b>${esc(m.nombre)}</b><small class="muted">${esc(origenTxt[m.origen] ?? '')}</small></div>
  <div class="m-stats"><span tabindex="0" data-tip="capacidad">Cap. ${m.capacidad}${meter(m.capacidad)}</span><span tabindex="0" data-tip="lealtad">Leal. ${m.lealtad}${meter(m.lealtad, m.lealtad < 40 ? 'bad' : '')}</span><span tabindex="0" data-tip="ambicion">Amb. ${m.ambicion}${meter(m.ambicion, m.ambicion > 70 ? 'warn' : '')}</span></div>${extra}</div>`;

// Plantel como jerarquía: conducción (arriba, solo lectura) → vos → cargos bajo tu mando (propio o delegado) → referentes → militantes
export function renderPlantel(g) {
  const P = g.cfg.plantel, S = g.plantel, fund = g.modo === 'fundador', rank = fund ? 99 : g.player.rank, K = P.propio, car = g.carga;
  const arriba = P.cargos.filter(c => rank <= c.rango);
  const mios = plantel.cargosDe(g).filter(c => rank > c.rango);
  const cardCargo = c => {
    const abierto = g.afiliados >= g.umbral(c.desdeAfiliados), m = plantel.modo(g, c.id), t = titular(g, c.id), v = S.vacantes.find(x => x.cargo === c.id);
    const hab = g.cfg.habilidades.ramas.find(r => r.id === c.habilidad)?.nombre ?? '';
    if (!abierto) return `<div class="cargo cerrado"><b>${esc(c.nombre)}</b><small class="muted">Se puede organizar con ${g.umbral(c.desdeAfiliados)} afiliados.</small></div>`;
    if (m === 'propio') {
      const cap = plantel.capPropia(g, c);
      return `<div class="cargo"><div class="c-title"><b>${esc(c.nombre)}</b> <span class="tag">lo manejás vos</span></div><small class="muted">${esc(c.efecto)}</small>
        <div class="kv"><span tabindex="0" data-tip-texto="Tu habilidad (${esc(hab)}) define cuánto rinde. Delegando en alguien capaz, puede rendir más.">Rinde</span><b>${cap}% de lo posible</b><span class="detalle">Cuesta</span><b class="detalle">tiempo y desgaste</b></div>
        <div class="btns"><button data-delegar="${esc(c.id)}" data-tip-texto="Elegís a alguien que lo maneje: ganás tiempo, pero dependés de su capacidad y su lealtad.">Delegar</button></div></div>`;
    }
    const body = t ? miembroCard(t) : `<small class="muted">Vacante${v ? ` · quedan ${Math.max(0, v.vence - g.day)} d` : ''}: elegí a alguien más abajo.</small>`;
    return `<div class="cargo ${t ? '' : 'vacante'}"><div class="c-title"><b>${esc(c.nombre)}</b> <span class="tag ${t ? '' : 'warn'}">delegado</span></div><small class="muted">${esc(c.efecto)}</small>${body}
      <div class="btns"><button data-retomar="${esc(c.id)}" data-tip-texto="Volvés a manejarlo vos. El titular queda sin cargo y le cae la lealtad.">Retomar</button></div></div>`;
  };
  const vacs = S.vacantes.filter(v => !v.zona || rank > P.referente.rango).map(v => `<div class="vacancia"><div class="c-title"><b>Vacante: ${esc(nombreVacante(g, v))}</b><small class="muted">Quedan ${Math.max(0, v.vence - g.day)} d; después asume un interino</small></div>
    ${v.candidatos.map(c => `<div class="candidato">${miembroCard(c)}<button data-designar="${esc(v.id)}" data-cand="${esc(c.id)}" ${c.costo > 0 && c.costo > g.player.money ? 'disabled' : ''}>Designar${c.costo ? ' · ' + money(c.costo) : ' · sin costo'}</button></div>`).join('')}</div>`).join('');
  const refsL = S.miembros.filter(m => m.cargo?.startsWith('ref:'));
  const coord = plantel.modo(g, 'territorial') === 'delegado' && titular(g, 'territorial');
  const refsHtml = rank <= P.referente.rango ? '' : coord
    ? `<h3>Referentes de barrio</h3><p class="small-p">${esc(coord.nombre)} los designa por vos: ${refsL.length} referente${refsL.length === 1 ? '' : 's'}${refsL.length ? `, capacidad media ${Math.round(refsL.reduce((a, m) => a + m.capacidad, 0) / refsL.length)}` : ''}.</p>`
    : refsL.length ? `<h3>Referentes de barrio</h3>${refsL.map(m => miembroCard(m, `<small class="muted">Referente de ${esc(g.zonas[m.cargo.slice(4)]?.nombre ?? 'un barrio')}</small>`)).join('')}` : '';
  const libres = S.miembros.filter(m => !m.cargo).map(m => miembroCard(m, '<small class="muted">Sin cargo: podés designarlo en una vacante.</small>')).join('');
  const sig = P.cargos.filter(c => rank <= c.rango).sort((a, b) => a.rango - b.rango)[0];
  return `<h3>Mi estructura</h3>
    <p class="small-p muted">${fund ? 'Sos la cabeza del partido: todo órgano es tuyo. Cada uno lo manejás vos o se lo delegás a alguien.' : 'Solo administrás lo que está por debajo de tu rango. Cada cargo lo manejás vos o lo delegás.'}</p>
    ${arriba.length ? `<div class="cargo cerrado" tabindex="0" data-tip-texto="Esos cargos los maneja la conducción hasta que subas de rango."><b>Conducción</b><small class="muted">${esc(g.rankName)}${g.linea?.lider ? ` · tu superior: ${esc(g.linea.lider.nombre)}` : ''}. Por encima tuyo: ${arriba.map(c => esc(c.nombre)).join(', ')} (rango ${esc(g.rangos[Math.min(...arriba.map(c => c.rango)) + 1] ?? '')}).</small></div>` : ''}
    ${mios.length ? `<div class="kv"><span tabindex="0" data-tip-texto="Cada cargo que manejás vos te resta tiempo (acciones más lentas) y suma desgaste. Delegar libera esa carga.">Carga propia</span><b>${car.n ? `${car.n} cargo${car.n > 1 ? 's' : ''} · +${Math.round(car.tiempo * 100)}% tiempo` : 'ninguna'}</b></div>` : `<p class="small-p">Todavía no tenés cargos bajo tu mando: hacés todo vos. ${sig ? `Con rango «${esc(g.rangos[P.referente.rango + 1])}» vas a poder organizar referentes y delegar.` : ''}</p>`}
    ${vacs ? `<div class="vacantes"><p class="small-p"><b>Hay vacantes por cubrir.</b> Elegí a quien tenga más capacidad y lealtad.</p>${vacs}</div>` : ''}
    ${mios.map(cardCargo).join('')}${refsHtml}${libres ? `<h3>Militantes sin cargo</h3>${libres}` : ''}`;
}

// Pestaña Yo: quién sos, qué sabés hacer, cómo estás y de qué vivís
const pips = (n, max = 5) => Array.from({ length: max }, (_, i) => `<i class="pip ${i < n ? 'on' : ''}"></i>`).join('');
function renderYo(g) {
  const J = g.jugador, V = g.cfg.vida, H = g.cfg.habilidades, E = V.efectosFamilia;
  const estado = personaje.estadoDesgaste(g), d = Math.round(J.desgaste);
  const desgasteHtml = `<div class="desgaste ${estado}"><div class="d-top"><span tabindex="0" data-tip="desgaste"><b>Desgaste</b></span><span>${d}/100 · ${estado}</span></div>
      <div class="bar"><i style="width:${d}%"></i></div>
      <button class="full" data-descansar ${g.freeSlots <= 0 || g.pending || J.descanso ? 'disabled' : ''}>${J.descanso ? 'Descansando…' : `Descansar ${V.desgaste.descansoDias} días`}</button>
      <small class="muted detalle">Sube cada día que estás ocupado, más con hijos; baja cuando estás libre y mucho más descansando. ${V.desgaste.alto}+ resta éxito y ${V.desgaste.critico}+ resta mucho.</small></div>`;
  const ramas = H.ramas.map(r => {
    const n = personaje.nivel(g, r.id), pr = personaje.progresoNivel(g, r.id), puedo = J.puntos > 0 && n < H.maximo;
    const ventajas = Object.entries(r.ventajas).map(([lvl, t]) => `<li class="${n >= +lvl ? 'on' : ''}"><b>Nivel ${lvl}</b> ${esc(t)}</li>`).join('');
    return `<div class="rama"><div class="r-top"><b>${esc(r.nombre)}</b><span class="pips">${pips(n)}</span><button data-habilidad="${esc(r.id)}" ${puedo ? '' : 'disabled'} aria-label="Subir ${esc(r.nombre)}">+1</button></div>
      ${pr ? `<div class="bar thin" title="Entrenamiento hacia el próximo nivel"><i style="width:${(pr.frac * 100).toFixed(0)}%"></i></div>` : '<small class="muted">La práctica ya no da más: solo con puntos.</small>'}
      <div class="detalle"><small class="muted">${esc(r.texto)} ${esc(r.porNivel)}.</small><ul class="ventajas">${ventajas}</ul></div></div>`;
  }).join('');
  const t = J.trabajo, tr = g.trasfondo;
  const cd = V.trabajo.enfriamiento - (g.day - t.ultimoCambio);
  const btnT = (estado, label, tip) => `<button data-trabajo="${estado}" ${t.estado === estado || t.estado === 'sin' || cd > 0 ? 'disabled' : ''} data-tip-texto="${esc(cd > 0 && t.estado !== 'sin' ? `Cambiaste hace poco: esperá ${cd} días.` : tip)}">${label}</button>`;
  const tiempo = personaje.tiempoMult(g, null), gastoFam = personaje.gastoFamiliar(g);
  return `<h2>${esc(J.nombre)}</h2>
    <p class="muted">${esc(g.rankName)} · ${esc(tr?.nombre ?? '')} · ${esc(personaje.familiaNombre(g))}</p>
    ${g.org ? `<h3>Notoriedad</h3><div class="desgaste"><div class="d-top"><span tabindex="0" data-tip="fama"><b>Fama</b></span><span>${Math.round(g.org.fama)}/100</span></div><div class="bar"><i style="width:${Math.round(g.org.fama)}%"></i></div><small class="muted">Da votos de opinión y poder de negociación, pero no estructura. Se enfría si no te mostrás.</small></div>` : ''}
    <h3>Cómo estás</h3>${desgasteHtml}
    <h3>Habilidades${J.puntos > 0 ? ` <span class="tag warn">${J.puntos} punto${J.puntos > 1 ? 's' : ''}</span>` : ''}</h3>
    <p class="muted small-p detalle">Se entrenan haciendo misiones afines y mejoran con los puntos que ganás al ascender.</p>${ramas}
    <h3>Trabajo</h3>
    <div class="trabajo"><div class="kv"><span>Situación</span><b>${esc(personaje.trabajoNombre(t.estado))}</b><span>Aporte mensual</span><b>${money(personaje.aporteTrabajo(g))}</b></div>
      <div class="btns">${btnT('completo', 'Jornada completa', 'Más ingreso, pero tus acciones tardan más.')}${btnT('reducido', 'Media jornada', 'La mitad del ingreso, a cambio de más tiempo para el partido.')}${btnT('sin', 'Dejar el trabajo', 'Sin ingreso propio, pero con todo el tiempo. No se puede revertir por tu cuenta.')}</div>
      ${t.estado === 'sin' ? '<small class="muted">Sin trabajo: espera una oportunidad. Con el tiempo pueden aparecer ofertas.</small>' : ''}</div>
    <h3>Familia</h3><div class="detalle-vacio"><p class="small-p">${esc(personaje.familiaNombre(g))}</p>
      <div class="kv detalle"><span>Gasto familiar</span><b>${money(gastoFam)}/mes</b><span>Tu tiempo disponible</span><b>${tiempo >= 1 ? '−' : '+'}${Math.round(Math.abs(1 - tiempo) * 100)}% rapidez</b><span>Cuánto te duele un escándalo</span><b>×${personaje.vulnerabilidad(g).toFixed(2)}</b></div>
      <small class="muted solo-rapido">Gasto ${money(gastoFam)}/mes · Más familia: más apoyo y gasto, y los escándalos duelen más.</small></div>`;
}

function renderPartido(g) {
  const cat = g.cfg.principios.principios, p = g.player;
  const mine = g.principios.map(x => `<div class="principle on static"><span><b>${esc(x.nombre)}</b><br><small>${esc(x.texto)}</small><br><small class="muted">${esc(modsTexto(x, g.cfg))}</small></span></div>`).join('');
  const rivals = rivalesDe(g).map(r =>
    `<div class="rival-line"><span class="dot" style="background:${r.color}"></span><span><b>${esc(r.nombre)}</b> <small class="muted">· ${esc(r.espacio)}</small><br><small>${esc(r.principios.map(id => cat.find(c => c.id === id)?.nombre).join(', '))}</small></span></div>`).join('');
  const next = g.nextXp;
  return `<h2>${esc(g.partido.nombre)}</h2>
    <p class="muted">${esc(g.rankName)}${g.trasfondo ? ` · ${esc(g.trasfondo.nombre)}` : ''}${next ? ` · ${p.xp}/${next} XP para el próximo rango` : ''}</p>
    <div class="bar"><i style="width:${next ? Math.min(100, (p.xp / next) * 100) : 100}%"></i></div>
    ${renderEscalafon(g)}
    ${renderPlantel(g)}
    ${renderLinea(g)}
    <h3>Nuestros principios</h3>${mine}
    <h3>Recursos</h3>
    <div class="kv"><span>Dinero blanco</span><b>${money(p.money)}</b><span>Dinero negro</span><b>${money(p.black)}</b><span>Exposición</span><b>${Math.round(g.exposure)}%</b><span>Seguidores</span><b>${g.followers.toLocaleString('es-AR')}</b><span>Intención de voto (ciudad)</span><b>${(g.intencionVoto * 100).toFixed(g.intencionVoto < 0.01 ? 3 : 1)}%</b></div>
    <h3>Otros partidos y lo que defienden</h3>${rivals}`;
}

function renderProvincia(g) {
  const pd = g.provData;
  const prov = pd ? `<p class="muted">${pd.poblacion2022.toLocaleString('es-AR')} hab. (Censo 2022) · ${pd.electores2025.toLocaleString('es-AR')} electores (padrón 2025)</p>` : '';
  return `<h2>${esc(g.prov.nombre)}</h2>${prov}${renderElectoral(g)}
    <p class="muted attrib">${g.city.fuente ? 'Barrios: © ' + esc(g.city.fuente) + '. Resto: fracciones censales' : g.city.fuentePoblacion ? 'Zonas: fracciones censales INDEC (sin barrios OSM en esta ciudad)' : 'Barrios sintéticos (sin datos reales para esta ciudad)'}${g.city.fuentePoblacion ? '<br>Población: ' + esc(g.city.fuentePoblacion) : ''}<br>Provincias: INDEC Censo 2022; padrón 2025 CNE/DINE.</p>`;
}

// Resultado de la última elección en la provincia (partidos ficticios)
function renderElectoral(g) {
  const ps = g.cfg.partidos?.partidos, pf = g.perfilElectoral[0];
  if (!ps || !pf) return '';
  const byId = Object.fromEntries(ps.map(p => [p.id, p]));
  const entries = Object.entries(pf.partidos).sort((a, b) => b[1] - a[1]);
  const bar = entries.map(([id, v]) => `<i style="width:${(v * 100).toFixed(1)}%;background:${byId[id].color}" title="${esc(byId[id].nombre)} ${pct(v)}"></i>`).join('');
  const legend = entries.slice(0, 5).map(([id, v]) => `<span><span class="dot" style="background:${byId[id].color}"></span>${esc(byId[id].nombre)} ${pct(v)}</span>`).join('');
  const lider = pf.lider ? byId[pf.lider].nombre : '—';
  return `<h3>Panorama electoral · ${esc(pf.año)}</h3>
    <div class="vote-bar">${bar}</div><div class="vote-legend">${legend}</div>
    <p class="muted small">Participación ${pct(pf.participacion)} · primera fuerza: ${esc(lider)}${pf.escrutinio === 'provisorio' ? ' · escrutinio provisorio' : ''}</p>`;
}

const FILTROS = [['todo', 'Todo'], ['rival', 'Rivales'], ['plata', 'Plata'], ['partido', 'Partido']];
const esPlata = e => /recaud|\$|dinero|cierre del mes|favor|aporte|plata|negro/i.test(e.text);
const esPartido = e => e.kind === 'linea' || e.kind === 'promo' || /plantel|vacante|ascend|designaste|directiva|superior|cuadro|pacto/i.test(e.text);

// Registro de novedades: 3 líneas por defecto, filtrable y desplegable
export function renderLog(g) {
  const { logFiltro: f, logAbierto: abierto } = uiState;
  const lista = g.log.filter(e => f === 'todo' || (f === 'rival' && e.kind === 'rival') || (f === 'plata' && esPlata(e)) || (f === 'partido' && esPartido(e)));
  const items = lista.slice(0, abierto ? 14 : 3).map(e => `<div class="ev ${e.kind}"><i class="k-dot"></i><span>${esc(e.text)}</span></div>`).join('') || '<div class="ev"><span class="muted">Sin novedades en este filtro.</span></div>';
  const chips = FILTROS.map(([id, l]) => `<button class="chip-f ${f === id ? 'on' : ''}" data-log-filtro="${id}" aria-pressed="${f === id}">${l}</button>`).join('');
  return `<div class="log-bar"><span class="chips-f">${chips}</span><button class="chip-f" data-log-toggle aria-expanded="${abierto}">${abierto ? 'Ver menos' : 'Ver más'}</button></div><div class="log-items ${abierto ? 'abierto' : ''}">${items}</div>`;
}

// Items para la superposición de progreso sobre el mapa
export function progresoMapa(g, day, acc) {
  return g.jobs.map(j => {
    const z = g.zonas[j.zone], f = jobFrac(j, day, acc);
    return { id: j.zone, cx: z.cx, cy: z.cy, frac: f, text: `${Math.round(f * 100)}%` };
  });
}

// Marcas de los rivales sobre el mapa (una por rival con acción en curso o planeada)
export function marcasRivales(g) {
  const porZona = {};
  return agenda(g).map(a => {
    const z = g.zonas[a.zona], i = (porZona[a.zona] = (porZona[a.zona] ?? -1) + 1);
    const r = g.rival(a.rival);
    return { key: `${a.zona}:${a.rival}`, cx: z.cx, cy: z.cy, i, color: r.color, planeada: a.fase === 'planeada', hostil: a.tipo === 'hostil', inicial: r.nombre[0], titulo: `${r.nombre}: ${a.fase === 'planeada' ? 'prepara ' : ''}${a.def.nombre.toLowerCase()}` };
  });
}
