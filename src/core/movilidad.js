// Movilidad: dónde vivís y dónde estás, cómo viajás (ida y vuelta) y qué mejoras de transporte tenés. Sin DOM.
// El tiempo del viaje se expresa en días fraccionarios absolutos (g.day + fracción), igual que el reloj.
const fin = Number.isFinite;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const VACIO = { escalaViaje: 1, rodeo: 1, minDias: 99, fatigaMax: 0, topeRelativo: 1, mudanza: { costo: 0, dias: 0 }, medios: [], mejoras: [] };   // sin datos de movilidad (pruebas, partidas muy viejas): no hay viajes
const K = g => g.cfg.movilidad ?? VACIO;
const medioDe = (g, id) => K(g).medios.find(m => m.id === id) ?? null;
const mejoraDe = (g, id) => K(g).mejoras.find(m => m.id === id) ?? null;
const ahora = g => g.day + (g._acc ?? 0);

export function iniciar(g) {
  const z = Object.values(g.zonas);
  const centro = z.find(x => x.nombre === 'Centro') ?? z.slice().sort((a, b) => b.pop - a.pop)[0];
  return { casa: centro?.id ?? null, ubicacion: centro?.id ?? null, mejoras: [], preferido: null, viaje: null, retorno: null, mudadoDia: -9999 };
}

// ---------- Distancias ----------
const areaPath = d => {                 // área (shoelace) de un path de segmentos rectos
  let t = 0;
  for (const sub of String(d ?? '').split('M').slice(1)) {
    const n = (sub.match(/-?\d+\.?\d*/g) ?? []).map(Number), p = [];
    for (let i = 0; i + 1 < n.length; i += 2) p.push([n[i], n[i + 1]]);
    let s = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; }
    t += Math.abs(s) / 2;
  }
  return t;
};
// Kilómetros por unidad del mapa: área real de las zonas / área dibujada
export function kmPorUnidad(g) {
  if (g._kmu) return g._kmu;
  const zs = Object.values(g.zonas), km2 = zs.reduce((s, z) => s + (z.areaKm2 ?? 0), 0), u2 = zs.reduce((s, z) => s + areaPath(z.d), 0);
  return (g._kmu = km2 > 0 && u2 > 0 ? Math.sqrt(km2 / u2) : 0.02);
}
export function distanciaKm(g, a, b) {
  const A = g.zonas[a], B = g.zonas[b]; if (!A || !B || a === b) return 0;
  return Math.hypot(A.cx - B.cx, A.cy - B.cy) * kmPorUnidad(g) * K(g).rodeo;
}

