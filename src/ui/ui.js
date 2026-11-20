// Vistas HTML (cadenas). Sin estado propio.
import { amenaza, presencia, efectosActivos, choques, agenda, certeza, presenciaCiudad, defAccion } from '../core/rivals.js';
import { progreso as progresoDirectiva, etiqueta as etiquetaRelacion } from '../core/linea.js';
import { NOMBRE_MAX } from '../core/save.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const pct = v => Math.round(v * 100) + '%';
const approx5 = v => '~' + Math.round(v * 20) * 5 + '%';          // estimaciones: nunca exactas
const jobFrac = (j, day, acc = 0) => Math.min(1, Math.max(0, (day - j.start + acc) / (j.end - j.start)));

export const TABS = [['zona', 'Zona'], ['rivales', 'Rivales'], ['partido', 'Partido'], ['provincia', 'Provincia']];

// ---------- Barra superior ----------
export function renderStats(g) {
  const p = g.player, next = g.nextXp;
  return `<span title="Tu rango en el partido">🎖 ${esc(g.rankName)}${next ? ` <small>(${p.xp}/${next} XP)</small>` : ''}</span>
    <span title="Dinero blanco del partido">💵 ${money(p.money)}</span>
    <span title="Dinero negro: fondos opacos, más eficaces pero aumentan la exposición">🕶 ${money(p.black)}</span>
    <span class="expo ${g.exposure >= 60 ? 'hi' : g.exposure >= 30 ? 'mid' : ''}" title="Exposición: riesgo diario de escándalo por uso de dinero opaco">⚠ ${Math.round(g.exposure)}%</span>
    <span title="Seguidores estimados">👥 ${g.followers.toLocaleString('es-AR')}</span>
    <span title="Intención de voto de tu partido en la ciudad">🗳 ${(g.intencionVoto * 100).toFixed(g.intencionVoto < 0.01 ? 3 : 1)}%</span>`;
}

// ---------- Fundación del partido ----------
export function renderFundacion(cfg, provincia, estado) {
  const cat = cfg.principios.principios, k = cfg.principios.elegir;
  const cards = cat.map(p => {
    const on = estado.principios.includes(p.id), full = estado.principios.length >= k && !on;
    return `<label class="principle ${on ? 'on' : ''} ${full ? 'off' : ''}">
      <input type="checkbox" data-principio="${esc(p.id)}" ${on ? 'checked' : ''} ${full ? 'disabled' : ''}>
      <span><b>${esc(p.nombre)}</b><br><small>${esc(p.texto)}</small><br><small class="muted">${esc(modsTexto(p, cfg))}</small></span></label>`;
  }).join('');
  const rivales = cfg.partidos.partidos.filter(p => p.id !== 'otros').map(p =>
    `<div class="rival-line"><span class="dot" style="background:${p.color}"></span><span><b>${esc(p.nombre)}</b> · <small class="muted">${esc(p.principios.map(id => cat.find(c => c.id === id)?.nombre).join(', '))}</small></span></div>`).join('');
  return `<div class="city">Fundación · ${esc(provincia)}</div><h2>Fundá tu partido</h2>
    <label class="field">Nombre del partido
      <input id="party-name" type="text" maxlength="${NOMBRE_MAX}" value="${esc(estado.nombre)}" placeholder="Ej.: Vecinos en Acción" autocomplete="off"></label>
    <h3>Tus principios (elegí ${k}) · ${estado.principios.length}/${k}</h3>
    <div class="principles">${cards}</div>
    <p class="muted small">Son la identidad de tu partido: marcan cómo trabajás y qué te cuesta. Más adelante serán la base de tus habilidades.</p>
    <h3>Otros partidos y lo que defienden</h3>${rivales}
    <p id="founding-error" class="error" role="alert">${esc(estado.error ?? '')}</p>
    <button id="found-confirm" class="primary">Fundar el partido</button>`;
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
    const lock = (c.money ?? 0) > g.player.money ? 'Falta dinero blanco' : (c.black ?? 0) > g.player.black ? 'Falta dinero negro' : null;
    return `<button data-event-choice="${i}" ${lock ? 'disabled' : ''}>${esc(op.label)}<small>${esc(lock ?? (parts.join(' · ') || 'Sin costo'))}</small></button>`;
  }).join('');
  return `<div class="modal"><div class="card ${ev.tipo === 'escandalo' ? 'scandal' : ''}"><h2>${esc(ev.titulo)}</h2><p>${esc(ev.texto)}</p><div class="choices">${ops}</div></div></div>`;
}

