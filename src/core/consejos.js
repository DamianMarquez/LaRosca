// Franja "Ahora": qué merece tu atención en este momento, ordenado por prioridad. Función pura (sin DOM).
import { agenda, certeza } from './rivals.js';

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
  const q = g.requisitos;
  if (q?.todos) add('ascenso', 'oportunidad', `Ya cumplís los requisitos: podés pedir el ascenso a ${q.rango}.`, 'partido');
  if (g.linea?.directiva?.estado === 'propuesta') add('directiva', 'oportunidad', 'Hay una bajada de línea esperando tu respuesta.', 'partido');
  if (g.jugador.desgaste >= g.cfg.vida.desgaste.critico) add('agotado', 'alerta', 'Estás agotado: descansá o tu rendimiento se desploma.', 'yo');
  else if (g.jugador.desgaste >= g.cfg.vida.desgaste.alto) add('cansado', 'info', 'Estás cansado: ya te cuesta rendir. Pensá en descansar.', 'yo');
  if (g.jugador.puntos > 0) add('puntos', 'oportunidad', `Tenés ${g.jugador.puntos} punto${g.jugador.puntos > 1 ? 's' : ''} de habilidad para gastar.`, 'yo');
  if (g.jobs.length === 0 && !g.pending && !g.jugador.descanso) add('libre', 'info', 'Estás libre: elegí un barrio en el mapa y lanzá una misión.', 'zona');

  return c.sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]);
}
