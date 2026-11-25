// Preferencia por barrio: qué partido «lidera» cada zona (rivales por presencia, vos por control). Función pura.
import { rivales, presencia, certeza } from './rivals.js';

const COLOR_PROPIO = '#3f9d6b';
// Devuelve { id, nombre, color, alpha (0.25..1), propio } o null si todavía no hay datos
export function liderZona(g, zonaId) {
  const z = g.zonas[zonaId]; if (!z) return null;
  if (g.guia?.progresivo && !g.ve('map.rivales')) return null;
  const pres = presencia(g, zonaId), c = z.control ?? 0;
  const puntajes = [{ id: 'yo', nombre: g.partido.nombre, color: g.partido.color ?? COLOR_PROPIO, propio: true, v: c },
    ...rivales(g).map(r => ({ id: r.id, nombre: r.nombre, color: r.color, propio: false, v: (pres[r.id] ?? 0) * (1 - c) }))].sort((a, b) => b.v - a.v);
  const [a, b] = puntajes; if (!a || a.v <= 0) return null;
  const margen = a.v - (b?.v ?? 0);
  return { id: a.id, nombre: a.nombre, color: a.color, propio: a.propio, alpha: Math.max(0.55, Math.min(1, 0.55 + margen * 2)) };
}
export const leyendaPreferencia = g => [{ nombre: g.partido.nombre, color: g.partido.color ?? COLOR_PROPIO }, ...rivales(g).map(r => ({ nombre: r.nombre, color: r.color }))];
// Cantidad de barrios que lidera cada partido (para resumir)
export function resumenPreferencia(g) {
  const n = {}; for (const id of Object.keys(g.zonas)) { const l = liderZona(g, id); if (l) n[l.id] = (n[l.id] ?? 0) + 1; } return n;
}
