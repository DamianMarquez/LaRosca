// Revelado progresivo: el juego empieza con muy poco en pantalla y se abre de a poco. Sin DOM.
// Cada elemento (data/revelado.json) se revela una sola vez y nunca se vuelve a ocultar.
import { FASES } from './elecciones.js';
import { fama as famaDe } from './personaje.js';

const fin = Number.isFinite;
const ESTADOS = ['idea', 'agrupacion', 'personeria', 'distrito', 'provincial', 'nacional'];

export const catalogo = g => (g.cfg.revelado?.elementos ?? []).filter(e => e.modo === 'ambos' || e.modo === g.modo);
export const elemento = (g, id) => (g.cfg.revelado?.elementos ?? []).find(e => e.id === id) ?? null;

// ¿Se ve este elemento? Con el modo progresivo apagado (partidas viejas, "mostrar todo") se ve todo.
export const ve = (g, id) => !g.guia || !g.guia.progresivo || g.guia.revelado.includes(id);

// ---------- Condiciones ----------
function cumple(g, c) {
  switch (c.tipo) {
    case 'dia': return g.day >= c.n;
    case 'misiones': return (g.guia?.hechos?.misiones ?? 0) >= c.n;
    case 'afiliados': return g.afiliados >= g.umbral(c.n);
    case 'vacante': return (g.plantel?.vacantes?.length ?? 0) > 0;
    case 'rango': return g.player.rank >= c.n;
    case 'control': return Object.values(g.zonas).some(z => z.control >= c.n);
    case 'dineroBajo': return g.player.money <= (g.guia?.dineroInicial ?? g.cfg.start.money) * 0.4;
    case 'cierreMes': return (g.economia?.historial?.length ?? 0) >= 1;
    case 'accionRival': return (g.historialRivales?.length ?? 0) > 0;
    case 'equipo': return g.equipo > 0;
    case 'fama': return famaDe(g) >= c.n;
    case 'estado': return ESTADOS.indexOf(g.org?.estado) >= ESTADOS.indexOf(c.estado);
    case 'fase': { const P = g.elecciones?.proceso; return !!P && FASES.indexOf(P.fase) >= FASES.indexOf(c.fase); }
    case 'hecho': return (g.guia?.hechos?.[c.clave] ?? 0) >= (c.n ?? 1);
    case 'popularidad': return g.intencionVoto >= c.n;
    default: return false;
  }
}
// Condiciones sueltas (misiones, eventos): todas deben cumplirse
export const cumpleConds = (g, conds) => (conds ?? []).every(c => cumple(g, c));
export const fraccionConds = (g, conds) => { const l = (conds ?? []).map(c => Math.min(1, fraccion(g, c))); return l.length ? l.reduce((a, b) => a + b, 0) / l.length : 1; };
export const progresoConds = (g, conds) => progreso(g, { cond: conds });
export function cumpleElemento(g, e) {
  const todas = (e.cond ?? []).every(c => cumple(g, c)), alguna = !e.alguna || e.alguna.some(c => cumple(g, c));
  return todas && alguna;
}

