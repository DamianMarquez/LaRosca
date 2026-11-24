// Vista Elecciones: calendario, qué se decide en cada fase, cargos en disputa, encuestas, cargos electivos e historial. Cadenas HTML.
import * as el from '../core/elecciones.js';
import { rivales } from '../core/rivals.js';
import { relacion } from '../core/pactos.js';
import { Clock } from '../core/clock.js';
import * as mesa from '../core/mesa.js';
import * as of from '../core/ofensivas.js';
import { uiState } from './ui.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(n).toLocaleString('es-AR');
const pc = v => (v * 100).toFixed(1).replace('.', ',') + '%';
const diasTxt = n => (n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} d`);
const approx5 = v => '~' + Math.round(v * 20) * 5 + '%';

const AYUDA = {
  espera: 'Todavía no hay una elección convocada. Aprovechá para construir presencia: lo que hagas ahora define cómo llegás.',
  convocatoria: 'Ya está la fecha. Se vienen los frentes, las listas y la campaña: ordená tu estructura y tu caja.',
  alianzas: 'Es el momento de sumar aliados. Un frente junta los votos de dos partidos y reparte las bancas entre ellos.',
  listas: 'Se arman y presentan las listas. Quien no se presenta antes del cierre, no compite.',
  paso: 'Se hicieron las primarias: sirven de termómetro. Todo lo que sigue es campaña.',
  campana: 'Campaña: tus misiones exitosas pesan más en los barrios. Las encuestas te dicen cómo venís.',
  veda: 'Veda electoral: no se puede hacer campaña. Solo queda esperar la votación.',
  elegido: 'Ya se votó. Quedan el recuento y la asunción de los electos.',
  asumido: 'Asumieron los nuevos cargos.',
};

function linea(g, P) {
  const F = g.cfg.elecciones.fases, G = P.fechas.general, cierre = P.fechas.paso - g.cfg.elecciones.cierreListasAntesPaso;
  const pasos = [['convocatoria', 'Convocatoria', G - F.convocatoria], ['alianzas', 'Alianzas', G - F.alianzas], ['listas', 'Listas', G - F.listas, `cierre ${Clock.format(cierre)}`], ['paso', 'PASO', P.fechas.paso], ['campana', 'Campaña', G - F.campana], ['veda', 'Veda', G - F.veda], ['elegido', 'Elección', G], ['asumido', 'Asunción', P.fechas.asuncion]];
  const idx = el.FASES.indexOf(P.fase);
  return `<ol class="timeline" aria-label="Calendario electoral">${pasos.map(([id, nombre, dia, extra]) => {
    const i = el.FASES.indexOf(id), estado = i < idx ? 'hecho' : i === idx ? 'ahora' : 'luego';
    return `<li class="tl ${estado}"><b>${esc(nombre)}</b><small>${esc(Clock.format(dia))}</small>${extra ? `<small class="muted">${esc(extra)}</small>` : ''}</li>`;
  }).join('')}</ol>`;
}

function barras(g, pct, bancas) {
  const orden = Object.entries(pct).sort((a, b) => b[1] - a[1]);
  const bar = orden.map(([id, v]) => `<i style="width:${(v * 100).toFixed(1)}%;background:${el.colorPartido(g, id)}" title="${esc(el.nombrePartido(g, id))} ${pc(v)}"></i>`).join('');
  const leyenda = orden.map(([id, v]) => `<span><span class="dot" style="background:${el.colorPartido(g, id)}"></span>${esc(el.nombrePartido(g, id))} ${pc(v)}${bancas && bancas[id] ? ` · <b>${bancas[id]}</b>` : ''}</span>`).join('');
  return `<div class="vote-bar">${bar}</div><div class="vote-legend">${leyenda}</div>`;
}

function contiendaCard(g, P, c) {
  const st = P.contiendas[c.id], mio = g.modo === 'fundador', f = P.fase;
  const sub = c.balotaje ? '1 cargo · balotaje si nadie llega al 45 % (o 40 % y 10 puntos de ventaja)' : c.sistema === 'unipersonal' ? '1 cargo · mayoría simple' : c.sistema === 'senado' ? `${st.bancas} bancas en los distritos que renuevan · 2 para la mayoría y 1 para la primera minoría` : `${st.bancas} banca${st.bancas === 1 ? '' : 's'} en juego · D'Hondt, piso ${(g.cfg.elecciones.umbral * 100).toFixed(0)}% del padrón`;
  let cuerpo = '', estado;
  if (mio) {
    const puede = el.puedePresentar(g, c);
    estado = st.estado === 'presentada' ? '<span class="tag">presentada</span>' : st.estado === 'no_presenta' ? '<span class="tag warn">no te presentaste</span>' : puede ? '<span class="tag warn">sin presentar</span>' : '<span class="tag warn">sin reconocimiento</span>';
    const cupo = P.cupos?.[c.id];
    if (cupo) { estado = `<span class="tag">cupo con ${esc(el.nombrePartido(g, cupo.host))}</span>`; cuerpo = `<small>${cupo.lugares} lugar${cupo.lugares === 1 ? '' : 'es'} en su lista: ${cupo.lista.length ? cupo.lista.map((q, i) => `${i + 1}. ${esc(q === 'yo' ? g.jugador.nombre : g.plantel.miembros.find(m => m.id === q)?.nombre ?? '—')}`).join(' · ') : 'sin candidatos elegidos'}.</small><div class="btns"><button data-vista="organizacion" data-osub-ir="acuerdos">Ver el acuerdo</button></div>`; }
    else if (!puede) cuerpo = `<small class="muted">Para presentarte tu partido necesita el reconocimiento de ${esc(c.requiere.alcance)}: se tramita en Organización → Estado legal.</small>`;
    else if (f === 'listas' && st.estado !== 'presentada') {
      const todos = el.candidatos(g, c.id).sort((x, y) => (y.id === 'yo') - (x.id === 'yo') || y.capacidad - x.capacidad);
      const cand = todos.filter((x, i) => i < 10 || st.lista.includes(x.id));
      cuerpo = `<div class="cands">${cand.map(x => { const i = st.lista.indexOf(x.id); return `<button class="cand ${i >= 0 ? 'on' : ''}" data-el-toggle="${esc(c.id)}" data-q="${esc(x.id)}">${i >= 0 ? `<b>${i + 1}.</b> ` : ''}${esc(x.nombre)}<small>cap. ${x.capacidad}</small></button>`; }).join('')}</div>
        ${todos.length > cand.length ? `<small class="muted">+${todos.length - cand.length} cuadros más (la lista automática elige a los mejores)</small>` : ''}<div class="btns"><button data-el-auto="${esc(c.id)}">Armar lista automática</button><button class="primary" data-el-presentar="${esc(c.id)}" ${!st.lista.length ? 'disabled' : ''}>Presentar · ${money(el.costoLista(g, c))}</button></div>`;
    } else if (st.estado === 'presentada') {
      cuerpo = `<small>Lista: ${st.lista.map((q, i) => `${i + 1}. ${esc(q === 'yo' ? g.jugador.nombre : g.plantel.miembros.find(m => m.id === q)?.nombre ?? '—')}`).join(' · ')}</small>${f === 'listas' ? `<div class="btns"><button data-el-retirar="${esc(c.id)}">Retirar lista (recupera la mitad)</button></div>` : ''}`;
    }
  } else {
    estado = '<span class="tag">tu partido presenta</span>';
    if (st.lugar) cuerpo = `<small>Tenés el <b>lugar ${st.lugar}</b> en la lista.</small>`;
    else if (f === 'listas') {
      const okRango = g.player.rank >= c.requiere.rangoCandidato;
      cuerpo = st.pidio ? '<small class="muted">Pediste un lugar y el partido no te lo dio.</small>'
        : `<div class="btns"><button data-el-lugar="${esc(c.id)}" ${okRango ? '' : 'disabled'} data-tip-texto="${esc(okRango ? `Probabilidad estimada ${approx5(el.probLugar(g, c.id))}. Depende de tu rango y de tu relación con tu líder.` : `Necesitás ser ${g.rangos[c.requiere.rangoCandidato]} para postularte.`)}">Pedir un lugar en la lista</button></div>`;
    } else cuerpo = `<small class="muted">Para postularte hace falta ser ${esc(g.rangos[c.requiere.rangoCandidato])}.</small>`;
  }
  return `<div class="cont"><div class="cont-h"><b>${esc(c.titulo)}</b>${estado}</div><small class="muted">${esc(sub)}</small>${cuerpo}</div>`;
}

