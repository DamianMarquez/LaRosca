// Pactos con otros partidos: relación con cada rival, propuestas, efectos, traiciones. Sin DOM.
import { registrarFavor } from './economia.js';
import { bono } from './plantel.js';
import * as personaje from './personaje.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = Number.isFinite;
const P = g => g.cfg.pactos;
const rivalesIds = g => (g.cfg.partidos?.partidos ?? []).filter(p => p.id !== 'otros' && p.id !== g.partidoBase);

// Afinidad de principios con el jugador: sube la relación inicial
export function relacionInicial(g, rival) {
  const comunes = rival.principios.filter(id => g.partido.principios.includes(id)).length;
  return clamp(P(g).relacion.base + comunes * P(g).relacion.porPrincipio, 0, 100);
}

export function iniciar(g) {
  return { relaciones: Object.fromEntries(rivalesIds(g).map(r => [r.id, relacionInicial(g, r)])), pactos: [], enfriamiento: {} };
}

export const relacion = (g, rid) => g.alianzas.relaciones[rid] ?? 0;
export function cambiarRelacion(g, rid, delta) { if (rid in g.alianzas.relaciones) g.alianzas.relaciones[rid] = clamp(g.alianzas.relaciones[rid] + delta, 0, 100); }
export const etiquetaRelacion = n => (n < 20 ? 'hostil' : n < 40 ? 'fría' : n < 60 ? 'neutral' : n < 80 ? 'cordial' : 'aliada');
export const pactoCon = (g, rid) => g.alianzas.pactos.find(p => p.rival === rid) ?? null;
export const tipoDef = (g, id) => P(g).tipos.find(t => t.id === id);

// Consultas que usan los bots y las misiones
export const noAgresion = (g, rid) => g.alianzas.pactos.some(p => p.rival === rid && p.tipo === 'no_agresion');
export const apoyoEn = (g, rid, zonaId) => g.alianzas.pactos.some(p => p.rival === rid && p.tipo === 'apoyo_barrio' && p.zona === zonaId);
// Puntos de éxito que dan los rivales aliados en una zona
export function apoyosZona(g, zonaId, presenciaDe) {
  return g.alianzas.pactos.filter(p => p.tipo === 'apoyo_barrio' && p.zona === zonaId).map(p => ({ rival: p.rival, puntos: Math.round(4 + 10 * (presenciaDe(p.rival) ?? 0)) }));
}

// Costo en dinero (el cargo de Campaña lo abarata) y probabilidad de que acepte
export function oferta(g, rid, tipoId) {
  const t = tipoDef(g, tipoId), rel = relacion(g, rid), camp = bono(g, 'campana'), neg = personaje.pactoBonus(g);
  const costo = Math.round(t.costoMoney * (1 - P(g).campana.descuento * camp) * (1 - neg.descuento));
  let p = rel < t.requiere ? 0 : clamp(0.25 + ((rel - t.requiere) / 100) * 0.9 + P(g).campana.aceptacion * camp + neg.aceptacion - 0.1 * g.alianzas.pactos.length, 0.05, 0.9);
  return { tipo: t, costo, p, relacion: rel };
}

// Propone un pacto. Devuelve { error } o { ok, texto }.
export function proponer(g, rid, tipoId, { zona = null, con = 'blanco' } = {}, rnd = Math.random) {
  const r = g.rival(rid), t = tipoDef(g, tipoId);
  if (!r || !t) return { error: 'Pacto desconocido.' };
  if (pactoCon(g, rid)) return { error: `Ya tenés un pacto con ${r.nombre}.` };
  if (g.alianzas.pactos.length >= P(g).max) return { error: `No podés sostener más de ${P(g).max} pactos a la vez.` };
  if ((g.alianzas.enfriamiento[rid] ?? 0) > g.day) return { error: `${r.nombre} no quiere hablar por ahora (esperá ${g.alianzas.enfriamiento[rid] - g.day} días).` };
  if (t.zona && !g.zonas[zona]) return { error: 'Elegí un barrio en el mapa para este pacto.' };
  const o = oferta(g, rid, tipoId);
  if (o.relacion < t.requiere) return { error: `${r.nombre} no te toma en serio todavía (necesitás relación ${t.requiere}; tenés ${Math.round(o.relacion)}).` };
  const cuenta = con === 'negro' ? 'black' : 'money';
  if (o.costo > 0 && g.player[cuenta] < o.costo) return { error: `Falta dinero ${con === 'negro' ? 'negro' : 'blanco'}.` };
  g.alianzas.enfriamiento[rid] = g.day + P(g).enfriamiento - personaje.pactoBonus(g).enfriamiento;
  if (rnd() >= o.p) { cambiarRelacion(g, rid, -2); return { ok: false, texto: `${r.nombre} rechazó tu propuesta de «${t.nombre.toLowerCase()}».` }; }
  if (o.costo > 0) { g.player[cuenta] -= o.costo; if (con === 'negro') g.exposure = clamp(g.exposure + 6, 0, 100); }
  const pacto = { id: `p${g.day}_${rid}`, rival: rid, tipo: tipoId, desde: g.day, hasta: g.day + t.dias };
  if (t.zona) pacto.zona = zona;
  if (t.recibe) { g.player.money += t.recibe; const f = registrarFavor(g, t.recibe, r.nombre); f.rival = rid; }
  g.alianzas.pactos.push(pacto);
  cambiarRelacion(g, rid, 5);
  if (tipoId === 'no_agresion') { const b = g.bots[rid]; if (b?.accion?.tipo === 'hostil') { b.accion = null; b.libreDesde = g.day + 3; } }  // frena lo que preparaba
  // El líder superior opina: aprueba pactos con quienes comparten sus principios y desaprueba el resto
  const l = g.linea?.lider;
  if (l) {
    const afin = r.principios.some(id => l.principios.includes(id));
    l.relacion = clamp(l.relacion + (afin ? P(g).lider.aprueba : P(g).lider.desaprueba), 0, 100);
  }
  const zonaTxt = t.zona ? ` en ${g.zonas[zona].nombre}` : '';
  g.note(`Pacto con ${r.nombre}: ${t.nombre.toLowerCase()}${zonaTxt} por ${t.dias} días.${l ? ` ${l.nombre} ${r.principios.some(id => l.principios.includes(id)) ? 'lo ve con buenos ojos' : 'no está nada conforme con ese acuerdo'}.` : ''}`, 'ok');
  return { ok: true, texto: `${r.nombre} aceptó.` };
}