// Progreso hacia un elemento cerrado: [{texto, ok, actual, meta}]
export function progreso(g, e) {
  const t = c => {
    switch (c.tipo) {
      case 'dia': return { texto: 'Días de partida', actual: g.day, meta: c.n };
      case 'misiones': return { texto: 'Misiones terminadas', actual: g.guia?.hechos?.misiones ?? 0, meta: c.n };
      case 'afiliados': return { texto: 'Afiliados', actual: g.afiliados, meta: g.umbral(c.n) };
      case 'control': return { texto: 'Control en un barrio', actual: Math.round(Math.max(0, ...Object.values(g.zonas).map(z => z.control)) * 100), meta: Math.round(c.n * 100), unidad: '%' };
      case 'cierreMes': return { texto: 'Primer cierre de mes', actual: g.economia?.historial?.length ? 1 : 0, meta: 1 };
      case 'accionRival': return { texto: 'Primera acción de un rival', actual: g.historialRivales?.length ? 1 : 0, meta: 1 };
      case 'dineroBajo': return { texto: 'Quedarte con poco dinero', actual: cumple(g, c) ? 1 : 0, meta: 1 };
      case 'equipo': return { texto: 'Rango con equipo', actual: g.equipo > 0 ? 1 : 0, meta: 1 };
      case 'vacante': return { texto: 'Un cargo vacante', actual: (g.plantel?.vacantes?.length ?? 0) > 0 ? 1 : 0, meta: 1 };
      case 'fama': return { texto: 'Notoriedad', actual: Math.round(famaDe(g)), meta: c.n };
      case 'estado': return { texto: `Estado legal: ${g.cfg.organizacion?.estados.find(x => x.id === c.estado)?.nombre ?? c.estado}`, actual: cumple(g, c) ? 1 : 0, meta: 1 };
      case 'fase': return { texto: 'Etapa electoral', actual: cumple(g, c) ? 1 : 0, meta: 1 };
      case 'hecho': return { texto: g.cfg.revelado?.etiquetasHecho?.[c.clave] ?? c.clave, actual: g.guia?.hechos?.[c.clave] ?? 0, meta: c.n ?? 1 };
      case 'popularidad': return { texto: 'Intención de voto', actual: Math.round(g.intencionVoto * 100), meta: Math.round(c.n * 100), unidad: '%' };
      default: return { texto: c.tipo, actual: 0, meta: 1 };
    }
  };
  const conds = [...(e.cond ?? []), ...(e.alguna ? [e.alguna.slice().sort((a, b) => fraccion(g, b) - fraccion(g, a))[0]] : [])];
  return conds.map(c => ({ ...t(c), ok: cumple(g, c), alguna: !!e.alguna && !(e.cond ?? []).includes(c) }));
}
const fraccion = (g, c) => { if (cumple(g, c)) return 1; if (c.tipo === 'dia') return g.day / c.n; if (c.tipo === 'fama') return famaDe(g) / c.n; if (c.tipo === 'hecho') return (g.guia?.hechos?.[c.clave] ?? 0) / (c.n ?? 1); if (c.tipo === 'popularidad') return g.intencionVoto / c.n; if (c.tipo === 'afiliados') return g.afiliados / Math.max(1, g.umbral(c.n)); if (c.tipo === 'misiones') return (g.guia?.hechos?.misiones ?? 0) / c.n; if (c.tipo === 'control') return Math.max(0, ...Object.values(g.zonas).map(z => z.control)) / c.n; return 0; };
export function fraccionElemento(g, e) {
  const todas = (e.cond ?? []).map(c => fraccion(g, c)), alguna = e.alguna ? [Math.max(...e.alguna.map(c => fraccion(g, c)))] : [];
  const l = [...todas, ...alguna]; return l.length ? l.reduce((a, b) => a + Math.min(1, b), 0) / l.length : 1;
}
// Lo que viene: los cerrados más cercanos, uno por grupo
export function proximos(g, n = 3) {
  if (!g.guia?.progresivo) return [];
  const vistos = new Set(), out = [];
  for (const e of catalogo(g).filter(x => !ve(g, x.id) && x.aviso).sort((a, b) => fraccionElemento(g, b) - fraccionElemento(g, a) || (a.orden ?? 0) - (b.orden ?? 0))) {
    if (vistos.has(e.grupo)) continue; vistos.add(e.grupo); out.push({ ...e, fraccion: fraccionElemento(g, e), progreso: progreso(g, e) });
    if (out.length >= n) break;
  }
  return out;
}

// ---------- Estado ----------
export function iniciar(g, progresivo = false) {
  const guia = { progresivo: !!progresivo, revelado: [], nuevo: [], hechos: { misiones: 0 }, dineroInicial: g.player.money, ultimoAviso: null, encuentros: [] };
  g.guia = guia;
  guia.revelado = catalogo(g).filter(e => cumpleElemento(g, e)).map(e => e.id);   // lo que ya está abierto al empezar no se anuncia
  return guia;
}

// Cuenta una acción hecha (para las condiciones y el checklist del primer mes)
const CLAVES = ['misiones', 'recaudo', 'vio_rivales', 'vio_datos', 'vio_yo', 'vio_partido', 'vio_org', 'vio_elecciones', 'vio_calendario', 'encuentros', 'golpes', 'viajes', 'medios'];
const claveValida = k => CLAVES.includes(k) || /^m_[a-z_]{1,30}$/.test(k);   // m_<mision>: veces que salió bien esa misión
export function hecho(g, clave) { if (g.guia) g.guia.hechos[clave] = (g.guia.hechos[clave] ?? 0) + 1; }
export function registrarEncuentro(g, id) { if (!g.guia) return; if (!g.guia.encuentros.includes(id)) g.guia.encuentros.push(id); hecho(g, 'encuentros'); }
export function vio(g, clave) { if (g.guia && !g.guia.hechos[clave]) g.guia.hechos[clave] = 1; }

