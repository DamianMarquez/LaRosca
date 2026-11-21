// Vista Organización (solo quien fundó el partido): estado legal, autoridades, afiliaciones y comités. Cadenas HTML.
import * as org from '../core/organizacion.js';
import { ve, nuevoSub } from '../core/revelado.js';
import * as el from '../core/elecciones.js';
import { rivales } from '../core/rivals.js';
import { relacion } from '../core/pactos.js';
import { renderPlantel, uiState } from './ui.js';
import { Clock } from '../core/clock.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const SUBS = [['estado', 'Estado legal'], ['autoridades', 'Autoridades'], ['afiliaciones', 'Afiliaciones'], ['comites', 'Comités'], ['notoriedad', 'Notoriedad'], ['acuerdos', 'Acuerdos'], ['finanzas', 'Finanzas']];

function escalera(g) {
  const E = g.cfg.organizacion.estados, i = E.findIndex(e => e.id === g.org.estado);
  return `<ol class="timeline" aria-label="Estados legales">${E.map((e, k) => `<li class="tl ${k < i ? 'hecho' : k === i ? 'ahora' : 'luego'}"><b>${esc(e.nombre)}</b><small>${esc(e.habilita)}</small></li>`).join('')}</ol>`;
}

function estado(g) {
  const o = g.org, q = org.requisitos(g), cur = org.estadoActual(g);
  const O = g.cfg.origenes, origen = O.origenes.find(x => x.id === o.origen), perfil = org.perfilDe(g, o.perfil);
  const madre = o.desprendeDe ? g.cfg.partidos.partidos.find(p => p.id === o.desprendeDe) : null;
  const items = q ? q.items.map(i => `<div class="req ${i.ok ? 'ok' : 'no'}"><span>${i.ok ? '✔' : '✖'}</span><span>${esc(i.texto)}</span><b>${esc(i.actual)}${i.meta != null ? ' / ' + esc(i.meta) : ''}</b></div>`).join('') : '';
  const tr = o.tramite;
  const accion = !q ? '<p class="small-p muted">Tu partido ya tiene el reconocimiento más alto.</p>'
    : tr ? `<div class="req ok"><span>⏳</span><span>Trámite de «${esc(org.estadoDef(g, tr.hacia).nombre)}» en curso</span><b>faltan ${Math.max(0, tr.hasta - g.day)} d</b></div>`
    : `<button class="primary full" data-org-tramite ${q.todos && g.player.money >= q.costo ? '' : 'disabled'}>${q.todos ? `Iniciar el trámite · ${money(q.costo)} · ${q.dias} días` : 'Todavía no cumplís los requisitos'}</button>
       <small class="muted">Si dejás de cumplir un requisito mientras se tramita, la justicia electoral lo observa y hay que empezar de nuevo.</small>`;
  const contactos = o.contactos.length ? o.contactos.map(c => `<div class="kv2"><span><b>${esc(c.nombre)}</b></span><span>${esc(g.cfg.partidos.partidos.find(p => p.id === c.partido)?.nombre ?? '')}</span><span>relación ${c.relacion}</span></div>`).join('') : '<p class="small-p muted">Sin contactos todavía.</p>';
  return `<div class="resumen-grid">
    <section class="card ancho-2"><h3>Estado legal: ${esc(cur.nombre)}</h3><p class="small-p">${esc(cur.texto)}</p>${escalera(g)}</section>
    <section class="card"><h3>${q ? `Próximo paso: ${esc(q.nombre)}` : 'Reconocimiento completo'}</h3>${q ? `<p class="small-p muted">${esc(q.texto)}</p><p class="small-p">Habilita: ${esc(q.habilita)}</p>${items}` : ''}${accion}</section>
    <section class="card"><h3>Tu origen</h3><p class="small-p"><b>${esc(origen?.nombre ?? '')}</b>${perfil ? ` · ${esc(perfil.nombre)}` : ''}${madre ? ` · te fuiste de ${esc(madre.nombre)}` : ''}</p>
      <div class="kv"><span tabindex="0" data-tip="fama">Notoriedad</span><b>${Math.round(o.fama)}/100</b><span class="detalle" tabindex="0" data-tip="influencia">Influencia</span><b class="detalle">${esc(g.rankName)}</b></div>
      <h4 class="grp-t">Contactos</h4>${contactos}</section></div>`;
}

function autoridades(g) {
  const q = org.requisitos(g), pend = q ? q.items.filter(i => i.organo && !i.ok).map(i => i.texto.replace('Autoridad cubierta: ', '')) : [];
  return `<div class="ancho-lectura"><p class="small-p">Los trámites legales exigen <b>autoridades con nombre</b>: para cubrir un órgano tenés que <b>delegarlo</b> en alguien del partido.${pend.length ? ` Para el próximo paso faltan: <b>${pend.map(esc).join(', ')}</b>.` : ''}</p>${renderPlantel(g)}</div>`;
}

