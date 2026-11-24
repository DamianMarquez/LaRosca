// Ideología: ejes (estado, federal, orden, cambio), distancia entre partidos y atención de los rivales. Sin DOM.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const I = g => g.cfg.ideologia;
const EJES = g => (g.cfg.principios?.ejes ?? []).map(e => e.id);

// Vector medio de una lista de principios
export function vector(g, ids = []) {
  const ps = (g.cfg.principios?.principios ?? []).filter(p => ids.includes(p.id) && p.ejes), ejes = EJES(g);
  return Object.fromEntries(ejes.map(e => [e, ps.length ? ps.reduce((s, p) => s + (p.ejes[e] ?? 0), 0) / ps.length : 0]));
}
export const vectorJugador = g => vector(g, g.partido?.principios ?? []);
export const vectorRival = (g, r) => vector(g, r.principios ?? []);
// Distancia normalizada 0..1 (0 = iguales, 1 = polos opuestos en todo)
export function distancia(g, a, b) {
  const ejes = EJES(g); if (!ejes.length) return 0.5;
  return clamp(Math.sqrt(ejes.reduce((s, e) => s + ((a[e] ?? 0) - (b[e] ?? 0)) ** 2, 0) / ejes.length) , 0, 1);
}
export const distanciaRival = (g, r) => (r.principios?.length && g.partido?.principios?.length) ? distancia(g, vectorJugador(g), vectorRival(g, r)) : 0.5;
export function relacionIdeologica(g, r) {
  const d = distanciaRival(g, r), C = I(g); if (!C) return { d, tipo: 'neutral', texto: '' };
  const tipo = d >= C.opuesto ? 'opuesto' : d <= C.afin ? 'afin' : 'neutral';
  return { d, tipo, texto: tipo === 'opuesto' ? 'Opuesto natural' : tipo === 'afin' ? 'Afín' : 'Distinto' };
}
// Ejes donde más difieren (para explicar el choque)
export function choque(g, r) {
  const a = vectorJugador(g), b = vectorRival(g, r), E = g.cfg.principios?.ejes ?? [];
  return E.map(e => ({ e, dif: Math.abs((a[e.id] ?? 0) - (b[e.id] ?? 0)), yo: a[e.id] ?? 0, el: b[e.id] ?? 0 })).filter(x => x.dif >= 0.5).sort((x, y) => y.dif - x.dif)
    .map(x => `${x.yo > x.el ? x.e.mas : x.e.menos} vs ${x.yo > x.el ? x.e.menos : x.e.mas}`);
}
// Probabilidad extra de que el rival te golpee: más distancia, más choque (puede ser negativa si son afines)
export const hostilidad = (g, r) => { const C = I(g); return C ? C.hostilPorDistancia * (distanciaRival(g, r) - 0.5) * 2 + atencionHostil(g) : 0; };
// Atención 0..100: ser conocido y ayudar a la comunidad vuelve visible al partido
export function atencion(g) {
  const C = I(g)?.atencion; if (!C) return 0;
  const n = g.guia?.hechos?.[C.misionComunitaria] ?? 0;
  return clamp(g.fama * C.porFama + Math.min(C.topeComunidad, n * C.porComunidad), 0, 100);
}
export const atencionHostil = g => { const C = I(g)?.atencion; return C ? C.hostilMax * atencion(g) / 100 : 0; };
