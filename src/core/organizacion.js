// Organización partidaria del modo Fundar: origen, estado legal con trámites, comités barriales, notoriedad y contactos. Sin DOM.
// Separa el partido (entidad legal y de estructura) del líder (fama, contactos, habilidades).
import { rng } from './city.js';
import { presencia, rivales } from './rivals.js';
import { cambiarRelacion } from './pactos.js';
import * as plantel from './plantel.js';
import * as personaje from './personaje.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = Number.isFinite;
const O = g => g.cfg.organizacion;
const OR = g => g.cfg.origenes;
const limpia = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

export const esFundador = g => g.modo === 'fundador' && !!g.org;
export const estadoDef = (g, id) => O(g).estados.find(e => e.id === id);
const idx = (g, id) => O(g).estados.findIndex(e => e.id === id);
export const estadoActual = g => estadoDef(g, g.org.estado);
export const siguiente = g => O(g).estados[idx(g, g.org.estado) + 1] ?? null;
export const perfilDe = (g, id) => OR(g).perfiles.find(p => p.id === id) ?? null;
// Alcance electoral que da el estado legal
export const alcanceEstado = estado => ({ distrito: 'distrito', provincial: 'provincial', nacional: 'nacional' }[estado] ?? 'local');

// ---------- Inicio según el origen ----------
const names = g => g.cfg.plantel.nombres;
function contactos(g, n, r) {
  const prin = new Set(g.partido.principios), N = names(g);
  const rs = rivales(g).map(x => ({ id: x.id, afin: x.principios.filter(p => prin.has(p)).length + r() * 0.5 })).sort((a, b) => b.afin - a.afin);
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = rs[i % rs.length];
    out.push({ id: `k${i + 1}`, nombre: `${N.nombre[Math.floor(r() * N.nombre.length)]} ${N.apellido[Math.floor(r() * N.apellido.length)]}`, partido: p.id, relacion: Math.round(clamp(42 + Math.floor(p.afin) * 8 + r() * 10, 0, 100)) });
    cambiarRelacion(g, p.id, 8);
  }
  return out;
}

// Crea el estado de la organización y aplica los efectos del origen elegido. Solo en modo Fundar.
export function iniciar(g, partido) {
  if (g.modo !== 'fundador' || !g.cfg.organizacion || !g.cfg.origenes) return null;
  const origen = OR(g).origenes.some(o => o.id === partido?.origen) ? partido.origen : 'abajo';
  const org = { origen, perfil: null, desprendeDe: null, estado: 'idea', tramite: null, fama: 0, controversia: 0, contactos: [], comites: {} };
  g.org = org;
  const r = rng(`${g.prov.id}:${g.partido.nombre}:origen`);
  if (origen === 'figura') {
    const p = perfilDe(g, partido?.perfil) ?? OR(g).perfiles[0];
    org.perfil = p.id; org.fama = p.fama; org.controversia = p.controversia;
    g.player.money = p.dinero;
    const T = g.cfg.habilidades.xpNivel;                                         // hasta el nivel 3 se entrena; por encima, ya traés práctica de sobra
    for (const [id, nv] of Object.entries(p.habilidades ?? {})) if (g.jugador.habilidades[id]) { g.jugador.habilidades[id].xp = T[Math.min(nv, T.length - 1)]; g.jugador.habilidades[id].invertidos = Math.max(0, nv - (T.length - 1)); }
    g.plantel.miembros = g.plantel.miembros.slice(0, p.cuadros);                  // casi sin estructura propia
    org.contactos = contactos(g, p.contactos, r);
  } else if (origen === 'desprendimiento') {
    const D = OR(g).desprendimiento, madre = g.cfg.partidos.partidos.find(x => x.id === partido?.desprendeDe && x.id !== 'otros');
    const id = (madre ?? rivales(g)[0]).id;
    org.desprendeDe = id; org.fama = D.fama;
    plantel.agregarCuadros(g, D.cuadros, { cap: [35, 75], lealtad: [45, 80], origen: 'fundador', seed: 'desprendimiento' });
    // Barrios donde el partido madre tenía más presencia: te llevás parte de esa base
    const zs = Object.values(g.zonas).sort((a, b) => (presencia(g, b.id)[id] ?? 0) * b.pop - (presencia(g, a.id)[id] ?? 0) * a.pop).slice(0, D.barrios);
    for (const z of zs) z.control = D.control;
    org.concejales = D.concejales;
    cambiarRelacion(g, id, D.relacionMadre - (g.alianzas.relaciones[id] ?? 0));
  } else {
    const A = OR(g).abajo; org.fama = A.fama;
    for (const z of Object.values(g.zonas)) z.trust = A.trust;                    // cercanía: te conocen en el barrio
    org.contactos = contactos(g, A.contactos, r);
  }
  g.player.rank = derivarRango(g);
  return org;
}