function afiliaciones(g) {
  const padron = Object.values(g.zonas).reduce((s, z) => s + (g.electores(z) ?? Math.round(z.pop * 0.75)), 0), q = org.requisitos(g);
  const pc = padron ? (g.afiliados / padron) * 1000 : 0;
  const barrios = Object.values(g.zonas).filter(z => z.control >= 0.05).length;
  const kv = (a, b, d = '') => `<span class="${d}">${a}</span><b class="${d}">${b}</b>`;
  const meta = q?.items.find(i => i.id === 'afiliados');
  return `<div class="resumen-grid"><section class="card"><h3>Padrón de afiliados</h3>
    <div class="kv">${kv('Afiliados', g.afiliados.toLocaleString('es-AR'))}${kv('Padrón electoral de la ciudad', padron.toLocaleString('es-AR'))}${kv('Afiliados cada mil electores', pc.toFixed(1).replace('.', ','))}${kv('Barrios con presencia', barrios)}${kv('Seguidores', g.followers.toLocaleString('es-AR'), 'detalle')}</div>
    ${meta ? `<p class="small-p">Para el próximo reconocimiento hacen falta <b>${meta.meta.toLocaleString('es-AR')}</b> afiliados (tenés ${meta.actual.toLocaleString('es-AR')}).</p><div class="bar"><i style="width:${Math.min(100, (meta.actual / meta.meta) * 100)}%"></i></div>` : ''}
    <p class="small-p muted detalle">Los afiliados salen de tu control territorial y de tu notoriedad. Ficharlos a fondo exige comités y militantes.</p></section></div>`;
}

function comites(g) {
  const C = g.cfg.organizacion.comite, abiertos = org.comitesN(g);
  const zs = Object.values(g.zonas).sort((a, b) => b.control - a.control).slice(0, 30);
  const filas = zs.map(z => { const c = g.org.comites[z.id], puede = z.control >= C.control;
    return `<div class="kv2"><span><b>${esc(z.nombre)}</b></span><span class="muted">control ${Math.round(z.control * 100)}%</span><span>${c ? `<button data-org-cerrar="${esc(z.id)}">Cerrar</button>` : `<button data-org-comite="${esc(z.id)}" ${puede && g.player.money >= org.costoComite(g) ? '' : 'disabled'} data-tip-texto="${esc(puede ? 'Abrir un comité cuesta ' + money(org.costoComite(g)) : `Necesitás ${Math.round(C.control * 100)}% de control`)}">Abrir · ${money(org.costoComite(g))}</button>`}</span></div>`; }).join('');
  return `<div class="ancho-lectura"><p class="small-p">Un <b>comité</b> es una sede de barrio: frena a los rivales (la erosión de tu control se reduce a la mitad), aporta fiscales el día de la elección y cuenta para el reconocimiento. Cuesta ${money(Math.round(C.mensual * Math.max(0.35, Math.min(1, g.escala))))}/mes cada uno.</p>
    <div class="kv"><span>Comités abiertos</span><b>${abiertos}</b><span>Gasto mensual</span><b>${money(org.gastoComites(g))}</b></div>${filas}</div>`;
}