// ---------- Medios ----------
const dadoPorMejora = (g, id) => K(g).mejoras.some(m => m.da === id);
const tiene = (g, mejoraId) => g.movilidad.mejoras.includes(mejoraId);
// Medios que podés usar hoy: los públicos y los que compraste
export function medios(g) {
  return K(g).medios.filter(m => m.disponible !== false && m.alcance === 'urbano' && (!dadoPorMejora(g, m.id) || K(g).mejoras.some(x => x.da === m.id && tiene(g, x.id))));
}
// Estadísticas de un medio con las mejoras aplicadas
export function stats(g, id) {
  const m = medioDe(g, id); if (!m) return null;
  const f = { vel: 1, costo: 1, fatiga: 1, espera: 1 };
  for (const x of K(g).mejoras) if (tiene(g, x.id) && x.mult) for (const k of ['*', id]) for (const [c, v] of Object.entries(x.mult[k] ?? {})) f[c] *= v;
  return { ...m, kmh: m.kmh * f.vel, costoFijo: m.costoFijo * f.costo, costoKm: m.costoKm * f.costo, costoMax: (m.costoMax ?? 0) * f.costo, fatigaKm: m.fatigaKm * f.fatiga, espera: m.espera * f.espera };
}
// Un tramo con un medio: kilómetros, horas, costo (con tope por tramo) y desgaste
function tramo(g, id, km) {
  const s = stats(g, id), horas = s.espera + km / s.kmh;
  let costo = s.costoFijo + km * s.costoKm; if (s.costoMax > 0) costo = Math.min(costo, s.costoMax);
  return { km, horas, dias: horas * K(g).escalaViaje / 24, costo, fatiga: Math.min(K(g).fatigaMax, km * s.fatigaKm) };
}
// Cuánto cuesta y cuánto tarda ir a una zona (y volver a casa) con cada medio. mision: tope relativo al costo de la acción.
export function opciones(g, hasta, desde = g.movilidad.ubicacion, mision = null) {
  const M = g.movilidad, ida = distanciaKm(g, desde, hasta), vuelta = hasta === M.casa ? 0 : distanciaKm(g, hasta, M.casa);
  const tope = mision?.costo > 0 ? Math.floor(mision.costo * K(g).topeRelativo) : Infinity;
  return medios(g).map(m => {
    const a = tramo(g, m.id, ida), b = tramo(g, m.id, vuelta);
    const costo = Math.round(Math.min(a.costo + b.costo, tope)), fatiga = +(a.fatiga + b.fatiga).toFixed(2);
    const motivo = costo > 0 && g.player.money < costo ? 'Falta dinero' : null;
    return { id: m.id, nombre: m.nombre, icono: m.icono, km: +ida.toFixed(1), kmVuelta: +vuelta.toFixed(1), horas: a.horas, dias: a.dias, diasVuelta: b.dias, costo, fatiga, ok: !motivo, motivo };
  }).sort((x, y) => x.dias - y.dias);
}
// Medio por defecto: el preferido si se puede; si no, el más rápido que no cueste más del 5% de lo que tenés (o $100)
export function elegir(g, ops) {
  const p = ops.find(o => o.id === g.movilidad.preferido && o.ok); if (p) return p;
  const tope = Math.max(100, g.player.money * 0.05);
  return ops.find(o => o.ok && (o.costo === 0 || o.costo <= tope)) ?? ops.find(o => o.costo === 0) ?? ops[0];
}