// Concejales que se llevó el desprendimiento: los suma el motor electoral al cargar la partida nueva
export function cargosIniciales(g, hasta) {
  const org = g.org; if (!org?.concejales) return [];
  const libres = g.plantel.miembros.filter(m => !m.cargo).sort((a, b) => b.capacidad - a.capacidad).slice(0, org.concejales);
  delete org.concejales;
  return libres.map((m, i) => ({ id: `c0${i + 1}`, contienda: 'concejales', cargo: 'Concejal', quien: m.id, nombre: m.nombre, desde: 0, hasta }));
}

// ---------- Influencia (rango derivado) ----------
export function derivarRango(g) {
  const F = O(g).fama, e = estadoActual(g), b = g.elecciones?.bancas ?? 0;
  const bancas = [...O(g).bancasRango].reverse().find(([n]) => b >= n)?.[1] ?? 0;
  return clamp(Math.max(e.rango, Math.min(F.rangoMax, Math.floor(g.org.fama / F.rangoPor)), bancas), 0, g.cfg.ranks.length - 1);
}

// ---------- Estado legal ----------
// Requisitos para pasar al siguiente estado (null si ya estás en el último)
export function requisitos(g) {
  const R = siguiente(g); if (!R) return null;
  const nZonas = R.zonas ? Math.min(R.zonas.n, Math.max(1, Math.round(Object.keys(g.zonas).length * 0.25))) : 0;
  const items = [{ id: 'afiliados', texto: 'Afiliados', ok: g.afiliados >= g.umbral(R.afiliados), actual: g.afiliados, meta: g.umbral(R.afiliados) }];
  if (nZonas) { const n = Object.values(g.zonas).filter(z => z.control >= R.zonas.control).length; items.push({ id: 'zonas', texto: `Barrios con ≥${Math.round(R.zonas.control * 100)}% de control`, ok: n >= nZonas, actual: n, meta: nZonas }); }
  for (const id of R.organos ?? []) { const c = plantel.cargoDef(g, id), t = plantel.titular(g, id); items.push({ id: `organo:${id}`, texto: `Autoridad cubierta: ${c.nombre}`, ok: !!t, actual: t ? t.nombre : 'vacante', meta: null, organo: id }); }
  if (R.comites) { const n = Object.keys(g.org.comites).length; items.push({ id: 'comites', texto: `Comités barriales (${R.comites})`, ok: n >= R.comites, actual: n, meta: R.comites }); }
  if (R.bancas) { const n = g.elecciones?.bancas ?? 0; items.push({ id: 'bancas', texto: `Bancas obtenidas (${R.bancas})`, ok: n >= R.bancas, actual: n, meta: R.bancas }); }
  const dias = Math.max(7, Math.round(R.dias * (1 - 0.3 * plantel.bono(g, 'apoderado'))));
  return { id: R.id, nombre: R.nombre, texto: R.texto, habilita: R.habilita, items, todos: items.every(i => i.ok), costo: Math.round(R.costo * Math.max(0.35, Math.min(1, g.escala))), dias };
}