function acuerdos(g) {
  const P = g.elecciones.proceso, pago = uiState.cupoPago ?? 'apoyo', C = g.cfg.elecciones.cupo;
  const pagos = [['apoyo', 'Apoyo territorial', 'Tus barrios votan por su lista.'], ['dinero', 'Dinero', 'Aportás plata a su campaña.'], ['bloque', 'Compromiso de bloque', 'Tus electos responden a ellos hasta que rompas.']];
  const abierto = P && ['alianzas', 'listas'].includes(P.fase);
  const conts = P ? el.contiendasDe(g, P.tipo).filter(c => el.cupoElegible(g, c)) : [];
  const fila = c => {
    const cu = P.cupos[c.id], st = P.contiendas[c.id], max = el.maxLugares(g, c);
    if (cu) {
      const cand = el.candidatos(g, c.id);
      return `<div class="cont"><div class="cont-h"><b>${esc(c.titulo)}</b><span class="tag">cupo con ${esc(el.nombrePartido(g, cu.host))}</span></div>
        <small class="muted">${cu.lugares} lugar${cu.lugares === 1 ? '' : 'es'} (puestos ${(cu.posiciones ?? C.posiciones).slice(0, cu.lugares).join(', ')} de su lista) · ofreciste: ${esc(pagos.find(p => p[0] === cu.pago)?.[1] ?? '')}</small>
        <div class="cands">${cand.slice(0, 12).map(x => { const i = cu.lista.indexOf(x.id); return `<button class="cand ${i >= 0 ? 'on' : ''}" data-cupo-toggle="${esc(c.id)}" data-q="${esc(x.id)}">${i >= 0 ? `<b>${i + 1}.</b> ` : ''}${esc(x.nombre)}<small>cap. ${x.capacidad}</small></button>`; }).join('')}</div>
        <div class="btns"><button data-cupo-auto="${esc(c.id)}">Elegir a los mejores</button></div></div>`;
    }
    if (st.estado === 'presentada') return `<div class="cont"><div class="cont-h"><b>${esc(c.titulo)}</b><span class="tag">lista propia</span></div><small class="muted">Ya presentaste lista propia: no podés negociar un cupo.</small></div>`;
    const rs = rivales(g).map(r => { const rel = Math.round(relacion(g, r.id)), ya = P.cupoIntentos[r.id], p = el.probCupo(g, r.id, 1, pago);
      return `<div class="kv2"><span><span class="dot" style="background:${r.color}"></span><b>${esc(r.nombre)}</b></span><span class="muted">relación ${rel} · chance ~${Math.round(p * 20) * 5}%</span><span>${ya ? '<small class="muted">ya respondió</small>' : Array.from({ length: max }, (_, k) => `<button data-cupo="${esc(c.id)}|${esc(r.id)}|${k + 1}" ${!abierto ? 'disabled' : ''}>Pedir ${k + 1}</button>`).join(' ')}</span></div>`; }).join('');
    return `<div class="cont"><div class="cont-h"><b>${esc(c.titulo)}</b><span class="tag warn">sin cupo</span></div><small class="muted">Hasta ${max} lugar${max === 1 ? '' : 'es'}. Sin personería también podés competir así.</small>${rs}</div>`;
  };
  const bl = el.bloques(g), hosts = Object.keys(bl);
  const bloquesHtml = hosts.length ? hosts.map(h => `<div class="kv2"><span><b>Bloque con ${esc(el.nombrePartido(g, h))}</b></span><span class="muted">${bl[h].length} electo${bl[h].length === 1 ? '' : 's'}: ${bl[h].map(c => esc(c.nombre)).join(', ')}</span><button data-bloque-romper="${esc(h)}">Romper el bloque</button></div>`).join('') + `<p class="small-p muted">Mientras estás en el bloque, el socio te presta fiscales. Romper te deja con tus electos, pero con un enemigo nuevo y menos confianza entre los demás partidos.</p>` : '<p class="small-p muted">No tenés bloques: se forman cuando tus candidatos entran por un cupo.</p>';
  return `<div class="resumen-grid"><section class="card ancho-2"><h3>Cupos en listas ajenas</h3>
      <p class="small-p">Así empezaron muchos partidos: ir en la lista de otro, sumar bancas y visibilidad, y después abrirse. Se negocia entre la etapa de alianzas y el cierre de listas, una vez por socio y elección.</p>
      <div class="principles">${pagos.map(([id, n, t]) => `<label class="principle ${pago === id ? 'on' : ''}"><input type="radio" name="cupoPago" data-cupo-pago="${id}" ${pago === id ? 'checked' : ''}><span><b>${n}</b><br><small>${t}${id === 'dinero' ? ` (desde ${money(el.costoCupo(g, 1))} por lugar)` : ''}</small></span></label>`).join('')}</div>
      ${P ? `<h4 class="grp-t">Elecciones ${P.anio} · ${esc(el.FASE_NOMBRE[P.fase])}</h4>${conts.map(fila).join('') || '<p class="small-p muted">En esta elección no hay cargos con cupo.</p>'}` : ''}</section>
    <section class="card ancho-2"><h3>Bloques</h3>${bloquesHtml}</section></div>`;
}

function finanzas(g) {
  const o = g.org, F = g.cfg.organizacion.finanzas, fpp = org.ingresoFpp(g), r = o.rendicion, s = o.sancion && o.sancion.hasta > g.day;
  const prox = (() => { let d = g.day - (g.day % 365) + F.rendicionDia; if (d <= g.day) d += 365; return d; })();
  const kv = (a, b) => `<span>${a}</span><b>${b}</b>`;
  return `<div class="resumen-grid"><section class="card"><h3>Caja del partido</h3><div class="kv">${kv('Dinero blanco', money(g.player.money))}${kv('Dinero negro', money(g.player.black))}${kv('Deudas de favor', g.favores.length)}${kv('Exposición', Math.round(g.exposure) + '%')}${kv('Gasto de comités', money(org.gastoComites(g)) + '/mes')}</div></section>
    <section class="card"><h3>Fondo partidario permanente</h3><p class="small-p">Los partidos reconocidos (distrito o más) reciben un aporte mensual según los votos de su última elección (piso ${Math.round(F.fppMinPct * 100)}%).</p>
      <div class="kv">${kv('Aporte actual', fpp ? money(fpp) + '/mes' : '—')}${kv('Estado', s ? `suspendido ${o.sancion.hasta - g.day} d` : fpp ? 'vigente' : 'sin derecho todavía')}</div></section>
    <section class="card"><h3>Rendición de cuentas</h3><p class="small-p">Cada año la justicia electoral revisa tus libros. Dinero negro, deudas de favor y mucha exposición traen multa y suspensión del fondo.</p>
      <div class="kv">${kv('Última', r ? `${r.ok ? 'aprobada' : 'observada'} (${esc(Clock.format(r.dia))})` : 'todavía ninguna')}${kv('Próxima', esc(Clock.format(prox)))}</div></section></div>`;
}

