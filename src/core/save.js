// Serialización y validación de partidas guardadas. Sin DOM ni almacenamiento (eso vive en main.js).
export const SCHEMA = 3;
export const SAVE_KEY = 'larosca.save.v3';
export const MAX_BYTES = 5 * 1024 * 1024;

const isNum = v => typeof v === 'number' && Number.isFinite(v);

// Valida un objeto de partida (guardado local o archivo importado: nunca se confía en su contenido).
// Devuelve null si es válido o un mensaje de error en español.
export function validate(d, cfg) {
  if (!d || typeof d !== 'object') return 'El archivo no es una partida válida.';
  if (d.schemaVersion !== SCHEMA) return `Versión de partida no compatible (${d.schemaVersion ?? 'desconocida'}); se esperaba ${SCHEMA}.`;
  if (!d.prov || typeof d.prov.id !== 'string' || !cfg.capitales[d.prov.id]) return 'La partida indica una provincia desconocida.';
  const p = d.player;
  if (!p || ![p.rank, p.xp, p.money, p.black].every(isNum)) return 'Datos del jugador inválidos.';
  if (!isNum(d.day) || d.day < 0 || !isNum(d.exposure)) return 'Fecha o exposición inválidas.';
  if (!d.zonas || typeof d.zonas !== 'object' || Array.isArray(d.zonas)) return 'Datos de zonas inválidos.';
  for (const z of Object.values(d.zonas)) if (!z || !isNum(z.control) || !isNum(z.trust)) return 'Datos de zonas inválidos.';
  if (!Array.isArray(d.jobs) || !Array.isArray(d.log)) return 'Misiones o historial inválidos.';
  for (const j of d.jobs) {
    if (!j || !cfg.missions.some(m => m.id === j.mission) || typeof j.zone !== 'string' || !isNum(j.start) || !isNum(j.end)) return 'Misiones inválidas.';
  }
  return null;
}

// Resumen para mostrar en el botón "Continuar" sin cargar toda la partida
export function resumen(d) {
  return { provincia: d.prov?.nombre, dia: d.day };
}