export function iniciarTramite(g) {
  if (!esFundador(g)) return 'Solo quien funda un partido tramita su reconocimiento.';
  const q = requisitos(g);
  if (!q) return 'Tu partido ya tiene el reconocimiento más alto.';
  if (g.org.tramite) return 'Ya hay un trámite en curso.';
  if (!q.todos) return 'Todavía no cumplís todos los requisitos.';
  if (g.player.money < q.costo) return 'Falta dinero para el trámite.';
  g.player.money -= q.costo;
  g.org.tramite = { hacia: q.id, hasta: g.day + q.dias };
  g.note(`Iniciaste el trámite de «${q.nombre}»: demora ${q.dias} días y costó $${q.costo.toLocaleString('es-AR')}.`, 'info');
  return null;
}

// ---------- Comités barriales ----------
export const comitesN = g => Object.keys(g.org?.comites ?? {}).length;
export const gastoComites = g => (esFundador(g) ? Math.round(comitesN(g) * O(g).comite.mensual * Math.max(0.35, Math.min(1, g.escala))) : 0);
export const costoComite = g => Math.round(O(g).comite.costo * Math.max(0.35, Math.min(1, g.escala)));
export function abrirComite(g, zonaId) {
  const z = g.zonas[zonaId], C = O(g).comite;
  if (!esFundador(g) || !z) return 'No se puede abrir un comité ahí.';
  if (g.org.comites[zonaId]) return 'Ya hay un comité en ese barrio.';
  if (z.control < C.control) return `Necesitás al menos ${Math.round(C.control * 100)}% de control en ${z.nombre}.`;
  const costo = costoComite(g);
  if (g.player.money < costo) return 'Falta dinero para abrir el comité.';
  g.player.money -= costo; g.org.comites[zonaId] = { desde: g.day };
  g.note(`Abriste un comité en ${z.nombre}: protege tu terreno y aporta fiscales.`, 'ok');
  return null;
}
export function cerrarComite(g, zonaId) {
  if (!g.org?.comites[zonaId]) return 'No hay comité ahí.';
  delete g.org.comites[zonaId]; g.note(`Cerraste el comité de ${g.zonas[zonaId]?.nombre ?? 'un barrio'}.`, 'info'); return null;
}
// Fiscales el día de la elección (0..1): comités y órgano de fiscalización. Se usa en el escrutinio.
export function fiscalizacion(g) {
  if (!esFundador(g)) return 1;
  const barrios = Object.keys(g.zonas).length || 1;
  const propios = 0.6 * Math.min(1, comitesN(g) / Math.max(1, barrios * 0.25)) + 0.4 * plantel.bono(g, 'fiscalizacion') / 0.6;
  const prestados = g.elecciones?.cargos?.some(c => c.bloque && c.hasta >= g.day) ? O(g).finanzas.fiscalesBloque : 0;   // el socio del bloque te presta fiscales
  return clamp(propios + prestados, 0, 1);
}

