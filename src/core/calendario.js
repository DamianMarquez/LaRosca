// Calendario anual: elecciones (derivadas del módulo electoral), fechas institucionales, feriados y hitos del partido. Sin DOM y sin estado propio.
import { Clock } from './clock.js';
import { fechasDe, tipoDe } from './elecciones.js';

const C = g => g.cfg.calendario ?? { hitos: [], categorias: {}, avisoDias: 7 };
export const categorias = g => C(g).categorias;

// Hitos electorales de un proceso (año impar), derivados de las fases configuradas
function electorales(g, a) {
  const E = g.cfg.elecciones; if (!E || a < E.primerAnio || (a - E.primerAnio) % 2) return [];
  const f = fechasDe(a), F = E.fases, tipo = tipoDe(g.cfg, a), G = f.general, cierre = f.paso - E.cierreListasAntesPaso;
  const ir = { vista: 'elecciones' }, cat = 'electoral', nom = t => `${t} ${a}`;
  return [
    { id: `el${a}:conv`, dia: G - F.convocatoria, nombre: nom('Convocatoria'), texto: `Se convoca a elecciones ${tipo}s: empieza el proceso.`, cat, ir },
    { id: `el${a}:alianzas`, dia: G - F.alianzas, nombre: nom('Se abren las alianzas'), texto: 'Es el momento de armar frentes y negociar cupos con otros partidos.', cat, ir },
    { id: `el${a}:listas`, dia: G - F.listas, nombre: nom('Se arman las listas'), texto: 'Empieza el armado de listas de candidatos.', cat, ir },
    { id: `el${a}:cierre`, dia: cierre, nombre: nom('Cierre de listas'), texto: 'Último día para presentar listas: quien no se presenta, no compite.', cat, ir },
    { id: `el${a}:paso`, dia: f.paso, nombre: nom('PASO'), texto: 'Primarias abiertas, simultáneas y obligatorias: termómetro de la elección.', cat, ir },
    { id: `el${a}:campana`, dia: G - F.campana, nombre: nom('Arranca la campaña'), texto: 'Las misiones exitosas pesan más en los barrios.', cat, ir },
    { id: `el${a}:veda`, dia: G - F.veda, nombre: nom('Veda electoral'), texto: 'No se puede hacer campaña hasta la votación.', cat, ir },
    { id: `el${a}:general`, dia: G, nombre: nom('Elecciones generales'), texto: 'Día de la votación.', cat, ir },
    ...(tipo === 'ejecutiva' ? [{ id: `el${a}:balotaje`, dia: f.balotaje, nombre: nom('Posible balotaje'), texto: 'Si nadie llega al umbral en la presidencial, hay segunda vuelta.', cat, ir }] : []),
    { id: `el${a}:asuncion`, dia: f.asuncion, nombre: nom('Asunción de los electos'), texto: 'Asumen los nuevos cargos.', cat, ir },
  ];
}

// Hitos del partido: aniversario, rendición de cuentas y trámite en curso
function delPartido(g, desde, hasta) {
  const out = [], org = g.org;
  for (let n = Math.max(1, Math.floor(desde / 365)); n * 365 <= hasta + 365; n++) {
    if (n * 365 >= desde && n * 365 <= hasta) out.push({ id: `ani:${n}`, dia: n * 365, nombre: `Aniversario del partido (${n} año${n === 1 ? '' : 's'})`, texto: 'Un año más: buena fecha para un acto con la militancia.', cat: 'partido', ir: { vista: 'partido' } });
    const rd = g.cfg.organizacion?.finanzas?.rendicionDia;
    if (org && rd != null) { const d = n * 365 + rd; if (d >= desde && d <= hasta) out.push({ id: `rend:${n}`, dia: d, nombre: 'Rendición de cuentas', texto: 'Si el partido es reconocido, se presentan los libros: cuidá tus finanzas.', cat: 'partido', ir: { vista: 'organizacion', sub: 'finanzas' } }); }
  }
  if (org?.tramite && org.tramite.hasta >= desde && org.tramite.hasta <= hasta) out.push({ id: `tram:${org.tramite.hasta}`, dia: org.tramite.hasta, nombre: 'Resolución del trámite', texto: 'Se resuelve el trámite de reconocimiento en curso.', cat: 'partido', ir: { vista: 'organizacion', sub: 'estado' } });
  return out;
}

// Todos los hitos entre dos días (inclusive), ordenados
export function hitos(g, desde, hasta) {
  const a0 = Clock.parts(Math.max(desde, -400)).anio - 1, a1 = Clock.parts(hasta).anio + 1, out = [];
  for (let a = a0; a <= a1; a++) {
    for (const x of C(g).hitos) out.push({ ...x, id: `${x.id}:${a}`, dia: Clock.dayOf(a, x.mes, x.dia) });
    out.push(...electorales(g, a));
  }
  out.push(...delPartido(g, desde, hasta));
  return out.filter(x => x.dia >= desde && x.dia <= hasta).sort((x, y) => x.dia - y.dia);
}
export const hitosDelAnio = (g, anio) => hitos(g, Clock.dayOf(anio, 1, 1), Clock.dayOf(anio, 12, 31));
export const proximos = (g, n = 5, horizonte = 120) => hitos(g, g.day, g.day + horizonte).slice(0, n);

// Ventanas de oportunidad activas hoy (feriados y aguinaldos): [{hito, ventana}]
export function ventanasActivas(g) {
  const out = []; if (!C(g).hitos.length) return out;
  const a = Clock.parts(g.day).anio;
  for (const y of [a - 1, a]) for (const x of C(g).hitos) {
    if (!x.ventana) continue;
    const d = Clock.dayOf(y, x.mes, x.dia);
    if (g.day >= d && g.day < d + x.ventana.dias) out.push({ hito: x, ventana: x.ventana, dia: d });
  }
  return out;
}
// Aporte a la chance de una misión: [[etiqueta, puntos]]
export function factores(g, m) {
  return ventanasActivas(g).filter(v => v.ventana.misiones.includes(m.id)).map(v => [`${v.hito.nombre}: ${v.ventana.texto.split(':')[0].toLowerCase()}`, v.ventana.exito]);
}

// Avisos en el registro unos días antes de los hitos que importan
export function tick(g) {
  const dias = C(g).avisoDias;
  for (const x of hitos(g, g.day + dias, g.day + dias)) {
    if (x.cat === 'electoral' && !/Cierre|Veda|general/.test(x.nombre)) continue;       // las fases ya se avisan solas
    if (x.cat === 'institucional' && !x.ventana) continue;
    g.note(`En ${dias} días: ${x.nombre}.`, 'info');
  }
}