function terminar(g, p, motivo) {
  g.alianzas.pactos = g.alianzas.pactos.filter(x => x !== p);
  g.note(`Terminó el pacto de ${tipoDef(g, p.tipo).nombre.toLowerCase()} con ${g.rival(p.rival).nombre}${motivo ? ': ' + motivo : ''}.`, motivo ? 'bad' : 'info');
}

// Rompe todos los pactos con un rival (por rencor); devuelve cuántos
export function quitarPactosCon(g, rid, motivo) { const l = g.alianzas.pactos.filter(p => p.rival === rid); for (const p of l) terminar(g, p, motivo); return l.length; }

// Turno diario: vencen, la relación se aquieta y los aliados pueden traicionarte si crecés demasiado
export function tick(g, rnd = Math.random) {
  for (const p of [...g.alianzas.pactos]) {
    if (g.day >= p.hasta) { terminar(g, p, null); continue; }
    const pop = Object.values(g.zonas).reduce((s, z) => s + z.pop, 0) || 1;
    const amenaza = Object.values(g.zonas).reduce((s, z) => s + z.pop * z.control, 0) / pop;
    const h = P(g).traicion.base * (1 + P(g).traicion.porAmenaza * amenaza + (100 - relacion(g, p.rival)) / 100) * personaje.pactoBonus(g).traicion;
    if (rnd() < h) {
      const rid = p.rival, r = g.rival(rid);
      terminar(g, p, `${r.nombre} te traicionó`);
      cambiarRelacion(g, rid, -30);
      for (const z of Object.values(g.zonas)) z.trust = clamp(z.trust - 4, 0, 100);
      const b = g.bots[rid], z = Object.values(g.zonas).sort((a, c) => c.control - a.control)[0];
      const def = g.cfg.rivales.acciones.find(a => a.id === 'desprestigio');
      if (b && !b.accion && z && def) b.accion = { tipo: 'hostil', accion: def.id, zona: z.id, fase: 'planeada', planDesde: g.day, inicio: g.day + 1, fin: g.day + 1 };
    }
  }
  // La relación vuelve despacio a su punto de partida (los agravios y las amistades se enfrían)
  if (g.day % 10 === 0) for (const r of rivalesIds(g)) { const base = relacionInicial(g, r), cur = relacion(g, r.id); cambiarRelacion(g, r.id, Math.sign(base - cur) * Math.min(Math.abs(base - cur), P(g).relacion.deriva * 10)); }
}

// ---------- Restauración segura desde un guardado ----------
export function sanear(g, raw) {
  const base = iniciar(g);
  if (!raw || typeof raw !== 'object') return base;
  if (raw.relaciones && typeof raw.relaciones === 'object') for (const id of Object.keys(base.relaciones)) if (fin(raw.relaciones[id])) base.relaciones[id] = clamp(raw.relaciones[id], 0, 100);
  if (raw.enfriamiento && typeof raw.enfriamiento === 'object') for (const id of Object.keys(base.relaciones)) if (fin(raw.enfriamiento[id])) base.enfriamiento[id] = raw.enfriamiento[id];
  if (Array.isArray(raw.pactos)) {
    const vistos = new Set();
    base.pactos = raw.pactos.filter(p => p && typeof p.rival === 'string' && base.relaciones[p.rival] !== undefined && tipoDef(g, p.tipo) && fin(p.desde) && fin(p.hasta))
      .filter(p => !tipoDef(g, p.tipo).zona || !!g.zonas[p.zona])
      .filter(p => !vistos.has(p.rival) && vistos.add(p.rival)).slice(0, P(g).max)       // uno por rival
      .map(p => ({ id: String(p.id ?? `p${p.desde}_${p.rival}`).replace(/[^\w:-]/g, '').slice(0, 60), rival: p.rival, tipo: p.tipo, desde: p.desde, hasta: p.hasta, ...(tipoDef(g, p.tipo).zona ? { zona: p.zona } : {}) }));
  }
  return base;
}