// ---------- Agenda mediática (notoriedad) ----------
export const medioDef = (g, id) => O(g).medios.find(m => m.id === id);
// Aparecer en los medios ocupa tu acción personal unos días (como descansar). El efecto llega al terminar.
export function aparecer(g, tipo) {
  const m = medioDef(g, tipo);
  if (!esFundador(g) || !m) return 'No podés hacer eso ahora.';
  if (g.org.medios) return 'Ya estás en una actividad mediática.';
  if (g.pending) return 'Primero resolvé lo pendiente.';
  if (g.jugador.descanso) return 'Estás descansando.';
  if (g.freeSlots <= 0) return 'Ya estás ocupado con otra acción personal.';
  g.org.medios = { tipo, hasta: g.day + m.dias };
  g.note(`Empezaste una actividad mediática: ${m.nombre.toLowerCase()}.`, 'info');
  return null;
}
// Notoriedad que rinde una aparición: mejora con la oratoria y se achica cuando ya sos muy conocido
export function rendimientoMedios(g, m) {
  const C = O(g).medios_cfg, F = O(g).fama;
  return Math.max(0.1, (1 + C.oratoriaPorNivel * personaje.nivel(g, 'oratoria')) * (1 - g.org.fama / C.rendimientoMax));
}
function resolverMedios(g) {
  const org = g.org, m = medioDef(g, org.medios.tipo), C = O(g).medios_cfg;
  org.medios = null;
  const f0 = org.fama, c0 = org.controversia;
  org.fama = clamp(org.fama + m.fama * rendimientoMedios(g, m), 0, 100);
  org.controversia = clamp(org.controversia + m.controversia, 0, 100);
  const escandalo = Math.random() < m.riesgo * (1 + org.controversia / 100);
  if (escandalo) { g.exposure = clamp(g.exposure + C.escandalo.exposicion, 0, 100); org.fama = clamp(org.fama + C.escandalo.fama, 0, 100); org.controversia = clamp(org.controversia + C.escandalo.controversia, 0, 100); }
  const df = org.fama - f0, dc = org.controversia - c0;
  const texto = escandalo ? `${m.nombre}: te fue mal, se viralizó algo que dijiste y creció la sospecha.` : `${m.nombre}: salió bien y ganaste notoriedad.`;
  g.note(texto, escandalo ? 'bad' : 'ok');
  g.informar({ tipo: 'medios', nombre: m.nombre, zona: null, zonaNombre: '', ok: !escandalo, texto, cambios: [{ k: 'Notoriedad', d: df }, ...(escandalo ? [{ k: 'Exposición', d: C.escandalo.exposicion }] : [])].filter(c => Math.abs(c.d) >= 0.5) });
}

// ---------- Finanzas partidarias ----------
// Fondo partidario permanente: los partidos reconocidos reciben plata según los votos de su última elección
export function ingresoFpp(g) {
  if (!esFundador(g) || idx(g, g.org.estado) < idx(g, 'distrito') || (g.org.sancion?.hasta ?? 0) > g.day) return 0;
  const h = g.elecciones?.historial?.[0], r = h?.resultados?.find(x => x.contienda === 'concejales'), p = r?.pct?.yo ?? 0, F = O(g).finanzas;
  return p >= F.fppMinPct ? Math.round(p * F.fppPorVoto / 12 * Math.max(0.35, Math.min(1, g.escala))) : 0;
}
// Rendición anual de cuentas: dinero opaco, favores y exposición pueden traer sanción
function rendicion(g) {
  const F = O(g).finanzas, org = g.org, fav = g.favores?.length ?? 0;
  const mal = g.exposure >= F.limites.exposicion || fav > F.limites.favores || g.player.black > Math.max(5000, g.player.money);
  org.rendicion = { dia: g.day, ok: !mal };
  if (!mal) { g.note('Rendición de cuentas aprobada: tus libros están en orden.', 'ok'); return; }
  const multa = Math.round(Math.max(0, g.player.money) * F.sancion.multa);
  g.player.money -= multa; g.exposure = clamp(g.exposure + F.sancion.exposicion, 0, 100); org.sancion = { hasta: g.day + F.sancion.fppSuspendeDias };
  g.note(`Rendición de cuentas observada: multa de ${multa.toLocaleString('es-AR')} pesos y suspensión del fondo partidario por ${F.sancion.fppSuspendeDias} días.`, 'bad');
  g.informar({ tipo: 'eleccion', nombre: 'Rendición de cuentas', zona: null, zonaNombre: '', ok: false, texto: 'La justicia electoral observó tus cuentas: dinero opaco o deudas de favor.', cambios: [{ k: 'Dinero', d: -multa }].filter(c => Math.abs(c.d) >= 1) });
}