// Checklist del primer mes: se tilda sola
export function primerMes(g, items) {
  const ok = c => c.tipo === 'lanzo' ? (g.jobs.length > 0 || (g.guia?.hechos?.misiones ?? 0) >= 1) : (g.guia?.hechos?.[c.clave] ?? 0) >= c.n;
  return items.map(i => ({ ...i, ok: ok(i.cond) }));
}

// Revela lo que ahora cumple; anuncia los elementos con 'aviso' (una tarjeta por elemento) y marca "Nuevo"
export function tick(g) {
  const G = g.guia; if (!G?.progresivo) return;
  const cd = g.cfg.revelado?.cooldownDias ?? 0, lista = catalogo(g);
  for (const e of lista) {
    if (G.revelado.includes(e.id) || !cumpleElemento(g, e)) continue;
    if (!e.aviso) {                                                // lo silencioso espera a que se abra algún aviso de su grupo
      const grupo = lista.filter(x => x.grupo === e.grupo && x.aviso);
      if (grupo.length && !grupo.some(x => G.revelado.includes(x.id))) continue;
      G.revelado.push(e.id); continue;
    }
    if (G.ultimoAviso !== null && g.day - G.ultimoAviso < cd) continue;   // cooldown: de a un aviso mayor por vez
    G.revelado.push(e.id); G.ultimoAviso = g.day;
    if (e.donde) G.nuevo.push(e.id);
    g.note(`Se abrió: ${e.titulo}.`, 'promo');
    g.informar({ tipo: 'desbloqueo', nombre: e.titulo, zona: null, zonaNombre: '', ok: null, texto: `${e.que} ${e.como}`, cambios: [], donde: e.donde ?? null, elemento: e.id });
  }
}

// El jugador entra a un lugar ({vista, tab?, sub?}): se saca la marca "Nuevo" de lo que vive ahí
export function marcarVisto(g, donde) {
  const G = g.guia; if (!G?.nuevo.length) return;
  G.nuevo = G.nuevo.filter(id => {
    const d = elemento(g, id)?.donde;
    return !!d && !(d.vista === donde.vista && (d.tab === undefined || d.tab === donde.tab) && (d.sub === undefined || d.sub === donde.sub));
  });
}
const dondes = g => (g.guia?.nuevo ?? []).map(id => elemento(g, id)?.donde).filter(Boolean);
export const nuevoVista = (g, vista) => dondes(g).some(d => d.vista === vista);
export const nuevoTab = (g, tab) => dondes(g).some(d => d.vista === 'mapa' && d.tab === tab);
export const nuevoSub = (g, vista, sub) => dondes(g).some(d => d.vista === vista && d.sub === sub);

// Activar o desactivar el modo progresivo (al activarlo no se oculta lo que ya cumple)
export function setProgresivo(g, v) {
  const G = g.guia; if (!G) return;
  G.progresivo = !!v;
  if (v) for (const e of catalogo(g)) if (cumpleElemento(g, e) && !G.revelado.includes(e.id)) G.revelado.push(e.id);
}

// ---------- Restauración segura ----------
export function sanear(g, raw) {
  if (!raw || typeof raw !== 'object') { const G = iniciar(g, false); G.progresivo = false; return G; }   // partidas viejas: se ve todo, sin avalancha de avisos
  const ids = new Set((g.cfg.revelado?.elementos ?? []).map(e => e.id));
  return {
    progresivo: !!raw.progresivo,
    revelado: Array.isArray(raw.revelado) ? [...new Set(raw.revelado.filter(id => ids.has(id)))] : [],
    nuevo: Array.isArray(raw.nuevo) ? [...new Set(raw.nuevo.filter(id => ids.has(id)))].slice(0, 30) : [],
    hechos: Object.fromEntries([...new Set([...CLAVES, ...Object.keys(raw.hechos ?? {}).filter(claveValida).slice(0, 80)])].map(k => [k, fin(raw.hechos?.[k]) ? Math.max(0, Math.floor(raw.hechos[k])) : 0])),
    encuentros: Array.isArray(raw.encuentros) ? [...new Set(raw.encuentros.filter(x => typeof x === 'string'))].slice(0, 60) : [],
    ultimoAviso: fin(raw.ultimoAviso) ? raw.ultimoAviso : null,
    dineroInicial: fin(raw.dineroInicial) ? raw.dineroInicial : g.cfg.start.money,
  };
}
