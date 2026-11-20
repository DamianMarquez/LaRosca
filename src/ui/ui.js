// Vistas HTML (cadenas). Sin estado propio.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const pct = v => Math.round(v * 100) + '%';

export function renderStats(g) {
  const p = g.player, next = g.nextXp;
  return `<span title="Rango">🎖 ${esc(g.rankName)}${next ? ` <small>(${p.xp}/${next} XP)</small>` : ''}</span>
    <span title="Dinero blanco del partido">💵 ${money(p.money)}</span>
    <span title="Bloques personales libres">⏳ ${g.freeSlots}/${g.slots}</span>
    <span title="Dinero negro: fondos opacos, más eficaces pero aumentan la exposición">🕶 ${money(p.black)}</span>
    <span class="expo ${g.exposure >= 60 ? 'hi' : g.exposure >= 30 ? 'mid' : ''}" title="Exposición: riesgo diario de escándalo por uso de dinero opaco">⚠ ${Math.round(g.exposure)}%</span>
    <span title="Seguidores estimados">👥 ${g.followers.toLocaleString('es-AR')}</span>
    <span title="Intención de voto de tu partido en la ciudad">🗳 ${(g.intencionVoto * 100).toFixed(g.intencionVoto < 0.01 ? 3 : 1)}%</span>`;
}

function negroBtn(g, m, z, zoneId) {
  const lock = g.canStart(m, zoneId, 'negro'), ch = g.chance(m, z, 'negro').c;
  return `<button class="negro" data-start="${m.id}" data-pago="negro" ${lock ? 'disabled' : ''} title="Éxito ${ch}% · exposición +${m.negro.expo}">🕶 ${lock ? esc(lock) : 'Con negro · ' + ch + '%'}</button>`;
}

// Modal de evento: contexto, opciones con su costo y los motivos por los que no se pueden elegir
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

export function renderPanel(g, zoneId, day) {
  const jobs = g.jobs.map((j, i) => {
    const m = g.mission(j.mission);
    return `<div class="job"><b>${esc(m.nombre)}</b> · ${esc(g.zonas[j.zone].nombre)}
      <div class="bar"><i data-job-bar="${i}" style="width:${((day - j.start) / (j.end - j.start)) * 100}%"></i></div>
      <small class="muted">termina en ${j.end - day} d</small></div>`;
  }).join('') || '<p class="muted">Sin misiones en curso.</p>';

  let zone = '<p class="muted">Elegí un barrio en el mapa para ver sus datos y lanzar misiones.</p>';
  if (zoneId) {
    const z = g.zonas[zoneId];
    const ms = g.cfg.missions.map(m => {
      const lock = g.canStart(m, zoneId), ch = g.chance(m, z);
      const why = ch.factors.map(f => `${f[0]}: ${f[1] >= 0 ? '+' : ''}${f[1]}`).join(' · ');
      return `<div class="mission ${lock ? 'locked' : ''}">
        <div><b>${esc(m.nombre)}</b><br><small class="muted">${esc(m.desc)}</small></div>
        <div class="meta"><small>${m.dias} d · ${money(m.costo)} · éxito ${ch.c}% · alcance ~${g.alcance(m, z).personas.toLocaleString('es-AR')} pers. (+${(g.alcance(m, z).control * 100).toFixed(1)}% control)</small><br><small class="muted" title="${esc(why)}">${esc(why)}</small></div>
        <div class="btns"><button data-start="${m.id}" ${lock ? 'disabled' : ''}>${lock ? esc(lock) : 'Lanzar'}</button>${m.negro ? negroBtn(g, m, z, zoneId) : ''}</div></div>`;
    }).join('');
    zone = `<h2>${esc(z.nombre)}</h2>
      <p class="muted">${z.pop.toLocaleString('es-AR')} hab.${z.popFuente ? '' : ' (est.)'}${z.densidad ? ' · ' + z.densidad.toLocaleString('es-AR') + ' hab/km²' : ''}${g.electores(z) !== null ? ' · ~' + g.electores(z).toLocaleString('es-AR') + ' electores' : ''}<br>Control ${pct(z.control)} · Confianza ${Math.round(z.trust)}</p>
      <h3>Misiones</h3>${ms}`;
  }
  const pd = g.provData;
  const prov = pd ? `<p class="muted prov">${esc(g.prov.nombre)}: ${pd.poblacion2022.toLocaleString('es-AR')} hab. · ${pd.electores2025.toLocaleString('es-AR')} electores</p>` : '';
  return `<div class="city">${esc(g.city.ciudad)}, ${esc(g.prov.nombre)}</div>${prov}${renderElectoral(g)}${zone}<h3>En curso</h3>${jobs}
    <p class="muted attrib">${g.city.fuente ? 'Barrios: © ' + esc(g.city.fuente) + '. Resto: fracciones censales' : g.city.fuentePoblacion ? 'Zonas: fracciones censales INDEC (sin barrios OSM en esta ciudad)' : 'Barrios sintéticos (sin datos reales para esta ciudad)'}${g.city.fuentePoblacion ? '<br>Población: ' + esc(g.city.fuentePoblacion) : ''}<br>Provincias: INDEC Censo 2022; padrón 2025 CNE/DINE.</p>`;
}

// Resultado de la última elección en la provincia (partidos ficticios) + tu intención de voto en la ciudad
function renderElectoral(g) {
  const ps = g.cfg.partidos?.partidos, pf = g.perfilElectoral[0];
  if (!ps || !pf) return '';
  const byId = Object.fromEntries(ps.map(p => [p.id, p]));
  const entries = Object.entries(pf.partidos).sort((a, b) => b[1] - a[1]);
  const bar = entries.map(([id, v]) => `<i style="width:${(v * 100).toFixed(1)}%;background:${byId[id].color}" title="${esc(byId[id].nombre)} ${pct(v)}"></i>`).join('');
  const legend = entries.slice(0, 4).map(([id, v]) => `<span><b style="background:${byId[id].color}"></b>${esc(byId[id].nombre)} ${pct(v)}</span>`).join('');
  const lider = pf.lider ? byId[pf.lider].nombre : '—';
  return `<h3>Panorama electoral · ${esc(pf.año)}</h3>
    <div class="vote-bar">${bar}</div><div class="vote-legend">${legend}</div>
    <p class="muted small">Participación ${pct(pf.participacion)} · primera fuerza: ${esc(lider)}${pf.escrutinio === 'provisorio' ? ' · escrutinio provisorio' : ''}</p>`;
}

export function renderLog(g) {
  return g.log.slice(0, 8).map(e => `<div class="ev ${e.kind}">${esc(e.text)}</div>`).join('');
}
