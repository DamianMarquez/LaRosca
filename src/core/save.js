// Serialización y validación de partidas guardadas. Sin DOM ni almacenamiento (eso vive en main.js).
export const SCHEMA = 4;
export const SAVE_KEY = 'larosca.save.v4';
export const MAX_BYTES = 5 * 1024 * 1024;
export const NOMBRE_MAX = 40, NOMBRE_MIN = 3;

const isNum = v => typeof v === 'number' && Number.isFinite(v);

// Normaliza el nombre del partido: sin caracteres de control, espacios colapsados, largo acotado
export const limpiarNombre = s => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NOMBRE_MAX);

// Valida la fundación (nombre + principios). Devuelve null si es válida o un mensaje en español.
export function validarFundacion(nombre, principios, cfg, trasfondo, familia) {
  const n = limpiarNombre(nombre);
  if (n.length < NOMBRE_MIN) return `El nombre del partido necesita al menos ${NOMBRE_MIN} letras.`;
  const rival = cfg.partidos?.partidos.find(p => p.nombre.toLowerCase() === n.toLowerCase());
  if (rival) return 'Ese nombre ya lo usa otro partido. Elegí uno distinto.';
  const cat = cfg.principios?.principios ?? [], k = cfg.principios?.elegir ?? 3;
  if (!Array.isArray(principios) || new Set(principios).size !== principios.length) return 'Principios repetidos.';
  if (principios.length !== k) return `Elegí exactamente ${k} principios.`;
  if (!principios.every(id => cat.some(p => p.id === id))) return 'Principio desconocido.';
  const ts = cfg.trasfondos?.trasfondos;
  if (ts && trasfondo !== undefined && !ts.some(x => x.id === trasfondo)) return 'Elegí un trasfondo.';
  if (cfg.vida && familia !== undefined && !cfg.vida.familia.some(x => x.id === familia)) return 'Elegí tu situación familiar.';
  return null;
}

// Valida un objeto de partida (guardado local o archivo importado: nunca se confía en su contenido).
// Devuelve null si es válido o un mensaje de error en español.
export function validate(d, cfg) {
  if (!d || typeof d !== 'object') return 'El archivo no es una partida válida.';
  if (d.schemaVersion !== SCHEMA) return `Versión de partida no compatible (${d.schemaVersion ?? 'desconocida'}); se esperaba ${SCHEMA}.`;
  if (!d.prov || typeof d.prov.id !== 'string' || !cfg.capitales[d.prov.id]) return 'La partida indica una provincia desconocida.';
  if (!d.partido || typeof d.partido.nombre !== 'string' || !Array.isArray(d.partido.principios)) return 'Datos del partido inválidos.';
  const f = validarFundacion(d.partido.nombre, d.partido.principios, { ...cfg, partidos: { partidos: [] } }, d.partido.trasfondo);
  if (f) return 'Datos del partido inválidos: ' + f;
  const p = d.player;
  if (!p || ![p.rank, p.xp, p.money, p.black].every(isNum)) return 'Datos del jugador inválidos.';
  if (!isNum(d.day) || d.day < 0 || !isNum(d.exposure)) return 'Fecha o exposición inválidas.';
  if (!d.zonas || typeof d.zonas !== 'object' || Array.isArray(d.zonas)) return 'Datos de zonas inválidos.';
  for (const z of Object.values(d.zonas)) {
    if (!z || !isNum(z.control) || !isNum(z.trust)) return 'Datos de zonas inválidos.';
    if (z.efectos !== undefined && (!Array.isArray(z.efectos) || z.efectos.some(e => !e || typeof e.rival !== 'string' || typeof e.accion !== 'string' || !isNum(e.hasta)))) return 'Datos de zonas inválidos.';
  }
  // Campos opcionales (partidas anteriores no los traen): si están, deben tener la forma esperada; el contenido se sanea al cargar
  const obj = v => v && typeof v === 'object' && !Array.isArray(v);
  if (d.jugador !== undefined && !obj(d.jugador)) return 'Datos del personaje inválidos.';
  if (d.alianzas !== undefined && !obj(d.alianzas)) return 'Datos de los pactos inválidos.';
  if (d.plantel !== undefined && !obj(d.plantel)) return 'Datos del plantel inválidos.';
  if (d.rivalesPlantel !== undefined && !obj(d.rivalesPlantel)) return 'Datos de los cuadros rivales inválidos.';
  if (d.economia !== undefined && !obj(d.economia)) return 'Datos de economía inválidos.';
  if (d.favores !== undefined && !Array.isArray(d.favores)) return 'Datos de favores inválidos.';
  if (d.bots !== undefined && !obj(d.bots)) return 'Datos de los rivales inválidos.';
  if (d.historialRivales !== undefined && !Array.isArray(d.historialRivales)) return 'Historial de los rivales inválido.';
  if (d.linea !== undefined && !obj(d.linea)) return 'Datos de la línea partidaria inválidos.';
  if (!Array.isArray(d.jobs) || !Array.isArray(d.log)) return 'Misiones o historial inválidos.';
  for (const j of d.jobs) {
    if (!j || !cfg.missions.some(m => m.id === j.mission) || typeof j.zone !== 'string' || !isNum(j.start) || !isNum(j.end)) return 'Misiones inválidas.';
  }
  return null;
}

// Resumen para mostrar en el botón "Continuar" sin cargar toda la partida
export function resumen(d) {
  return { provincia: d.prov?.nombre, partido: d.partido?.nombre, dia: d.day };
}