// ---------- Acciones en curso (siempre visibles arriba del panel) ----------
export function renderAcciones(g, day) {
  const jobs = g.jobs.map((j, i) => {
    const m = g.mission(j.mission), f = jobFrac(j, day);
    return `<div class="job" data-job-zone="${esc(j.zone)}">
      <div class="job-head"><b>${esc(m.nombre)}</b><span class="badge">${j.modo === 'delegada' ? '🤝 Equipo' : '🧍 Vos'}${j.pago === 'negro' ? ' · 🕶' : ''}</span></div>
      <div class="job-sub">${esc(g.zonas[j.zone].nombre)} · termina en <span data-job-eta="${i}">${Math.max(0, j.end - day)}</span> d</div>
      <div class="bar big"><i data-job-bar="${i}" style="width:${(f * 100).toFixed(1)}%"></i><span data-job-pct="${i}">${Math.round(f * 100)}%</span></div></div>`;
  }).join('');
  const free = g.freeSlots > 0;
  const equipo = g.equipo > 0 ? `🤝 Equipo ${g.freeEquipo}/${g.equipo} libres` : `🤝 Equipo: desde ${esc(g.cfg.ranks[g.cfg.delegacion.rangoMin])}`;
  return `<section class="actions"><div class="actions-head"><h3>En curso</h3>
      <span class="slots"><span class="${free ? 'free' : 'busy-txt'}">🧍 ${free ? 'Libre' : 'Ocupado'}</span> · ${equipo}</span></div>
    ${jobs || '<p class="muted">Sin acciones en curso. Sos una sola persona: una acción personal a la vez.</p>'}</section>`;
}

// ---------- Pestañas ----------
export function renderPanel(g, zoneId, day, tab = 'zona') {
  const tabs = `<nav class="tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" data-tab="${id}" class="${id === tab ? 'on' : ''}" aria-selected="${id === tab}">${label}${id === 'partido' && g.linea?.directiva?.estado === 'propuesta' ? ' <span class="ping" title="Hay una bajada de línea esperando respuesta">●</span>' : ''}</button>`).join('')}</nav>`;
  const body = tab === 'partido' ? renderPartido(g) : tab === 'provincia' ? renderProvincia(g) : tab === 'rivales' ? renderTabRivales(g) : renderZona(g, zoneId);
  return `<div class="city">${esc(g.partido.nombre)} · ${esc(g.city.ciudad)}, ${esc(g.prov.nombre)}</div>${renderAcciones(g, day)}${tabs}<div class="tab-body">${body}</div>`;
}

function btnLabel(lock, ok) { return lock ? esc(lock) : ok; }

const diasTxt = n => (n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} d`);
const certTxt = c => (c === 'confirmado' ? '✔ confirmado' : '❓ rumor');

// Línea de aviso: qué hace un rival que se cruza con la misión que estás planificando y qué riesgo trae
function avisoChoque(g, c) {
  const r = g.rival(c.rival), a = c.accion;
  const que = c.tipo === 'propia' ? `${a.texto}` : c.enCurso ? `tiene en curso «${a.nombre.toLowerCase()}»` : `planea «${a.nombre.toLowerCase()}» (${diasTxt(c.enDias)})`;
  const efecto = `${c.chance} puntos de éxito${c.bloqueo ? ' y bloquea la misión' : ''}`;
  return `<div class="clash ${c.certeza}"><span class="dot" style="background:${r.color}"></span><span>⚠ <b>${esc(r.nombre)}</b> ${esc(que)} · <em>${certTxt(c.certeza)}</em> → ${esc(efecto)}</span></div>`;
}