// Mesa de armado: ofertas por rondas con cada partido (frente, cupo o apoyo), con plazos, contraofertas y tablero de listas
const ESTADO_CLS = { libre: '', pendiente: 'warn', contraoferta: 'warn', aceptada: 'ok', rechazada: 'bad', vencida: '', rota: 'bad', retirada: '', otro: '' };
function mesaForm(g, P, r) {
  const F = uiState.mesaForm, C = g.cfg.elecciones, conts = el.contiendasDe(g, P.tipo).filter(c => el.cupoElegible(g, c) && !P.cupos[c.id]);
  const tipos = [['frente', 'Frente'], ['cupo', 'Cupo en su lista'], ['apoyo', 'Apoyo mutuo']];
  const t = { tipo: F.tipo, cid: F.cid ?? conts[0]?.id ?? null, lugares: F.lugares, pago: F.pago, cabeza: F.cabeza, dinero: F.dinero };
  const mot = mesa.motivo(g, r.id, t), p = mesa.prob(g, r.id, t), costo = mesa.costoDinero(g, t);
  const seg = (campo, opciones, val) => `<div class="seg">${opciones.map(([id, n]) => `<button class="${String(val) === String(id) ? 'on' : ''}" data-mesa-set="${campo}|${esc(id)}">${esc(n)}</button>`).join('')}</div>`;
  const extra = F.tipo === 'frente' ? `<label class="mf">Cabeza de lista ${seg('cabeza', [['yo', 'Yo'], ['socio', 'Que encabece el socio']], F.cabeza)}</label><label class="mf">Aporte de dinero ${seg('dinero', [['0', 'No'], ['1', `Sí · ${money(el.costoCupo(g, 1))}`]], F.dinero ? '1' : '0')}</label>`
    : F.tipo === 'cupo' ? (conts.length ? `<label class="mf">Cargo ${seg('cid', conts.map(c => [c.id, c.titulo]), t.cid)}</label><label class="mf">Lugares ${seg('lugares', Array.from({ length: Math.max(1, el.maxLugares(g, el.contiendaDef(g, t.cid) ?? conts[0])) }, (_, i) => [i + 1, String(i + 1)]), F.lugares)}</label><label class="mf">A cambio de ${seg('pago', [['dinero', `Dinero · ${money(el.costoCupo(g, F.lugares))}`], ['apoyo', 'Apoyo'], ['bloque', 'Bloque']], F.pago)}</label>` : '<small class="muted">No hay cargos con cupo disponibles.</small>') : '<small class="muted">Se apoyan mutuamente en campaña sin compartir lista: mejora la relación y suma campaña donde tienen presencia.</small>';
  return `<div class="mesa-form"><div class="mf-tipos">${seg('tipo', tipos, F.tipo)}</div>${extra}
    <div class="btns"><button class="primary" data-mesa-enviar="${esc(r.id)}" ${mot ? 'disabled' : ''}>Enviar propuesta</button><span class="muted small-p">${mot ? esc(mot) : `Chance estimada ${approx5(p)}${costo ? ` · cuesta ${money(costo)}` : ''}`}</span></div></div>`;
}
function mesaFila(g, P, r) {
  const E = mesa.estadoDe(g, r.id), l = mesa.deRival(g, r.id), ult = l[l.length - 1], rel = Math.round(relacion(g, r.id)), ren = of.nivelRencor(g, r.id);
  const abierto = uiState.mesaForm.rid === r.id, ocupado = !!mesa.aliadoDeOtro(g, r.id);
  let detalle = '';
  if (ult?.estado === 'pendiente') detalle = `<small>Ofreciste ${esc(mesa.descripcion(g, ult))}. Responde ${esc(diasTxt(ult.responde - g.day))}.</small> <button class="ghost" data-mesa-retirar="${ult.id}">Retirar</button>`;
  else if (ult?.estado === 'contraoferta') detalle = `<div class="contra"><small><b>Contraoferta:</b> pide ${esc(mesa.textoContra(g, ult))}. Vence ${esc(diasTxt(ult.vence - g.day))}.</small><div class="btns"><button class="primary" data-mesa-resp="${ult.id}|1">Aceptar</button><button class="danger" data-mesa-resp="${ult.id}|0">Rechazar</button></div></div>`;
  else if (ult?.estado === 'aceptada') detalle = `<small>${esc(TIPO_TXT[ult.tipo])}: ${esc(mesa.descripcion(g, ult))}${ult.pagado ? ` · pagaste ${money(ult.pagado)}` : ''}. Puede romperse hasta el cierre.</small>`;
  else if (ult) detalle = `<small class="muted">${esc(E.texto)}${ult.nota ? ` (${esc(ult.nota)})` : ''}.</small>`;
  const puede = !ocupado && !['pendiente', 'contraoferta', 'aceptada'].includes(ult?.estado);
  return `<div class="mesa-fila"><div class="mesa-top"><span class="dot" style="background:${r.color}"></span><b>${esc(r.nombre)}</b><span class="tag ${ESTADO_CLS[E.id] ?? ''}">${esc(E.texto)}</span><small class="muted">relación ${rel}${ren !== 'ninguno' ? ` · rencor ${ren}` : ''}</small>${puede ? `<button class="ghost" data-mesa-abrir="${esc(r.id)}" aria-expanded="${abierto}">${abierto ? 'Cerrar' : 'Negociar…'}</button>` : ''}</div>${detalle}${abierto && puede ? mesaForm(g, P, r) : ''}</div>`;
}
const TIPO_TXT = { frente: 'Frente', cupo: 'Cupo', apoyo: 'Apoyo' };
function tablero(g, P) {
  return el.contiendasDe(g, P.tipo).map(c => {
    const st = P.contiendas[c.id], cu = P.cupos[c.id];
    const e = cu ? `cupo con ${esc(el.nombrePartido(g, cu.host))} (${cu.lugares} lugar${cu.lugares === 1 ? '' : 'es'}${cu.lista.length ? `, ${cu.lista.length} cargado${cu.lista.length === 1 ? '' : 's'}` : ', sin cargar'})` : st.estado === 'presentada' ? `lista propia presentada (${st.lista.length})` : st.estado === 'no_presenta' ? 'no te presentás' : el.puedePresentar(g, c) ? (st.lista.length ? `lista armada (${st.lista.length}), sin presentar` : 'sin lista') : `sin reconocimiento de ${esc(c.requiere.alcance)}`;
    return `<li><b>${esc(c.titulo)}</b><small class="muted"> ${e}</small></li>`;
  }).join('');
}
function frentes(g, P) {
  if (!['alianzas', 'listas'].includes(P.fase)) return '';
  const bots = mesa.botsFrentes(g), botsTxt = bots.length ? `<p class="small-p"><b>Entre ellos:</b> ${bots.map(f => `${esc(el.nombrePartido(g, f.a))} + ${esc(el.nombrePartido(g, f.b))}`).join(' · ')}.</p>` : '<p class="small-p muted">Por ahora los demás partidos van por separado.</p>';
  if (g.modo !== 'fundador') return `<div class="card"><h3>Mesa política</h3><p class="small-p muted">Tu partido negocia sus alianzas y sus listas.</p>${botsTxt}</div>`;
  const cierre = el.diasParaCierre(g), n = mesa.activas(g).length, max = g.cfg.elecciones.mesa.maxActivas;
  return `<div class="card ancho-2 mesa"><div class="el-top"><div><h3>Mesa de armado de listas y alianzas</h3><p class="small-p">Ofrecé frentes, cupos o apoyos. Cada partido responde en unos días: acepta, <b>contraoferta</b> o rechaza. Un acuerdo puede romperse hasta el cierre de listas.</p></div>
    <span class="tag ${cierre !== null && cierre <= 10 ? 'warn' : ''}">${cierre !== null && cierre > 0 ? `Cierra en ${cierre} d` : 'Mesa cerrada'} · ${n}/${max} abiertas</span></div>
    ${botsTxt}${rivales(g).map(r => mesaFila(g, P, r)).join('')}
    <h4 class="grp-t">Tablero de listas</h4><ul class="tablero">${tablero(g, P)}</ul></div>`;
}

