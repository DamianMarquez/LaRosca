// Motor de eventos: sorteo diario, condiciones y aplicación de efectos. Sin DOM.
import * as personaje from './personaje.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Probabilidad diaria de escándalo según la exposición por dinero opaco (0..100)
export function probEscandalo(exposure, max) {
  return Math.pow(exposure / 100, 2) * max;
}

// Devuelve un evento a disparar hoy (o null). rnd: función 0..1 (inyectable para tests)
export function sortear(g, rnd = Math.random) {
  const E = g.cfg.eventos;
  if (!E || g.pending) return null;
  const esc = E.eventos.find(e => e.tipo === 'escandalo');
  if (esc && g.exposure > 0 && rnd() < probEscandalo(g.exposure, E.base.probEscandaloMax)) return esc;
  const prog = !!g.guia?.progresivo, inicio = prog && g.day < (E.base.encuentrosHasta ?? 0);      // al principio, encuentros sencillos y más seguidos
  const enfria = inicio ? E.base.encuentroEnfriamiento : E.base.enfriamientoDias, prob = inicio ? E.base.encuentroProb : E.base.probDiaria;
  if (g.day - g.ultimoEvento < enfria || rnd() >= prob) return null;
  const vistos = g.guia?.encuentros ?? [];
  const elegibles = E.eventos.filter(e => e.tipo !== 'escandalo' && e.tipo !== 'vida' && g.day >= (e.minDia ?? 0) && g.player.rank >= (e.minRango ?? 0)
    && (e.encuentro ? prog && !vistos.includes(e.id) && g.day <= (e.maxDia ?? 1e9) && !(e.antes && g.ve(e.antes)) : !(inicio && !(prog && g.day >= (E.base.eventosFuertesDesde ?? 0)))));
  const total = elegibles.reduce((s, e) => s + (e.peso ?? 1), 0);
  let r = rnd() * total;
  for (const e of elegibles) { r -= e.peso ?? 1; if (r <= 0) return e; }
  return null;
}

// ¿Puede el jugador pagar la opción? Devuelve el motivo si no.
export function noPuede(g, op) {
  const c = op.costo ?? {};
  if ((c.money ?? 0) > 0 && c.money > g.player.money) return 'Falta dinero blanco';   // sin costo siempre se puede, incluso en rojos
  if ((c.black ?? 0) > 0 && c.black > g.player.black) return 'Falta dinero negro';
  return null;
}

export function aplicar(g, ef = {}, evento = null) {
  const p = g.player;
  personaje.aplicar(g, ef);                              // desgaste, descanso, familia y trabajo
  if (ef.money) p.money += ef.money;                    // puede quedar en rojos: la deuda no se perdona sola
  if (ef.black) p.black = Math.max(0, p.black + ef.black);
  if (ef.xp) p.xp += ef.xp;
  if (ef.exposure) g.exposure = clamp(g.exposure + ef.exposure, 0, 100);
  if (ef.exposureSet !== undefined) g.exposure = clamp(ef.exposureSet, 0, 100);
  if (ef.trustAll) {
    // Un trasfondo como el de abogado amortigua lo que un escándalo le cuesta a tu reputación
    const v = ef.trustAll < 0 && evento?.tipo === 'escandalo' ? ef.trustAll * (g.trasfondo?.escandaloMult ?? 1) * personaje.vulnerabilidad(g) : ef.trustAll;
    for (const z of Object.values(g.zonas)) z.trust = clamp(z.trust + v, 0, 100);
  }
  if (ef.delay) for (const j of g.jobs) j.end += ef.delay;
}

// Resuelve la opción elegida; devuelve el texto del resultado
export function resolver(g, evento, idx, rnd = Math.random) {
  const op = evento.opciones[idx];
  if (!op || noPuede(g, op)) return null;
  const c = op.costo ?? {};
  g.player.money -= c.money ?? 0;
  g.player.black -= c.black ?? 0;
  let texto = op.resultado ?? '', ok = true;
  if (op.azar) {
    ok = rnd() < op.azar.p;
    const r = ok ? op.azar.ok : op.azar.fail;
    texto = r.texto;
    aplicar(g, r.efectos, evento);
  }
  aplicar(g, op.efectos, evento);
  return { texto, ok };
}