function renderZona(g, zoneId) {
  if (!zoneId) return '<p class="muted">Elegí un barrio en el mapa para ver sus datos, a los rivales que hay y lanzar misiones.</p>';
  const z = g.zonas[zoneId], cfg = g.cfg;
  const ms = cfg.missions.map(m => {
    const lock = g.canStart(m, zoneId), ch = g.chance(m, z), al = g.alcance(m, z);
    const why = ch.factors.map(f => `<li class="${f[1] < 0 ? 'neg' : 'pos'}"><span>${esc(f[0])}</span><b>${f[1] >= 0 ? '+' : ''}${f[1]}</b></li>`).join('');
    const delLock = g.canStart(m, zoneId, 'blanco', 'delegada');
    const avisos = choques(g, m, zoneId, g.day, g.day + m.dias).map(c => avisoChoque(g, c)).join('');
    return `<div class="mission ${lock ? 'locked' : ''}">
      <div><b>${esc(m.nombre)}</b><br><small class="muted">${esc(m.desc)}</small></div>
      <div class="meta"><span>⏱ ${m.dias} d</span><span>💵 ${money(m.costo)}</span><span>🎯 éxito ${ch.c}%</span><span>👥 ~${al.personas.toLocaleString('es-AR')} pers. (+${(al.control * 100).toFixed(1)}% control)</span></div>
      ${avisos}
      <details><summary>Por qué ${ch.c}%</summary><ul class="factors">${why}</ul></details>
      <div class="btns"><button data-start="${m.id}" ${lock ? 'disabled' : ''}>${btnLabel(lock, 'Lanzar yo')}</button>
        ${m.negro ? negroBtn(g, m, z, zoneId) : ''}
        <button data-start="${m.id}" data-modo="delegada" ${delLock ? 'disabled' : ''} title="${delLock ? esc(delLock) : 'Un equipo la hace por vos, con menos éxito'}">🤝 Delegar${delLock ? ' 🔒' : ''}</button></div></div>`;
  }).join('');
  return `<h2>${esc(z.nombre)}</h2>
    <p class="muted">${z.pop.toLocaleString('es-AR')} hab.${z.popFuente ? '' : ' (est.)'}${z.densidad ? ' · ' + z.densidad.toLocaleString('es-AR') + ' hab/km²' : ''}${g.electores(z) !== null ? ' · ~' + g.electores(z).toLocaleString('es-AR') + ' electores' : ''}<br>
    Control ${pct(z.control)} · Confianza ${Math.round(z.trust)}</p>
    <h3>Misiones</h3>${ms}${renderRivales(g, z)}`;
}

function negroBtn(g, m, z, zoneId) {
  const lock = g.canStart(m, zoneId, 'negro'), ch = g.chance(m, z, 'negro').c;
  return `<button class="negro" data-start="${m.id}" data-pago="negro" ${lock ? 'disabled' : ''} title="Éxito ${ch}% · exposición +${Math.round(m.negro.expo * g.modsPrincipios(m).expoMult)}">🕶 ${lock ? esc(lock) : 'Con negro · ' + ch + '%'}</button>`;
}

