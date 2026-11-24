// Vista Calendario: el año en 12 meses con los hitos (elecciones, institucional, feriados, partido) y los próximos. Cadenas HTML.
import * as cal from '../core/calendario.js';
import { Clock } from '../core/clock.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function mes(g, anio, m, porDia, hoy, color) {
  const primero = new Date(Date.UTC(anio, m - 1, 1)), lunes = (primero.getUTCDay() + 6) % 7, n = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const celdas = [...Array(lunes).fill('<span class="cal-d vacio"></span>')];
  for (let d = 1; d <= n; d++) {
    const dia = Clock.dayOf(anio, m, d), hs = porDia.get(dia) ?? [];
    const tip = hs.map(h => h.nombre).join(' · ');
    celdas.push(`<span class="cal-d ${dia === hoy ? 'hoy' : ''} ${hs.length ? 'hito' : ''}" ${tip ? `title="${esc(tip)}" tabindex="0"` : ''}>${d}${hs.length ? `<i class="cal-pts">${hs.slice(0, 3).map(h => `<b style="background:${color[h.cat] ?? '#999'}"></b>`).join('')}</i>` : ''}</span>`);
  }
  return `<section class="cal-mes ${anio === Clock.parts(hoy).anio && m === Clock.parts(hoy).mes ? 'actual' : ''}"><h4>${MESES[m - 1]}</h4><div class="cal-grid">${SEMANA.map(s => `<small>${s}</small>`).join('')}${celdas.join('')}</div></section>`;
}

export function renderCalendario(g, ui) {
  const cats = cal.categorias(g), hoy = g.day, anioHoy = Clock.parts(hoy).anio, anio = ui.calAnio ?? anioHoy;
  const activas = Object.keys(cats).filter(c => ui.calCats?.[c] !== false);
  const todos = cal.hitosDelAnio(g, anio).filter(h => activas.includes(h.cat));
  const porDia = new Map(); for (const h of todos) { if (!porDia.has(h.dia)) porDia.set(h.dia, []); porDia.get(h.dia).push(h); }
  const color = Object.fromEntries(Object.entries(cats).map(([id, c]) => [id, c.color]));
  const prox = cal.proximos(g, 12, 90).filter(h => activas.includes(h.cat));
  const fila = h => { const d = h.dia - hoy, cuando = d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} d`;
    return `<li class="cal-h"><i class="cal-dot" style="background:${color[h.cat] ?? '#999'}"></i><div><b>${esc(h.nombre)}</b> <small class="muted">${esc(Clock.format(h.dia))} · ${cuando}</small><p>${esc(h.texto)}</p></div>${h.ir ? `<button class="ghost" data-cal-ir='${esc(JSON.stringify(h.ir))}'>Ir</button>` : ''}</li>`; };
  const act = cal.ventanasActivas(g);
  return `<div class="cal-vista"><div class="cal-top"><h2>Calendario ${anio}</h2><div class="btns cal-nav"><button data-cal-anio="${anio - 1}" aria-label="Año anterior">‹</button><button data-cal-anio="${anioHoy}" ${anio === anioHoy ? 'disabled' : ''}>Hoy</button><button data-cal-anio="${anio + 1}" aria-label="Año siguiente">›</button></div></div>
    <div class="cal-filtros" role="group" aria-label="Filtrar por tipo">${Object.entries(cats).map(([id, c]) => `<button class="chip-f ${activas.includes(id) ? 'on' : ''}" data-cal-cat="${esc(id)}" aria-pressed="${activas.includes(id)}"><i style="background:${c.color}"></i>${esc(c.nombre)}</button>`).join('')}</div>
    ${act.length ? `<div class="cal-ventana">${act.map(v => `<p>✦ <b>${esc(v.hito.nombre)}</b>: ${esc(v.ventana.texto)}.</p>`).join('')}</div>` : ''}
    <div class="cal-cols"><div class="cal-meses">${MESES.map((_, i) => mes(g, anio, i + 1, porDia, hoy, color)).join('')}</div>
    <aside class="cal-prox"><h3>Próximos 90 días</h3>${prox.length ? `<ul>${prox.map(fila).join('')}</ul>` : '<p class="muted">No hay hitos cerca.</p>'}</aside></div></div>`;
}
