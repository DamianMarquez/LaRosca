// Vistas HTML (cadenas). Sin estado propio.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const pct = v => Math.round(v * 100) + '%';

export function renderStats(g) {
  const p = g.player, next = g.nextXp;
  return `<span title="Rango">🎖 ${esc(g.rankName)}${next ? ` <small>(${p.xp}/${next} XP)</small>` : ''}</span>
    <span title="Dinero blanco del partido">💵 ${money(p.money)}</span>
    <span title="Bloques personales libres">⏳ ${g.freeSlots}/${g.slots}</span>
    <span title="Seguidores estimados">👥 ${g.followers.toLocaleString('es-AR')}</span>`;
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
        <div class="meta"><small>${m.dias} d · ${money(m.costo)} · éxito ${ch.c}%</small><br><small class="muted" title="${esc(why)}">${esc(why)}</small></div>
        <button data-start="${m.id}" ${lock ? 'disabled' : ''}>${lock ? esc(lock) : 'Lanzar'}</button></div>`;
    }).join('');
    zone = `<h2>${esc(z.nombre)}</h2>
      <p class="muted">${z.pop.toLocaleString('es-AR')} hab. · Control ${pct(z.control)} · Confianza ${Math.round(z.trust)}</p>
      <h3>Misiones</h3>${ms}`;
  }
  return `<div class="city">${esc(g.city.ciudad)}, ${esc(g.prov.nombre)}</div>${zone}<h3>En curso</h3>${jobs}
    <p class="muted attrib">${g.city.fuente ? 'Barrios: © ' + esc(g.city.fuente) : 'Barrios sintéticos (sin datos OSM para esta ciudad)'}</p>`;
}

export function renderLog(g) {
  return g.log.slice(0, 8).map(e => `<div class="ev ${e.kind}">${esc(e.text)}</div>`).join('');
}