function notoriedad(g) {
  const o = g.org, m = o.medios, ocupado = g.freeSlots <= 0 || !!m || g.pending || g.jugador.descanso;
  const lista = g.cfg.organizacion.medios.map(a => { const r = org.rendimientoMedios(g, a);
    return `<div class="medio"><div><b>${esc(a.nombre)}</b><br><small class="muted">${esc(a.texto)}</small><br><small>${a.dias} día${a.dias === 1 ? '' : 's'} · notoriedad +${(a.fama * r).toFixed(1).replace('.', ',')} · riesgo de escándalo ${Math.round(a.riesgo * (1 + o.controversia / 100) * 100)}%</small></div>
      <button data-org-medios="${esc(a.id)}" ${ocupado ? 'disabled' : ''}>Hacerlo</button></div>`; }).join('');
  const contactos = o.contactos.length ? o.contactos.map(c => `<div class="kv2"><span><b>${esc(c.nombre)}</b></span><span>${esc(g.cfg.partidos.partidos.find(p => p.id === c.partido)?.nombre ?? '')}</span><span>relación ${c.relacion}</span></div>`).join('') : '<p class="small-p muted">Sin contactos: se consiguen con la fama y los acuerdos.</p>';
  return `<div class="resumen-grid"><section class="card"><h3>Tu notoriedad</h3>
    <div class="desgaste"><div class="d-top"><span tabindex="0" data-tip="fama"><b>Fama</b></span><span>${Math.round(o.fama)}/100</span></div><div class="bar"><i style="width:${Math.round(o.fama)}%"></i></div></div>
    <div class="kv"><span>Controversia</span><b>${Math.round(o.controversia)}/100</b><span>Seguidores (con fans)</span><b>${g.followers.toLocaleString('es-AR')}</b><span>Voto de opinión</span><b>+${(g.cfg.elecciones.modelo.opinionPeso * Math.max(0, o.fama - 18) / 82 * 100).toFixed(0)} pts de fuerza por barrio</b></div>
    <p class="small-p muted">La fama da votos sin territorio y poder de negociación, pero se enfría si no te mostrás y no reemplaza a los comités y los fiscales: sin ellos perdés votos el día de la elección.</p>
    ${m ? `<div class="req ok"><span>🎙</span><span>${esc(org.medioDef(g, m.tipo).nombre)}</span><b>faltan ${Math.max(0, m.hasta - g.day)} d</b></div>` : ''}</section>
    <section class="card"><h3>Agenda mediática</h3>${lista}</section>
    <section class="card"><h3>Contactos</h3>${contactos}<p class="small-p muted detalle">Un contacto en un partido ayuda a armar frentes y acuerdos.</p></section></div>`;
}

export function renderOrganizacion(g) {
  if (!g.org) return '<h2 class="vista-h">Organización</h2><p class="muted">Esta sección es para quien funda un partido.</p>';
  const subs = SUBS.filter(([id]) => id === 'estado' || ve(g, `org.${id}`));
  const sub = subs.some(([id]) => id === uiState.osub) ? uiState.osub : 'estado';
  const nav = `<nav class="subtabs" role="tablist">${subs.map(([id, l]) => `<button role="tab" data-osub="${id}" class="${id === sub ? 'on' : ''}" aria-selected="${id === sub}">${l}${nuevoSub(g, 'organizacion', id) ? ' <span class="nuevo">Nuevo</span>' : ''}</button>`).join('')}</nav>`;
  const cuerpo = sub === 'acuerdos' ? acuerdos(g) : sub === 'finanzas' ? finanzas(g) : sub === 'notoriedad' ? notoriedad(g) : sub === 'autoridades' ? autoridades(g) : sub === 'afiliaciones' ? afiliaciones(g) : sub === 'comites' ? comites(g) : estado(g);
  return `<h2 class="vista-h">Organización de ${esc(g.partido.nombre)}</h2>${nav}<div class="psub-body">${cuerpo}</div>`;
}