function encuestas(g, P) {
  const E = g.cfg.elecciones.encuesta;
  const lista = P.encuestas.slice().reverse().map(e => `<div class="enc"><small class="muted">${esc(e.origen)} · ${esc(Clock.format(e.dia))} · ±${(e.margen * 100).toFixed(0)} pts</small>${barras(g, e.pct)}</div>`).join('');
  const puede = ['alianzas', 'listas', 'paso', 'campana', 'veda'].includes(P.fase);
  return `<div class="card"><h3>Encuestas</h3>${lista || '<p class="small-p muted">Sin encuestas todavía. Sin datos, no sabés cómo venís.</p>'}
    ${puede ? `<button data-el-encuesta ${g.player.money < el.costoEncuesta(g) ? 'disabled' : ''}>Encargar encuesta · ${money(el.costoEncuesta(g))}</button><small class="muted"> Margen ±${(E.margen * 100).toFixed(0)} pts</small>` : ''}</div>`;
}

function cargos(g) {
  const vig = el.cargosVigentes(g);
  if (!vig.length) return `<div class="card"><h3>Cargos electivos</h3><p class="small-p muted">Todavía no tenés cargos. Ganar bancas da dieta, más alcance en los barrios y peso en el partido.</p></div>`;
  return `<div class="card"><h3>Cargos electivos</h3>${vig.map(c => `<div class="kv2"><span><b>${esc(c.cargo)}</b></span><span>${esc(c.quien === 'yo' ? `${c.nombre} (vos)` : c.nombre)}</span><span>hasta ${esc(Clock.format(c.hasta))}</span></div>`).join('')}
    <p class="small-p muted">Ingreso por dietas y aportes: <b>${money(el.ingresoMensual(g))}/mes</b> · alcance +${Math.round((el.alcanceMult(g) - 1) * 100)}%.</p></div>`;
}

