// Línea partidaria: líder del rango siguiente al del jugador y directivas ("bajadas de línea"). Sin DOM.
// Base de la futura sinergia: la relación con el líder (apoyarlo o desplazarlo) y su ambición quedan guardadas.
import { rng } from './city.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const between = (a, b, rnd = Math.random) => a + Math.floor(rnd() * (b - a + 1));
const L_ = g => g.cfg.linea;

// Líder del rango siguiente (null si ya estás en la cima). Determinista por provincia, partido y rango.
export function nuevoLider(g, salt = '') {
  const rank = g.player.rank, ranks = g.rangos;
  if (g.modo === 'fundador' || rank + 1 >= ranks.length) return null;   // el fundador es la cabeza: no tiene superior
  const C = L_(g), r = rng(`${g.prov.id}:${g.partido.nombre}:${rank}:${salt}`);
  const cat = (g.cfg.principios?.principios ?? []).map(p => p.id);
  const mios = new Set(g.partido.principios), suyos = [];
  while (suyos.length < 2 && cat.length >= 2) { const id = cat[Math.floor(r() * cat.length)]; if (!suyos.includes(id)) suyos.push(id); }
  const comunes = suyos.filter(id => mios.has(id)).length;
  return {
    nombre: `${C.nombres.nombre[Math.floor(r() * C.nombres.nombre.length)]} ${C.nombres.apellido[Math.floor(r() * C.nombres.apellido.length)]}`,
    cargo: ranks[rank + 1], principios: suyos, comunes,
    relacion: clamp(C.base.relacionInicial + comunes * C.base.porPrincipio, 0, 100),
    ambicion: Math.floor(r() * 101),             // reservada: define qué tan dispuesto está a ser desplazado
  };
}

export const iniciar = g => ({ lider: nuevoLider(g), directiva: null, historial: [], proxima: L_(g).base.primera, n: 0 });

export const etiqueta = (g, rel) => L_(g).etiquetas.find(([max]) => rel < max)?.[1] ?? 'aliado';

// Efecto de la relación sobre las misiones: respaldo (+) o trabas internas (−)
export function factorLider(g) {
  const l = g.linea?.lider; if (!l) return null;
  const R = L_(g).base.respaldo;
  if (l.relacion >= R.alto) return [`Respaldo de ${l.nombre}`, R.puntos];
  if (l.relacion < R.bajo) return ['Trabas internas', -R.puntos];
  return null;
}

// Progreso de la directiva activa: { frac, texto }
export function progreso(g, d) {
  if (d.tipo === 'controlar_zona') { const c = g.zonas[d.zona]?.control ?? 0; return { frac: clamp(c / d.meta, 0, 1), texto: `${(c * 100).toFixed(1)}% de ${(d.meta * 100).toFixed(0)}%` }; }
  if (d.tipo === 'sin_negro') return { frac: clamp((g.day - d.aceptada) / d.dias, 0, 1), texto: `${Math.max(0, g.day - d.aceptada)} de ${d.dias} días` };
  return { frac: clamp(d.hecho / d.n, 0, 1), texto: `${d.hecho} de ${d.n}` };
}

export function textoDirectiva(g, d) {
  if (d.tipo === 'controlar_zona') return `llevar ${g.zonas[d.zona].nombre} a ${(d.meta * 100).toFixed(0)}% de control en ${d.dias} días`;
  if (d.tipo === 'sin_negro') return `no usar dinero negro durante ${d.dias} días`;
  return `completar ${d.n} veces «${g.mission(d.mision).nombre}» con éxito en ${d.dias} días`;
}

