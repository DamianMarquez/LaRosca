// Medios con decisiones: invitaciones (por fama y estilo), entrevistas, debates y emboscadas de rivales.
// El resultado de cada decisión es un chequeo: habilidad + profesión (etiquetas) + estilo, acotado al 5–95%. Sin DOM.
import * as personaje from './personaje.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const C = g => g.cfg.medios;
const evento = (g, id) => g.cfg.eventos?.eventos.find(e => e.id === id);
const lista = g => (g.jugador.invitaciones ??= []);

// Probabilidad (0..1) y factores de una opción con chequeo
export function chequeo(g, ev, op) {
  const k = op.chequeo, M = C(g), f = [['Dificultad base', k.base]];
  const n = personaje.nivel(g, k.habilidad);
  f.push([`${k.habilidad[0].toUpperCase() + k.habilidad.slice(1)} (nivel ${n})`, Math.round(M.habilidadPorNivel * (n - 2))]);
  const et = g.trasfondo?.etiquetas ?? [], hit = Object.entries(k.etiquetas ?? {}).filter(([e]) => et.includes(e)).sort((a, b) => b[1] - a[1])[0];
  if (hit) f.push([`Perfil: ${g.trasfondo.nombre}`, hit[1]]);
  if (ev.medio && (g.trasfondo?.debil ?? []).includes(ev.medio)) f.push([`Punto débil de tu perfil (${ev.medio})`, M.debil]);
  const est = personaje.estiloDe(g).id;
  if (est === 'figura') f.push(['Estás acostumbrado a las cámaras', M.estiloFigura]); else if (est === 'militante') f.push(['Preferís la calle a las cámaras', M.estiloMilitante]);
  const p = clamp(f.reduce((s, x) => s + x[1], 0), 5, 95) / 100;
  return { p, factores: f.filter(x => x[1]) };
}

// Un día: surgen invitaciones (según fama) y a veces una emboscada
export function tick(g, rnd = Math.random) {
  const M = C(g); if (!M || g.jugador.vacio) return;
  const inv = lista(g);
  g.jugador.invitaciones = inv.filter(i => i.vence >= g.day);
  if (g.pending) return;
  const fama = g.fama, lib = g.jugador;
  if (g.guia?.progresivo && !g.ve('vista.yo')) return;                         // al principio no hay nada de esto
  // emboscada: un rival lo arma; más fama y más atención, más chance
  const E = M.emboscada;
  if (fama >= E.minFama && g.day - (lib.ultimaEmboscada ?? -99) >= E.enfriamiento && rnd() < E.prob + E.probPorAtencion * (g.atencion?.() ?? 0)) {
    const ev = evento(g, E.evento);
    if (ev) { lib.ultimaEmboscada = g.day; g.pending = ev; g.ultimoEvento = g.day; g.note('Evento: ' + ev.titulo + '.', 'info'); g.emit?.('event'); return; }
  }
  if (g.jugador.invitaciones.length >= M.max || g.day - (lib.ultimaInvitacion ?? -99) < M.enfriamiento) return;
  if (rnd() >= M.probBase + M.probPorFama * fama) return;
  const ok = M.tipos.filter(t => fama >= t.minFama && !g.jugador.invitaciones.some(i => i.tipo === t.id));
  const tot = ok.reduce((s, t) => s + t.peso, 0); if (!tot) return;
  let r = rnd() * tot, t = ok[0]; for (const x of ok) { r -= x.peso; if (r <= 0) { t = x; break; } }
  lib.ultimaInvitacion = g.day;
  g.jugador.invitaciones.push({ tipo: t.id, vence: g.day + M.vence });
  g.note(`Te invitaron a: ${t.nombre.toLowerCase()}. Tenés ${M.vence} días para responder.`, 'info');
}

export function aceptar(g, tipo) {
  const M = C(g), t = M.tipos.find(x => x.id === tipo), i = lista(g).findIndex(x => x.tipo === tipo);
  if (!t || i < 0) return 'Esa invitación ya no está.';
  if (g.pending) return 'Primero resolvé lo pendiente.';
  if (g.jugador.descanso) return 'Estás descansando.';
  if (g.movilidad?.viaje) return 'Estás viajando.';
  const ev = evento(g, t.evento); if (!ev) return 'No se pudo.';
  g.jugador.invitaciones.splice(i, 1);
  g.pending = ev; g.ultimoEvento = g.day;
  g.hecho?.('medios');
  return null;
}
export function rechazar(g, tipo) { g.jugador.invitaciones = lista(g).filter(x => x.tipo !== tipo); return null; }

export function sanear(g, raw) {
  const ids = (C(g)?.tipos ?? []).map(t => t.id);
  return (Array.isArray(raw) ? raw : []).filter(i => i && ids.includes(i.tipo) && Number.isFinite(i.vence)).slice(0, 4).map(i => ({ tipo: i.tipo, vence: i.vence }));
}
