// «Lo mejor ahora»: UNA acción sugerida con una frase corta. Función pura (sin DOM).
// Devuelve { id, texto, boton, accion: { tipo: 'invitacion'|'descansar'|'ir'|'mision', ... } } o null.
import { consejos } from './consejos.js';
import * as tutorial from './tutorial.js';

// Mejor misión posible ahora: alcance esperado por día de trabajo (o plata si estás en rojo)
export function mejorMision(g) {
  const casa = g.movilidad?.casa, zs = Object.values(g.zonas).sort((a, b) => b.pop - a.pop).slice(0, 8).map(z => z.id);
  if (casa && !zs.includes(casa)) zs.push(casa);
  let mejor = null, v = -Infinity;
  for (const m of g.cfg.missions) {
    if (m.ilegal || (m.categoria === 'finanzas' && g.player.money > 1500)) continue;
    for (const id of zs) {
      if (g.canStart(m, id)) continue;
      const z = g.zonas[id], ch = g.chance(m, z).c / 100;
      const x = (m.categoria === 'finanzas' ? g.ingresoEsperado(m, z) * ch / 20 : g.alcance(m, z).control * 100 * ch) / (g.dias(m) * (1 + m.costo / 2000)) * (id === casa ? 1.15 : 1);
      if (x > v) { v = x; mejor = { mision: m, zona: id }; }
    }
  }
  return mejor;
}

export function sugerir(g) {
  if (g.pending || g.viajando) return null;
  const inv = g.jugador.invitaciones?.[0];
  if (inv) { const t = g.cfg.medios?.tipos.find(x => x.id === inv.tipo); if (t) return { id: 'invitacion', texto: `Te invitaron: ${t.nombre.toLowerCase()}. Es una buena forma de hacerte conocer.`, boton: 'Aceptar invitación', accion: { tipo: 'invitacion', tipoInv: inv.tipo } }; }
  const cs = consejos(g);
  if (cs.some(c => c.id === 'agotado') && g.freeSlots > 0) return { id: 'descanso', texto: 'Estás agotado: descansá un poco o vas a rendir mal.', boton: 'Descansar', accion: { tipo: 'descansar' } };
  const alerta = cs.find(c => c.nivel === 'urgente' || (c.nivel === 'alerta' && c.tab));
  if (alerta?.tab) return { id: alerta.id, texto: alerta.texto, boton: 'Ver', accion: { tipo: 'ir', tab: alerta.tab, sub: alerta.sub } };
  const t = tutorial.actual(g), mm = g.freeSlots > 0 ? mejorMision(g) : null;
  if (t) {
    if (t.accion === 'mision' && mm) return { id: 'tut_' + t.id, texto: t.texto, boton: `${t.boton}: ${mm.mision.nombre.toLowerCase()}`, accion: { tipo: 'mision', mision: mm.mision.id, zona: mm.zona }, tutorial: t };
  }
  const op = cs.find(c => c.nivel === 'oportunidad' && c.tab);
  if (op) return { id: op.id, texto: op.texto, boton: 'Ver', accion: { tipo: 'ir', tab: op.tab, sub: op.sub }, tutorial: t };
  if (mm) return { id: 'mision', texto: `Lo más útil ahora: ${mm.mision.nombre.toLowerCase()} en ${g.zonas[mm.zona].nombre}.`, boton: 'Lanzar', accion: { tipo: 'mision', mision: mm.mision.id, zona: mm.zona }, tutorial: t };
  return t ? { id: 'tut_' + t.id, texto: t.texto, boton: null, accion: null, tutorial: t } : null;
}
