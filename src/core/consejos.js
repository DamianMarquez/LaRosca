// Franja "Ahora": qué merece tu atención en este momento, ordenado por prioridad. Función pura (sin DOM).
import { agenda, certeza } from './rivals.js';
import { contiendaDef, puedePresentar } from './elecciones.js';
import { requisitos as organizacionReq } from './organizacion.js';
import { proximos } from './revelado.js';
import { proximos as proximosHitos } from './calendario.js';
const alcanceOk = (g, id) => { const c = contiendaDef(g, id); return !!c && puedePresentar(g, c); };

const ORDEN = { urgente: 0, alerta: 1, oportunidad: 2, info: 3 };

// Devuelve [{ id, nivel, texto, tab, sub? }] ordenado de más a menos importante
export function consejos(g) {
  const c = [];
  const add = (id, nivel, texto, tab, sub) => c.push({ id, nivel, texto, tab, ...(sub ? { sub } : {}) });

  if (g.pending) add('evento', 'urgente', `Tenés que decidir: ${g.pending.titulo}.`, null);
  if (g.player.money < 0) add('rojos', 'urgente', 'Estás en números rojos: recaudá para poder volver a gastar.', 'zona');
  const f = g.favores.filter(x => x.hasta - g.day <= 7).sort((a, b) => a.hasta - b.hasta)[0];
  if (f) add('favor', 'urgente', `${f.nombre} te reclama $${f.valor.toLocaleString('es-AR')}: vence en ${Math.max(0, f.hasta - g.day)} d.`, 'datos', 'finanzas');
  if (g.exposure >= 60) add('exposicion', 'alerta', `Exposición alta (${Math.round(g.exposure)}%): riesgo de escándalo.`, 'datos', 'finanzas');
  // Golpe rival confirmado (en preparación o en curso) contra un barrio donde ya tenés presencia
  const golpe = agenda(g).find(a => a.tipo === 'hostil' && certeza(g, g.zonas[a.zona]) === 'confirmado' && g.zonas[a.zona].control > 0);
  if (golpe) {
    const r = g.rival(golpe.rival), z = g.zonas[golpe.zona];
    add('golpe', 'alerta', `${r.nombre} ${golpe.fase === 'planeada' ? 'prepara' : 'ejecuta'} «${golpe.def.nombre.toLowerCase()}» en ${z.nombre}.`, 'rivales');
  }
  if (g.plantel.vacantes.length) add('vacante', 'oportunidad', `Hay ${g.plantel.vacantes.length} vacante${g.plantel.vacantes.length > 1 ? 's' : ''} por cubrir en tu plantel.`, 'partido');
  const EP = g.elecciones?.proceso;
  if (EP && g.cfg.elecciones && g.day < EP.fechas.general) {
    const cierre = g.elecciones ? EP.fechas.paso - g.cfg.elecciones.cierreListasAntesPaso - g.day : 0;
    if (EP.fase === 'listas' && g.modo === 'fundador' && Object.values(EP.contiendas).some(c => c.estado === 'abierta') && Object.keys(EP.contiendas).some(id => alcanceOk(g, id))) add('lista', 'urgente', `Quedan ${Math.max(0, cierre)} días para presentar tu lista.`, 'elecciones');
    else if (EP.fase === 'listas' && g.modo === 'afiliado' && Object.values(EP.contiendas).some(c => !c.pidio && c.lugar == null) && g.player.rank >= 3) add('lista', 'oportunidad', `Se arman las listas de tu partido: podés pedir un lugar (cierra en ${Math.max(0, cierre)} días).`, 'elecciones');
    else if (EP.fase === 'alianzas' && g.modo === 'fundador' && Object.keys(EP.contiendas).some(id => alcanceOk(g, id)) && !EP.frentes.length) add('frente', 'info', 'Es la etapa de alianzas: podés armar un frente con otro partido.', 'elecciones');
    else if (['alianzas', 'listas'].includes(EP.fase) && g.modo === 'fundador' && !Object.keys(EP.cupos ?? {}).length && !Object.values(EP.contiendas).some(c => c.estado === 'presentada') && g.player.rank >= 1) add('cupo', 'oportunidad', 'Podés negociar lugares en la lista de otro partido: Organización → Acuerdos.', 'organizacion');
    else if (EP.fase === 'campana') add('campana', 'info', `Campaña en marcha: tus misiones exitosas pesan más. Faltan ${EP.fechas.general - g.day} días para votar.`, 'elecciones');
  }
  if (g.guia?.progresivo) {                                                       // lo próximo que se abre, para que se vea el camino
    const p = proximos(g, 1)[0], f = p?.progreso.find(x => !x.ok);
    if (p) add('proximo', 'info', `Próximo en abrirse: ${p.titulo}${f ? ` (${f.texto}: ${Number(f.actual).toLocaleString('es-AR')}/${Number(f.meta).toLocaleString('es-AR')})` : ''}.`, 'ayuda');
  }
  if (g.ve('vista.calendario')) { const h = proximosHitos(g, 1, 21)[0]; if (h) add('hito', 'info', `Próximo hito: ${h.nombre} (${h.dia - g.day <= 0 ? 'hoy' : `en ${h.dia - g.day} d`}).`, 'calendario'); }
  if (g.carga.n >= 2 && g.jugador.desgaste >= 40) add('delegar', 'info', `Manejás ${g.carga.n} cargos vos mismo: delegá alguno para ganar tiempo y bajar el desgaste.`, 'partido');
  if (g.org) {
    const oq = organizacionReq(g);
    if (g.org.tramite) add('tramite', 'info', `Trámite en curso: «${g.cfg.organizacion.estados.find(e => e.id === g.org.tramite.hacia)?.nombre}», faltan ${Math.max(0, g.org.tramite.hasta - g.day)} días.`, 'organizacion');
    else if (oq?.todos) add('tramite', 'oportunidad', `Ya cumplís todo para tramitar «${oq.nombre}»: iniciá el trámite en Organización.`, 'organizacion');
  }
  const q = g.requisitos;
  if (q?.todos) add('ascenso', 'oportunidad', `Ya cumplís los requisitos: podés pedir el ascenso a ${q.rango}.`, 'partido');
  if (g.linea?.directiva?.estado === 'propuesta') add('directiva', 'oportunidad', 'Hay una bajada de línea esperando tu respuesta.', 'partido');
  if (g.jugador.desgaste >= g.cfg.vida.desgaste.critico) add('agotado', 'alerta', 'Estás agotado: descansá o tu rendimiento se desploma.', 'yo');
  else if (g.jugador.desgaste >= g.cfg.vida.desgaste.alto) add('cansado', 'info', 'Estás cansado: ya te cuesta rendir. Pensá en descansar.', 'yo');
  if (g.jugador.puntos > 0) add('puntos', 'oportunidad', `Tenés ${g.jugador.puntos} punto${g.jugador.puntos > 1 ? 's' : ''} de habilidad para gastar.`, 'yo');
  if (g.jobs.length === 0 && !g.pending && !g.jugador.descanso) add('libre', 'info', 'Estás libre: elegí un barrio en el mapa y lanzá una misión.', 'zona');

  return c.sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]);
}
