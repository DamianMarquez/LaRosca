// Economía del partido: ingresos y gastos mensuales, recaudación, dinero ilegal y deudas de favor. Sin DOM.
import { rng } from './city.js';
import { bono } from './plantel.js';
import * as personaje from './personaje.js';
import { cambiarRelacion } from './pactos.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = Number.isFinite;
const E = g => g.cfg.economia;

export const trasfondoDe = (cfg, id) => cfg.trasfondos?.trasfondos.find(t => t.id === id) ?? null;
export const trasfondoPorDefecto = cfg => cfg.trasfondos?.trasfondos.find(t => t.id === 'empleado_publico')?.id ?? cfg.trasfondos?.trasfondos[0]?.id ?? null;

export const estadoInicial = () => ({ historial: [], enRojos: false });

// Proyección del mes: qué entra y qué sale con el partido tal como está hoy
export function proyeccion(g) {
  const C = E(g), t = g.trasfondo, afil = g.afiliados;
  const ingresos = {
    [`Aporte propio (${t?.nombre ?? 'trabajo'})`]: personaje.aporteTrabajo(g),
    'Cuotas de afiliados': Math.round(afil * C.cuota.mensual * C.cuota.tasaPago * (1 + g.cfg.plantel.bonos.finanzas.cuotas * bono(g, 'finanzas'))),
  };
  // Los gastos fijos también escalan con el tamaño de la ciudad (sale menos una sede en Rawson que en Córdoba)
  const mult = (t?.gastoMult ?? 1) * (1 - g.cfg.plantel.bonos.finanzas.gastos * bono(g, 'finanzas')) * clamp(g.escala, 0.35, 1) * (1 + (C.rangoCosto ?? 0) * g.player.rank) * personaje.gastoFijoMult(g), G = C.gastos;   // más rango, más estructura que sostener
  const gastos = {
    'Materiales y movilidad': Math.round((G.materiales.base + G.materiales.porAfiliado * afil) * mult),
    ...(afil >= g.umbral(G.sede.desdeAfiliados) ? { 'Sede partidaria': Math.round(G.sede.costo * mult) } : {}),
    ...(g.plantel.miembros.some(m => m.cargo) ? { 'Viáticos del plantel': Math.round((g.plantel.miembros.filter(m => m.cargo && !m.cargo.startsWith('ref:')).length * G.plantel.porCargo + g.plantel.miembros.filter(m => m.cargo?.startsWith('ref:')).length * G.plantel.porReferente) * mult) } : {}),
    ...(g.equipo > 0 ? { 'Equipo de trabajo': Math.round(g.equipo * G.equipo.porMiembro * mult) } : {}),
    ...(personaje.gastoFamiliar(g) > 0 ? { 'Gastos de tu familia': personaje.gastoFamiliar(g) } : {}),
  };
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  return { ingresos, gastos, totalIngresos: sum(ingresos), totalGastos: sum(gastos), neto: sum(ingresos) - sum(gastos) };
}

// Dinero que deja una misión de recaudación en un barrio (legal depende de la confianza y del trasfondo)
export function ingresoMision(g, m, z) {
  const c = m.ilegal ? m.ingresoNegro : m.ingreso;
  if (!c) return 0;
  const bruto = c.base + (z.pop / 1000) * c.porMilHab;
  return Math.round(m.ilegal ? bruto : bruto * (0.5 + z.trust / 100) * (g.trasfondo?.donMult ?? 1) * personaje.recaudacionMult(g));
}

// ---------- Favores: lo que se debe a quien te dio plata sin recibo ----------
export function registrarFavor(g, monto, nombre = null) {
  const C = E(g).favor, r = rng(`${g.prov.id}:${g.day}:${g.favores.length}:${Math.round(monto)}`);
  const f = { id: `f${g.day}_${g.favores.length}_${Math.floor(r() * 1e6)}`, nombre: nombre ?? E(g).benefactores[Math.floor(r() * E(g).benefactores.length)], valor: Math.round(monto * C.pagoMult), hasta: g.day + C.vence, extendido: false };
  g.favores.push(f);
  return f;
}