function historial(g) {
  const H = g.elecciones.historial;
  if (!H.length) return '';
  return `<div class="card ancho-2"><h3>Historial</h3>${H.map(h => `<div class="hist"><b>Elecciones ${h.anio}</b> <small class="muted">${h.tipo === 'ejecutiva' ? 'ejecutivas' : 'legislativas'} · ${esc(Clock.format(h.dia))}</small>
    ${h.resultados.map(r => { const c = el.contiendaDef(g, r.contienda); return `<div class="hist-c"><small>${esc(c?.titulo ?? r.contienda)} · participación ${pc(r.participacion)} · ${r.ganador ? `ganó ${esc(el.nombrePartido(g, r.ganador))}` : 'a balotaje'}${r.balotaje ? ` (balotaje: ${esc(el.nombrePartido(g, r.balotaje.finalistas[0]))} vs ${esc(el.nombrePartido(g, r.balotaje.finalistas[1]))})` : ''}</small>${barras(g, r.pct, c?.sistema === 'unipersonal' ? null : r.bancas)}</div>`; }).join('')}</div>`).join('')}</div>`;
}

export function renderElecciones(g) {
  const P = g.elecciones.proceso;
  if (!P) return '<h2 class="vista-h">Elecciones</h2><p class="muted">Cargando el calendario…</p>';
  const d = el.diasHastaGeneral(g), cierre = el.diasParaCierre(g);
  const conts = el.contiendasDe(g, P.tipo);
  const cab = `<div class="card ancho-2"><div class="el-top"><div><h3>Elecciones ${P.anio} · ${P.tipo === 'ejecutiva' ? 'ejecutivas' : 'legislativas'}</h3>
      <p class="small-p">${d > 0 ? `Se vota el <b>${esc(Clock.format(P.fechas.general))}</b>: faltan <b>${d} días</b>.` : d === 0 ? 'Hoy se vota.' : `Se votó el ${esc(Clock.format(P.fechas.general))}.`}</p></div>
      <span class="tag ${P.fase === 'listas' || P.fase === 'campana' ? 'warn' : ''}">${esc(el.FASE_NOMBRE[P.fase])}</span></div>
    ${linea(g, P)}
    <p class="small-p">${esc(AYUDA[P.fase])}${P.fase === 'listas' && cierre > 0 ? ` <b>Cierre de listas en ${cierre} días.</b>` : ''}</p></div>`;
  const grupo = (amb, tit) => { const l = conts.filter(c => c.ambito === amb); return l.length ? `<h4 class="grp-t">${tit}</h4>${l.map(c => contiendaCard(g, P, c)).join('')}` : ''; };
  const disputa = `<div class="card"><h3>Cargos en disputa</h3>${grupo('municipal', 'Ciudad')}${grupo('provincial', 'Provincia')}${grupo('nacional', 'Nación')}
    <p class="small-p muted detalle">Los niveles provincial y nacional exigen alcance: ${esc(g.modo === 'fundador' ? 'se logra con el estado legal del partido (Organización)' : 'tu partido compite en todos, pero para postularte necesitás rango')}.</p></div>`;
  return `<div class="resumen-grid">${cab}${disputa}${frentes(g, P)}${encuestas(g, P)}${cargos(g)}${historial(g)}</div>`;
}

// Línea de estado para la barra superior
export function chipElecciones(g) {
  const P = g.elecciones?.proceso; if (!P) return null;
  const d = el.diasHastaGeneral(g);
  if (d === null || d < 0 || P.fase === 'espera' && d > 365) return { texto: `Elecciones ${P.anio}`, detalle: d > 0 ? `${Math.round(d / 30)} m` : '' , fase: P.fase };
  return { texto: `Elecciones ${P.anio}`, detalle: d > 60 ? `${d} d` : `${d} d`, fase: P.fase };
}