// Rivales en la zona: presencia, principios, estimación de reacciones y acciones vigentes
function renderRivales(g, z) {
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
      <small class="muted">${esc(ps)}</small>${react}</div>`;
  }).join('');
  const nivelTxt = { ninguna: 'Todavía no te toman como amenaza: con poco control en el barrio, los rivales no reaccionan.', baja: 'Riesgo de reacción rival: <b>bajo</b>.', media: 'Riesgo de reacción rival: <b class="mid">medio</b>.', alta: 'Riesgo de reacción rival: <b class="hi">alto</b>.' }[am.nivel];
  return `<h3>Rivales en la zona <small class="muted">(estimación)</small></h3><p class="muted small-p">${nivelTxt}</p>${enZona}${activos}${rows}`;
}

// Pestaña Rivales: qué está haciendo cada partido ahora y qué hizo hace poco
function renderTabRivales(g) {
  const cat = g.cfg.principios.principios, ag = Object.fromEntries(agenda(g).map(a => [a.rival, a]));
  const rs = g.cfg.partidos.partidos.filter(r => r.id !== 'otros').sort((a, b) => presenciaCiudad(g, b.id) - presenciaCiudad(g, a.id));
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
    return `<div class="rcard"><div class="rival-top"><span class="dot" style="background:${r.color}"></span><span class="rn">${esc(r.nombre)}</span><span class="rp" title="Presencia media en la ciudad (estimada)">${approx5(presenciaCiudad(g, r.id))}</span></div>
      <small class="muted">${esc(r.espacio)} · ${esc(r.principios.map(id => cat.find(c => c.id === id)?.nombre).join(', '))}</small>${estado}</div>`;
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
  if (!L?.lider) return '<h3>Línea partidaria</h3><p class="muted small-p">Sos la máxima conducción: no tenés superior.</p>';
  const l = L.lider, rel = Math.round(l.relacion), et = etiquetaRelacion(g, rel);
  const ps = l.principios.map(id => cat.find(c => c.id === id)?.nombre).filter(Boolean).map(n => `<span class="chip ${g.partido.principios.includes(cat.find(c => c.nombre === n)?.id) ? 'common' : ''}">${esc(n)}</span>`).join('');
  let dir;
  const d = L.directiva;
  if (!d) dir = `<p class="muted small-p">Sin directivas por ahora. La próxima baja de línea llega en unos ${Math.max(1, L.proxima - g.day)} días.</p>`;
  else {
    const quien = d.fuente === 'partido' ? 'Línea partidaria' : `${esc(l.nombre)}`;
    if (d.estado === 'propuesta') dir = `<div class="directive new"><small class="muted">${quien} baja línea · respondé en ${Math.max(0, d.venceRespuesta - g.day)} d</small><p>${esc(d.texto)}</p>
      <div class="btns"><button class="primary" data-linea="aceptar">Aceptar</button><button data-linea="rechazar">Rechazar</button></div>
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

function renderPartido(g) {
  const cat = g.cfg.principios.principios, p = g.player;
  const mine = g.principios.map(x => `<div class="principle on static"><span><b>${esc(x.nombre)}</b><br><small>${esc(x.texto)}</small><br><small class="muted">${esc(modsTexto(x, g.cfg))}</small></span></div>`).join('');
  const rivals = g.cfg.partidos.partidos.filter(r => r.id !== 'otros').map(r =>
    `<div class="rival-line"><span class="dot" style="background:${r.color}"></span><span><b>${esc(r.nombre)}</b> <small class="muted">· ${esc(r.espacio)}</small><br><small>${esc(r.principios.map(id => cat.find(c => c.id === id)?.nombre).join(', '))}</small></span></div>`).join('');
  const next = g.nextXp;
  return `<h2>${esc(g.partido.nombre)}</h2>
    <p class="muted">${esc(g.rankName)}${next ? ` · ${p.xp}/${next} XP para el próximo rango` : ''}</p>
    <div class="bar"><i style="width:${next ? Math.min(100, (p.xp / next) * 100) : 100}%"></i></div>
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

export function renderLog(g) {
  return g.log.slice(0, 8).map(e => `<div class="ev ${e.kind}">${esc(e.text)}</div>`).join('');
}

// Items para la superposición de progreso sobre el mapa
export function progresoMapa(g, day, acc) {
  return g.jobs.map(j => {
    const z = g.zonas[j.zone], f = jobFrac(j, day, acc);
    return { id: j.zone, cx: z.cx, cy: z.cy, frac: f, text: `${g.mission(j.mission).nombre} ${Math.round(f * 100)}%` };
  });
}

// Marcas de los rivales sobre el mapa (una por rival con acción en curso o planeada)
export function marcasRivales(g) {
  const porZona = {};
  return agenda(g).map(a => {
    const z = g.zonas[a.zona], i = (porZona[a.zona] = (porZona[a.zona] ?? -1) + 1);
    const r = g.rival(a.rival);
    return { key: `${a.zona}:${a.rival}`, cx: z.cx, cy: z.cy, i, color: r.color, planeada: a.fase === 'planeada', hostil: a.tipo === 'hostil', titulo: `${r.nombre}: ${a.fase === 'planeada' ? 'prepara ' : ''}${a.def.nombre.toLowerCase()}` };
  });
}