// ---------- Viaje ----------
export const viajando = g => !!g.movilidad?.viaje;
// Plan de viaje a una zona (null si ya estás ahí o si es tan cerca que no se nota). El costo incluye la vuelta a casa.
export function planear(g, hasta, medioId = null, mision = null) {
  const M = g.movilidad, desde = M.ubicacion;
  if (!desde || desde === hasta || !g.zonas[hasta]) return null;
  const ops = opciones(g, hasta, desde, mision), op = (medioId && ops.find(o => o.id === medioId && o.ok)) || elegir(g, ops);
  if (!op || op.dias < K(g).minDias) return null;
  return { desde, hasta, medio: op.id, km: op.km, dias: op.dias, costo: op.costo, fatiga: op.fatiga, vuelta: op.kmVuelta > 0, diasVuelta: op.diasVuelta };
}
// Sale de viaje con una acción pendiente: se cobra ida y vuelta y se suma el cansancio
export function salir(g, plan, pendiente) {
  const t = ahora(g);
  g.player.money -= plan.costo;
  g.jugador.desgaste = clamp(g.jugador.desgaste + plan.fatiga, 0, 100);
  g.movilidad.viaje = { etapa: 'ida', desde: plan.desde, hasta: plan.hasta, medio: plan.medio, km: plan.km, costo: plan.costo, inicio: t, llega: t + plan.dias, pendiente: pendiente ?? null };
  g.movilidad.retorno = { medio: plan.medio, costo: plan.costo };
  g.note(`Salís hacia ${g.zonas[plan.hasta].nombre} (${medioDe(g, plan.medio).nombre.toLowerCase()}, ${plan.km} km${plan.costo ? `, ida y vuelta $${plan.costo.toLocaleString('es-AR')}` : ''}).`, 'info');
}
// Arranca la vuelta a casa (ya está pagada): se llama al terminar una acción lejos de casa
export function volver(g) {
  const M = g.movilidad; if (!M || M.viaje || !M.casa || M.ubicacion === M.casa) return false;
  const id = M.retorno?.medio && medios(g).some(m => m.id === M.retorno.medio) ? M.retorno.medio : (medios(g).find(m => m.id === 'pie') ?? medios(g)[0])?.id;
  M.retorno = null;
  const km = distanciaKm(g, M.ubicacion, M.casa), tr = id ? tramo(g, id, km) : null, t = ahora(g);
  if (!tr || tr.dias < K(g).minDias) { M.ubicacion = M.casa; return false; }
  M.viaje = { etapa: 'vuelta', desde: M.ubicacion, hasta: M.casa, medio: id, km: +km.toFixed(1), costo: 0, inicio: t, llega: t + tr.dias, pendiente: null };
  g.note(`Volvés a casa (${medioDe(g, id).nombre.toLowerCase()}, ${M.viaje.km} km).`, 'info');
  return true;
}
// Llegada: si era la ida, se crea la acción que esperaba; si era la vuelta, volviste a casa
export function tick(g, t = g.day) {
  const v = g.movilidad?.viaje; if (!v || t < v.llega) return false;
  g.movilidad.viaje = null; g.movilidad.ubicacion = v.hasta;
  if (v.etapa === 'vuelta') { g.note(`Volviste a casa (${g.zonas[v.hasta].nombre}).`, 'info'); return true; }
  g.hecho?.('viajes');
  g.note(`Llegaste a ${g.zonas[v.hasta].nombre} (${medioDe(g, v.medio)?.nombre.toLowerCase() ?? 'viaje'}).`, 'info');
  const p = v.pendiente;
  if (p && g.mission(p.mision)) g.jobs.push({ mission: p.mision, zone: v.hasta, start: g.day, end: g.day + g.dias(g.mission(p.mision), p.modalidad), pago: p.pago, modo: 'personal', ...(p.modalidad ? { modalidad: p.modalidad } : {}), ...(p.rival ? { rival: p.rival } : {}) });
  return true;
}
// Cancelar la ida: te quedás en el barrio más cercano de la ruta, se devuelve la acción y la vuelta pagada, y volvés a casa si hace falta
export function cancelar(g) {
  const M = g.movilidad, v = M?.viaje; if (!v) return 'No estás viajando.';
  if (v.etapa === 'vuelta') return 'Ya estás volviendo a casa.';
  const f = fraccion(g, ahora(g)), quedo = f < 0.5 ? v.desde : v.hasta;
  M.viaje = null; M.ubicacion = quedo;
  const p = v.pendiente, m = p && g.mission(p.mision);
  if (m) { if (p.pago === 'negro') g.player.black += m.costo; else g.player.money += m.costo; }
  g.player.money += Math.round((M.retorno?.costo ?? 0) / 2);   // ida y vuelta se pagan por mitades: se devuelve la vuelta
  g.note(`Cancelaste el viaje: quedaste en ${g.zonas[quedo].nombre}.`, 'info');
  volver(g);
  return null;
}
const fraccion = (g, t) => { const v = g.movilidad?.viaje; return v ? clamp((t - v.inicio) / Math.max(1e-6, v.llega - v.inicio), 0, 1) : 0; };
// Posición del jugador para dibujarlo: parado en su zona o en camino
export function posicion(g, t = g.day) {
  const M = g.movilidad, v = M?.viaje, C = g.zonas[M?.casa];
  const base = { casa: C ? { x: C.cx, y: C.cy, nombre: C.nombre } : null };
  if (v) {
    const A = g.zonas[v.desde], B = g.zonas[v.hasta], f = fraccion(g, t), m = medioDe(g, v.medio);
    return { ...base, viajando: true, etapa: v.etapa ?? 'ida', x: A.cx + (B.cx - A.cx) * f, y: A.cy + (B.cy - A.cy) * f, x0: A.cx, y0: A.cy, x1: B.cx, y1: B.cy, frac: f, medio: v.medio, medioNombre: m?.nombre ?? '', icono: m?.icono ?? '🚶', destino: B.nombre, llega: v.llega, restante: Math.max(0, v.llega - t) };
  }
  const z = g.zonas[M?.ubicacion]; return z ? { ...base, viajando: false, x: z.cx, y: z.cy, icono: '🧍', enCasa: M.ubicacion === M.casa } : null;
}