// ---------- Turno diario ----------
export function tick(g) {
  if (!esFundador(g)) return;
  const org = g.org, F = O(g).fama;
  if (org.fama > F.piso) org.fama = Math.max(F.piso, org.fama - F.decae);
  if (org.controversia > 0) org.controversia = Math.max(0, org.controversia - F.controversiaDecae);
  if (g.exposure < org.controversia * F.pisoExposicion) g.exposure = org.controversia * F.pisoExposicion;   // quien es polémico vive expuesto
  if (org.medios && g.day >= org.medios.hasta) resolverMedios(g);
  if (org.tramite && g.day >= org.tramite.hasta) {
    const hacia = org.tramite.hacia, e = estadoDef(g, hacia); org.tramite = null;
    const ant = org.estado; org.estado = ant;                                // se evalúa de nuevo contra el estado anterior
    const q = requisitos(g);
    if (q && q.id === hacia && q.todos) {
      org.estado = hacia;
      g.note(`¡Tu partido obtuvo el estado de «${e.nombre}»! ${e.habilita}`, 'promo');
      g.informar({ tipo: 'eleccion', nombre: e.nombre, zona: null, zonaNombre: '', ok: true, texto: `El trámite fue aprobado. ${e.habilita}`, cambios: [] });
    } else {
      const falta = q?.items.find(i => !i.ok);
      g.note(`El trámite de «${e.nombre}» fue observado${falta ? `: ya no cumplís «${falta.texto}»` : ''}. Hay que reiniciarlo.`, 'bad');
      g.informar({ tipo: 'eleccion', nombre: 'Trámite observado', zona: null, zonaNombre: '', ok: false, texto: `La justicia electoral observó el trámite de ${e.nombre}.`, cambios: [] });
    }
  }
  if (g.day > 0 && g.day % 365 === O(g).finanzas.rendicionDia && idx(g, org.estado) >= idx(g, 'personeria')) rendicion(g);
  const nuevo = derivarRango(g);
  while (g.player.rank < nuevo) {                                           // la influencia solo sube: cada nivel da puntos de habilidad
    g.player.rank++; personaje.alAscender(g);
    g.note(`Tu influencia creció: ahora sos «${g.rankName}».`, 'promo');
  }
}

// ---------- Restauración segura ----------
export function sanear(g, raw) {
  if (g.modo !== 'fundador' || !g.cfg.organizacion) return null;
  const base = g.org ?? iniciar(g, g.partido);
  if (!raw || typeof raw !== 'object') return base;
  const ids = new Set(g.cfg.partidos.partidos.map(p => p.id));
  const org = { ...base, estado: O(g).estados.some(e => e.id === raw.estado) ? raw.estado : 'idea' };
  org.origen = OR(g).origenes.some(o => o.id === raw.origen) ? raw.origen : base.origen;
  org.perfil = perfilDe(g, raw.perfil)?.id ?? null;
  org.desprendeDe = ids.has(raw.desprendeDe) && raw.desprendeDe !== 'otros' ? raw.desprendeDe : null;
  org.fama = fin(raw.fama) ? clamp(raw.fama, 0, 100) : base.fama;
  org.controversia = fin(raw.controversia) ? clamp(raw.controversia, 0, 100) : base.controversia;
  org.tramite = raw.tramite && estadoDef(g, raw.tramite.hacia) && fin(raw.tramite.hasta) ? { hacia: raw.tramite.hacia, hasta: raw.tramite.hasta } : null;
  org.contactos = Array.isArray(raw.contactos) ? raw.contactos.filter(c => c && ids.has(c.partido) && fin(c.relacion)).slice(0, 6).map((c, i) => ({ id: String(c.id ?? `k${i + 1}`).replace(/[^\w-]/g, '').slice(0, 12), nombre: limpia(c.nombre) || 'Contacto', partido: c.partido, relacion: clamp(Math.round(c.relacion), 0, 100) })) : [];
  org.rendicion = raw.rendicion && fin(raw.rendicion.dia) ? { dia: raw.rendicion.dia, ok: !!raw.rendicion.ok } : null;
  org.sancion = raw.sancion && fin(raw.sancion.hasta) ? { hasta: raw.sancion.hasta } : null;
  org.medios = raw.medios && medioDef(g, raw.medios.tipo) && fin(raw.medios.hasta) ? { tipo: raw.medios.tipo, hasta: raw.medios.hasta } : null;
  org.comites = {};
  if (raw.comites && typeof raw.comites === 'object') for (const [z, v] of Object.entries(raw.comites)) if (g.zonas[z]) org.comites[z] = { desde: fin(v?.desde) ? v.desde : 0 };
  delete org.concejales;
  return org;
}