function proponer(g, rnd) {
  const L = g.linea, C = L_(g);
  const elegibles = C.directivas.filter(t => t.tipo !== 'sin_negro' || g.player.black > 0 || g.exposure > 0);
  const t = elegibles[Math.floor(rnd() * elegibles.length)];
  const d = { tipo: t.tipo, dias: t.dias, estado: 'propuesta', desde: g.day, venceRespuesta: g.day + C.base.respuesta, fuente: L.n % 2 === 0 ? 'partido' : 'lider' };
  if (t.tipo === 'controlar_zona') {
    const cand = Object.values(g.zonas).filter(z => z.control < 0.3).sort((a, b) => b.pop - a.pop).slice(0, 10);
    const z = cand[Math.floor(rnd() * cand.length)]; if (!z) return;
    d.zona = z.id; d.meta = +clamp(z.control + t.sumar, 0.1, 0.6).toFixed(2);
  } else if (t.tipo === 'hacer_mision') {
    const ms = g.cfg.missions.filter(m => m.minRank <= g.player.rank && m.categoria !== 'finanzas');
    d.mision = ms[Math.floor(rnd() * ms.length)].id; d.n = t.n; d.hecho = 0;
  }
  d.texto = textoDirectiva(g, d);
  L.directiva = d; L.n++;
  const quien = d.fuente === 'partido' ? 'La línea partidaria baja' : `${L.lider.nombre} (${L.lider.cargo}) te pide`;
  g.note(`${quien}: ${d.texto}. Podés aceptar o rechazar.`, 'linea');
}

function cerrar(g, resultado, rnd = Math.random) {
  const L = g.linea, d = L.directiva, C = L_(g), l = L.lider;
  const delta = resultado === 'cumplida' ? C.recompensa.relacion : C.penal[resultado];
  if (l) l.relacion = clamp(l.relacion + delta, 0, 100);
  if (resultado === 'cumplida') { g.player.xp += C.recompensa.xp; g.player.money += C.recompensa.dinero; }
  const txt = { cumplida: 'Cumpliste', vencida: 'No cumpliste', rechazo: 'Rechazaste', ignorada: 'Dejaste pasar' }[resultado];
  L.historial.unshift({ dia: g.day, texto: `${txt}: ${d.texto}`, resultado, relacion: delta });
  L.historial.length = Math.min(L.historial.length, C.base.historial);
  g.note(`${txt} la directiva (${d.texto}). Relación con ${l?.nombre ?? 'el partido'}: ${delta > 0 ? '+' : ''}${delta}.${resultado === 'cumplida' ? ` +${C.recompensa.xp} XP y ${C.recompensa.dinero.toLocaleString('es-AR')} de fondo partidario.` : ''}`, resultado === 'cumplida' ? 'ok' : 'linea');
  L.directiva = null;
  L.proxima = g.day + between(C.base.intervalo[0], C.base.intervalo[1], rnd);
  if (resultado === 'cumplida') g.checkPromotion();
}

// Turno diario
export function tick(g, rnd = Math.random) {
  const L = g.linea; if (!L?.lider) return;
  const d = L.directiva;
  if (!d) { if (g.day >= L.proxima) proponer(g, rnd); return; }
  if (d.estado === 'propuesta') { if (g.day >= d.venceRespuesta) cerrar(g, 'ignorada', rnd); return; }
  const cumplida = d.tipo === 'controlar_zona' ? g.zonas[d.zona].control >= d.meta
    : d.tipo === 'sin_negro' ? !d.violada && g.day >= d.aceptada + d.dias
    : d.hecho >= d.n;
  if (cumplida) cerrar(g, 'cumplida', rnd);
  else if (d.violada || g.day >= d.hasta) cerrar(g, 'vencida', rnd);
}

// El jugador acepta o rechaza la directiva propuesta
export function responder(g, aceptar) {
  const d = g.linea?.directiva;
  if (!d || d.estado !== 'propuesta') return false;
  if (aceptar) { d.estado = 'aceptada'; d.aceptada = g.day; d.hasta = g.day + d.dias; g.note(`Aceptaste la directiva: ${d.texto}.`, 'info'); }
  else cerrar(g, 'rechazo');
  return true;
}