// Devolver un favor pagando (con dinero blanco o negro)
export function pagarFavor(g, id, con = 'blanco') {
  const f = g.favores.find(x => x.id === id); if (!f) return false;
  const cuenta = con === 'negro' ? 'black' : 'money';
  if (g.player[cuenta] < f.valor) return false;
  g.player[cuenta] -= f.valor;
  g.favores = g.favores.filter(x => x !== f);
  g.note(`Devolviste el favor a ${f.nombre} (${con === 'negro' ? 'en negro' : 'en blanco'}).`, 'ok');
  return true;
}

function tickFavores(g) {
  for (const f of [...g.favores]) {
    if (f.hasta > g.day) continue;
    if (!f.extendido) {
      f.extendido = true; f.hasta = g.day + E(g).favor.extension;
      g.exposure = clamp(g.exposure + 8, 0, 100);
      g.note(`${f.nombre} reclama lo que le debés. Si no pagás pronto, lo va a hacer público.`, 'bad');
    } else {
      g.favores = g.favores.filter(x => x !== f);
      const esc = g.cfg.eventos?.eventos.find(e => e.tipo === 'escandalo');
      g.exposure = clamp(g.exposure + 20, 0, 100);
      if (f.rival) cambiarRelacion(g, f.rival, -25);
      g.note(`${f.nombre} se cansó de esperar y filtró lo que sabía.`, 'bad');
      if (esc && !g.pending) { g.pending = esc; g.ultimoEvento = g.day; g.emit('event'); }
    }
  }
}

// ---------- Liquidación mensual ----------
function liquidar(g) {
  const P = proyeccion(g);
  g.player.money += P.neto;
  const rojos = g.player.money < 0;
  g.economia.historial.unshift({ dia: g.day, ingresos: P.totalIngresos, gastos: P.totalGastos, neto: P.neto, saldo: Math.round(g.player.money) });
  g.economia.historial.length = Math.min(g.economia.historial.length, E(g).historial);
  g.economia.enRojos = rojos;
  const f = n => '$' + Math.abs(Math.round(n)).toLocaleString('es-AR');
  g.note(`Cierre del mes: entraron ${f(P.totalIngresos)} y salieron ${f(P.totalGastos)} (${P.neto >= 0 ? '+' : '−'}${f(P.neto)}).${rojos ? ' ESTÁS EN NÚMEROS ROJOS: no podés gastar hasta recuperarte.' : ''}`, rojos ? 'bad' : 'info');
  if (rojos) for (const z of Object.values(g.zonas)) z.trust = clamp(z.trust + E(g).rojos.confianza, 0, 100);
}

export function tick(g) {
  if (g.day > 0 && g.day % E(g).ciclo === 0) liquidar(g);
  tickFavores(g);
}

// ---------- Restauración segura desde un guardado ----------
export function sanear(g, raw) {
  const base = estadoInicial();
  if (raw && typeof raw === 'object') {
    base.enRojos = !!raw.enRojos;
    if (Array.isArray(raw.historial)) {
      base.historial = raw.historial.filter(h => h && [h.dia, h.ingresos, h.gastos, h.neto, h.saldo].every(fin))
        .slice(0, E(g).historial).map(h => ({ dia: h.dia, ingresos: h.ingresos, gastos: h.gastos, neto: h.neto, saldo: h.saldo }));
    }
  }
  return base;
}
export function sanearFavores(g, raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(f => f && typeof f.id === 'string' && typeof f.nombre === 'string' && fin(f.valor) && f.valor >= 0 && fin(f.hasta))
    .slice(0, 20).map(f => ({ id: f.id.slice(0, 40), nombre: f.nombre.replace(/[\u0000-\u001f<>]/g, '').slice(0, 60), valor: Math.round(f.valor), hasta: f.hasta, extendido: !!f.extendido, ...(typeof f.rival === 'string' && g.rival(f.rival) ? { rival: f.rival } : {}) }));
}