// ---------- Casa ----------
export function motivoMudanza(g, zoneId) {
  const M = g.movilidad, C = K(g).mudanza;
  if (!g.zonas[zoneId]) return 'No existe.';
  if (M.viaje) return 'Estás viajando';
  if (M.casa === zoneId) return 'Ya vivís acá';
  if (M.ubicacion !== zoneId) return 'Tenés que estar en el barrio';
  if (g.day - M.mudadoDia < C.dias) return `Te mudaste hace poco (${C.dias - (g.day - M.mudadoDia)} d)`;
  if (g.player.money < C.costo) return 'Falta dinero';
  return null;
}
export function mudarse(g, zoneId) {
  const e = motivoMudanza(g, zoneId); if (e) return e;
  g.player.money -= K(g).mudanza.costo; g.movilidad.casa = zoneId; g.movilidad.mudadoDia = g.day;
  g.note(`Te mudaste a ${g.zonas[zoneId].nombre}: ahora volvés a casa desde ahí.`, 'info'); return null;
}

// ---------- Mejoras ----------
export function motivoCompra(g, id) {
  const m = mejoraDe(g, id); if (!m) return 'No existe.';
  if (tiene(g, id)) return 'Ya la tenés';
  const h = (m.requiereHechos ?? []).find(c => (g.guia?.hechos?.[c.clave] ?? 0) < c.n); if (g.guia?.progresivo && h) return `Primero: ${h.n} viajes (${g.guia?.hechos?.[h.clave] ?? 0}/${h.n})`;
  if (g.player.rank < (m.minRank ?? 0)) return `Requiere rango: ${g.rangos[m.minRank]}`;
  const f = (m.requiere ?? []).find(r => !tiene(g, r)); if (f) return `Primero: ${mejoraDe(g, f).nombre}`;
  if (g.player.money < m.costo) return 'Falta dinero';
  return null;
}
export function comprar(g, id) {
  const e = motivoCompra(g, id); if (e) return e;
  const m = mejoraDe(g, id); g.player.money -= m.costo; g.movilidad.mejoras.push(id);
  g.note(`Movilidad: ${m.nombre.toLowerCase()}.`, 'ok'); return null;
}
export function elegirPreferido(g, id) { g.movilidad.preferido = id && medios(g).some(m => m.id === id) ? id : null; }

// ---------- Restauración segura ----------
export function sanear(g, raw) {
  const M = iniciar(g); if (!raw || typeof raw !== 'object') return M;
  if (typeof raw.ubicacion === 'string' && g.zonas[raw.ubicacion]) M.ubicacion = raw.ubicacion;
  M.casa = typeof raw.casa === 'string' && g.zonas[raw.casa] ? raw.casa : (M.ubicacion ?? M.casa);   // partidas viejas: casa = donde estabas
  M.mejoras = Array.isArray(raw.mejoras) ? [...new Set(raw.mejoras.filter(id => mejoraDe(g, id)))] : [];
  M.preferido = typeof raw.preferido === 'string' && medioDe(g, raw.preferido) ? raw.preferido : null;
  M.mudadoDia = fin(raw.mudadoDia) ? raw.mudadoDia : -9999;
  if (raw.retorno && typeof raw.retorno.medio === 'string' && medioDe(g, raw.retorno.medio)) M.retorno = { medio: raw.retorno.medio, costo: fin(raw.retorno.costo) ? Math.max(0, raw.retorno.costo) : 0 };
  const v = raw.viaje;
  if (v && g.zonas[v.desde] && g.zonas[v.hasta] && medioDe(g, v.medio) && fin(v.inicio) && fin(v.llega)) {
    const p = v.pendiente, ok = p && typeof p.mision === 'string' && (g.cfg.missions.some(m => m.id === p.mision) || g.cfg.ofensivas?.acciones.some(m => m.id === p.mision));
    const etapa = v.etapa === 'vuelta' ? 'vuelta' : 'ida';
    M.viaje = { etapa, desde: v.desde, hasta: v.hasta, medio: v.medio, km: fin(v.km) ? v.km : 0, costo: fin(v.costo) ? v.costo : 0, inicio: Math.min(v.inicio, v.llega), llega: v.llega,
      pendiente: etapa === 'ida' && ok ? { mision: p.mision, pago: p.pago === 'negro' ? 'negro' : 'blanco', ...(typeof p.modalidad === 'string' ? { modalidad: p.modalidad } : {}), ...(typeof p.rival === 'string' ? { rival: p.rival } : {}) } : null };
  }
  return M;
}