// Ganchos desde el juego
export function alUsarNegro(g) { const d = g.linea?.directiva; if (d?.estado === 'aceptada' && d.tipo === 'sin_negro') d.violada = true; }
export function alResolver(g, job, ok) { const d = g.linea?.directiva; if (ok && d?.estado === 'aceptada' && d.tipo === 'hacer_mision' && d.mision === job.mission) d.hecho++; }
export function alAscender(g) { g.linea.lider = nuevoLider(g); if (g.linea.lider) g.note(`Tu nuevo superior es ${g.linea.lider.nombre} (${g.linea.lider.cargo}).`, 'linea'); }

// Restauración segura desde un guardado: se reconstruye todo lo que se pueda recalcular (cargo, texto) y se acota el resto
export function sanear(g, raw) {
  const base = iniciar(g), C = L_(g), cat = (g.cfg.principios?.principios ?? []).map(p => p.id);
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base, historial: [] };
  const l = raw.lider;
  if (raw.lider === null) out.lider = null;   // puesto vacante: lo repone el escalafón
  if (base.lider && l && typeof l.nombre === 'string' && l.nombre.trim()) {
    out.lider = {
      ...base.lider,
      nombre: l.nombre.replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) || base.lider.nombre,
      principios: Array.isArray(l.principios) ? [...new Set(l.principios)].filter(id => cat.includes(id)).slice(0, 2) : base.lider.principios,
      relacion: Number.isFinite(l.relacion) ? clamp(l.relacion, 0, 100) : base.lider.relacion,
      ambicion: Number.isFinite(l.ambicion) ? clamp(l.ambicion, 0, 100) : base.lider.ambicion,
    };
    out.lider.comunes = out.lider.principios.filter(id => g.partido.principios.includes(id)).length;   // se recalcula, no se confía
  }
  if (Number.isFinite(raw.proxima)) out.proxima = raw.proxima;
  if (Number.isFinite(raw.n)) out.n = Math.max(0, Math.floor(raw.n));
  const d = raw.directiva;
  if (out.lider && d && C.directivas.some(t => t.tipo === d.tipo) && ['propuesta', 'aceptada'].includes(d.estado) && [d.dias, d.desde].every(Number.isFinite)) {
    const nd = { tipo: d.tipo, dias: d.dias, estado: d.estado, desde: d.desde, fuente: d.fuente === 'lider' ? 'lider' : 'partido', venceRespuesta: Number.isFinite(d.venceRespuesta) ? d.venceRespuesta : d.desde + C.base.respuesta };
    if (d.estado === 'aceptada') { nd.aceptada = Number.isFinite(d.aceptada) ? d.aceptada : d.desde; nd.hasta = Number.isFinite(d.hasta) ? d.hasta : nd.aceptada + d.dias; if (d.violada) nd.violada = true; }
    let ok = true;
    if (d.tipo === 'controlar_zona') { ok = !!g.zonas[d.zona] && Number.isFinite(d.meta); nd.zona = d.zona; nd.meta = clamp(d.meta, 0.01, 1); }
    if (d.tipo === 'hacer_mision') { ok = !!g.cfg.missions.find(m => m.id === d.mision) && Number.isFinite(d.n) && d.n > 0; nd.mision = d.mision; nd.n = Math.floor(d.n); nd.hecho = Number.isFinite(d.hecho) ? Math.max(0, Math.floor(d.hecho)) : 0; }
    if (ok) { nd.texto = textoDirectiva(g, nd); out.directiva = nd; }
  }
  if (Array.isArray(raw.historial)) {
    out.historial = raw.historial.filter(h => h && typeof h.texto === 'string' && ['cumplida', 'vencida', 'rechazo', 'ignorada'].includes(h.resultado))
      .slice(0, C.base.historial).map(h => ({ dia: Number(h.dia) || 0, texto: h.texto.replace(/[\u0000-\u001f<>]/g, '').slice(0, 160), resultado: h.resultado, relacion: Number(h.relacion) || 0 }));
  }
  return out;
}
