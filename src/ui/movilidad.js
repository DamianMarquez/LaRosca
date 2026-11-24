// Movilidad (HTML): línea de viaje en la zona, tarjeta "En camino" y panel de medios y mejoras. Cadenas, sin estado propio.
import * as mov from '../core/movilidad.js';
import { restante } from '../core/hora.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const dur = dias => restante(dias);

// En la ficha de una zona: cuánto te lleva llegar y con qué medio (ida y vuelta a casa); se puede elegir si ya viste la movilidad
export function renderViajeZona(g, zoneId, detalle) {
  const M = g.movilidad, z = g.zonas[zoneId];
  const casaBtn = () => { const lock = g.motivoMudanza(zoneId); return M.casa === zoneId ? '<span class="chip lock">🏠 Tu casa</span>' : `<button class="chip" data-mov-mudarse="${esc(zoneId)}" ${lock ? 'disabled' : ''} data-tip-texto="${esc(lock ?? `Mudarte acá cuesta ${money(g.cfg.movilidad.mudanza.costo)}: después de cada acción volvés a este barrio.`)}">🏠 Vivir en este barrio${lock ? ` · ${esc(lock)}` : ''}</button>`; };
  if (M.viaje) return `<div class="viaje-zona"><span>🧭 ${M.viaje.etapa === 'vuelta' ? 'Volviendo a casa' : `Estás de viaje a <b>${esc(g.zonas[M.viaje.hasta].nombre)}</b>`}.</span></div>`;
  if (!z) return '';
  if (M.ubicacion === zoneId) return `<div class="viaje-zona aca"><span>📍 Estás acá${M.casa === zoneId ? ' (tu casa)' : ''}: lanzás sin viajar.</span>${detalle ? casaBtn() : ''}</div>`;
  const ops = g.opcionesViaje(zoneId), plan = mov.planear(g, zoneId);
  if (!plan) return `<div class="viaje-zona aca"><span>📍 Está a la vuelta: lanzás sin demora.</span></div>`;
  const chips = detalle ? `<div class="v-chips">${ops.map(o => `<button class="chip ${o.id === plan.medio ? 'on' : ''}" data-mov-medio="${esc(o.id)}" ${o.ok ? '' : 'disabled'} data-tip-texto="${esc(`${o.km} km · ida ${dur(o.dias)}${o.kmVuelta ? ` · vuelta ${dur(o.diasVuelta)}` : ''}${o.costo ? ` · ida y vuelta ${money(o.costo)}` : ' · gratis'}${o.motivo ? ` · ${o.motivo}` : ''}`)}">${o.icono} ${esc(o.nombre)} · ${dur(o.dias)}${o.costo ? ` · ${money(o.costo)}` : ''}</button>`).join('')}${casaBtn()}</div>` : '';
  const m = g.cfg.movilidad.medios.find(x => x.id === plan.medio);
  return `<div class="viaje-zona"><span>🧭 Desde <b>${esc(g.zonas[M.ubicacion].nombre)}</b>: ${m.icono} ${esc(m.nombre.toLowerCase())} · ${plan.km} km · ida <b>${dur(plan.dias)}</b>${plan.vuelta ? ` y vuelta a casa` : ''}${plan.costo ? ` · ${money(plan.costo)} ida y vuelta` : ''}. La acción arranca al llegar.</span></div>${chips}`;
}

// En "En curso": el viaje con barra de avance (se actualiza cada frame desde main.js)
export function renderViajeActivo(g, day) {
  const v = g.movilidad.viaje; if (!v) return '';
  const p = g.posicionJugador(), m = g.cfg.movilidad.medios.find(x => x.id === v.medio), mis = v.pendiente && g.mission(v.pendiente.mision), vuelta = v.etapa === 'vuelta';
  return `<div class="job viaje ${vuelta ? 'vuelta' : ''}"><div class="job-head"><b>${m.icono} ${vuelta ? 'Volviendo a casa' : `Yendo a ${esc(g.zonas[v.hasta].nombre)}`}</b><span class="badge">Vos</span></div>
    <div class="job-sub">${esc(g.zonas[v.desde].nombre)} → ${esc(g.zonas[v.hasta].nombre)}${mis ? ` · después: ${esc(mis.nombre)}` : ''} · llega en <span data-viaje-eta>${restante(p?.restante ?? 0)}</span></div>
    <div class="bar big"><i data-viaje-bar style="width:${((p?.frac ?? 0) * 100).toFixed(1)}%"></i><span></span></div>
    ${vuelta ? '<small class="muted">Tu acción queda ocupada hasta que llegues.</small>' : '<button class="ghost" data-mov-cancelar>Cancelar viaje</button>'}</div>`;
}

// Panel en "Yo": medios disponibles y rama de mejoras
export function renderMovilidad(g) {
  const C = g.cfg.movilidad, M = g.movilidad, tiene = id => M.mejoras.includes(id);
  const usables = g.medios.map(m => mov.stats(g, m.id));
  const medios = `<div class="mov-medios">${usables.map(s => `<button class="chip ${M.preferido === s.id ? 'on' : ''}" data-mov-medio="${esc(s.id)}" data-tip-texto="${esc(`${Math.round(s.kmh)} km/h · ${s.costoFijo || s.costoKm ? `${money(s.costoFijo)} + ${money(s.costoKm)}/km` : 'gratis'}`)}">${s.icono} ${esc(s.nombre)}</button>`).join('')}</div>
    <small class="muted">${M.preferido ? 'Medio preferido: ' + esc(C.medios.find(m => m.id === M.preferido).nombre) + '. ' : 'Sin preferencia: se elige el más rápido que no salga caro. '}Tocá un medio para fijarlo como preferido.</small>`;
  const futuros = C.medios.filter(m => m.disponible === false).map(m => `<span class="chip lock" data-tip-texto="Llega con el mapa ${m.alcance === 'nacional' ? 'nacional' : 'interurbano'}.">${m.icono} ${esc(m.nombre)}</span>`).join('');
  const mejoras = C.mejoras.map(x => {
    const lock = mov.motivoCompra(g, x.id), tengo = tiene(x.id), lejos = g.guia?.progresivo && g.day < (x.minDia ?? 0) - 10;
    if (lejos && !tengo) return '';
    return `<div class="mejora ${tengo ? 'on' : ''}"><div><b>${tengo ? '✔ ' : ''}${esc(x.nombre)}</b><p class="muted">${esc(x.texto)}</p></div>
      <button data-mov-comprar="${esc(x.id)}" ${lock ? 'disabled' : ''}>${tengo ? 'Tenés' : lock ? esc(lock) : `Comprar ${money(x.costo)}`}</button></div>`;
  }).join('');
  return `<section class="movilidad"><h3>Movilidad</h3><p class="muted">Viajar a otro barrio lleva tiempo y un pasaje simbólico: la acción arranca cuando llegás y después volvés a casa. El equipo, en cambio, no viaja. Tu casa: <b>${esc(g.zonas[M.casa]?.nombre ?? '—')}</b>.</p>
    ${medios}<div class="mov-futuros">${futuros}</div><h4>Mejoras</h4>${mejoras}</section>`;
}
