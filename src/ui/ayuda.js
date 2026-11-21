// Centro de ayuda: cómo se juega, primer mes, hoja de ruta (progreso), conceptos y glosario. Cadenas HTML.
import { catalogo, ve, progreso, fraccionElemento, primerMes } from '../core/revelado.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
export const SECCIONES = [['como', 'Cómo se juega'], ['primer', 'Tu primer mes'], ['progreso', 'Progreso'], ['conceptos', 'Conceptos'], ['glosario', 'Glosario y atajos']];

function como(g, A) {
  const parrafos = g ? A.como[g.modo] ?? A.como.afiliado : [...A.como.afiliado, '', ...A.como.fundador];
  return `<h3>Cómo se juega</h3>${parrafos.filter(Boolean).map(p => `<p>${md(p)}</p>`).join('')}
    <div class="btns"><button data-ayuda-tour>▶ Repetir el recorrido guiado</button></div>`;
}

function primer(g, A) {
  if (!g) return '<p class="muted">Empezá una partida para ver tu checklist.</p>';
  const items = primerMes(g, A.primerMes), hechos = items.filter(i => i.ok).length;
  return `<h3>Tu primer mes <small class="muted">${hechos}/${items.length}</small></h3><div class="bar"><i style="width:${(hechos / items.length) * 100}%"></i></div>
    <p class="small-p muted">Se tilda sola a medida que lo hacés. Ninguno es obligatorio.</p>
    ${items.map(i => `<div class="req ${i.ok ? 'ok' : 'no'}"><span>${i.ok ? '✔' : '○'}</span><span>${esc(i.texto)}</span>${!i.ok && i.donde ? `<button data-ayuda-ir='${esc(JSON.stringify(i.donde))}'>Mostrame</button>` : '<span></span>'}</div>`).join('')}`;
}

function barras(g, e) {
  return progreso(g, e).map(p => `<div class="prog-b"><small>${esc(p.alguna ? 'O bien: ' : '')}${esc(p.texto)}: <b>${esc(Number(p.actual).toLocaleString('es-AR'))}${p.unidad ?? ''} / ${esc(Number(p.meta).toLocaleString('es-AR'))}${p.unidad ?? ''}</b></small><div class="bar thin"><i style="width:${Math.min(100, (p.actual / Math.max(1, p.meta)) * 100)}%"></i></div></div>`).join('');
}

function progresoSec(g) {
  if (!g) return '<p class="muted">Empezá una partida para ver tu hoja de ruta.</p>';
  const todos = catalogo(g).filter(e => e.aviso || e.orden === 0), prog = !!g.guia?.progresivo;
  const grupos = new Map();
  for (const e of todos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))) { if (!grupos.has(e.grupo)) grupos.set(e.grupo, []); grupos.get(e.grupo).push(e); }
  const abiertos = todos.filter(e => ve(g, e.id)).length;
  return `<h3>Progreso <small class="muted">${abiertos}/${todos.length} abiertos</small></h3>
    <p class="small-p muted">${prog ? 'El juego se va abriendo a medida que crecés. Esto es lo que ya abriste y lo que viene.' : 'El modo progresivo está apagado: ya ves todo. Podés activarlo en el menú Partida.'}</p>
    ${[...grupos].map(([grupo, els]) => `<div class="prog-g"><h4 class="grp-t">${esc(grupo)}</h4>${els.map(e => { const abierto = ve(g, e.id);
      return `<div class="prog ${abierto ? 'ok' : 'lock'}"><span class="p-ic" aria-hidden="true">${abierto ? '✔' : '🔒'}</span><div><b>${esc(e.titulo)}</b><p>${esc(e.que)}</p><small class="muted">${esc(e.como)}</small>${abierto ? '' : barras(g, e)}</div>
        ${abierto && e.donde ? `<button data-ayuda-ir='${esc(JSON.stringify(e.donde))}'>Ir</button>` : ''}</div>`; }).join('')}</div>`).join('')}`;
}

function conceptos(g, A) {
  const l = A.conceptos.filter(c => !c.modo || !g || c.modo === g.modo);
  return `<h3>Conceptos</h3><div class="conceptos">${l.map(c => `<section class="card"><h4>${esc(c.titulo)}</h4><p>${md(c.texto)}</p></section>`).join('')}</div>`;
}

function glosarioSec(glosario, atajos) {
  return `<h3>Atajos de teclado</h3><div class="kv">${atajos.map(([k, d]) => `<span><kbd>${esc(k)}</kbd></span><b>${esc(d)}</b>`).join('')}</div>
    <h3>Glosario</h3><dl class="glosario">${Object.values(glosario ?? {}).map(x => `<dt>${esc(x.titulo)}</dt><dd>${esc(x.texto)}</dd>`).join('')}</dl>`;
}

export function renderAyuda(g, A, glosario, sec, atajos) {
  const s = SECCIONES.some(([id]) => id === sec) ? sec : 'como';
  const cuerpo = s === 'primer' ? primer(g, A) : s === 'progreso' ? progresoSec(g) : s === 'conceptos' ? conceptos(g, A) : s === 'glosario' ? glosarioSec(glosario, atajos) : como(g, A);
  return `<div class="modal" data-cerrar-ayuda><div class="card ayuda ayuda-centro" role="dialog" aria-modal="true" aria-label="Centro de ayuda">
    <div class="ayuda-head"><h2>Centro de ayuda</h2><button id="cerrar-ayuda" aria-label="Cerrar ayuda">✕</button></div>
    <div class="ayuda-cols"><nav class="ayuda-nav" aria-label="Secciones">${SECCIONES.map(([id, l]) => `<button data-ayuda-sec="${id}" class="${id === s ? 'on' : ''}" aria-current="${id === s}">${l}</button>`).join('')}</nav>
    <div class="ayuda-cuerpo">${cuerpo}</div></div></div></div>`;
}

// Cartel de la primera vez que se entra a una solapa
export function renderGuia(id, A) {
  const x = A.guias?.[id]; if (!x) return '';
  return `<aside class="guia-ctx" role="note"><div><b>${esc(x.titulo)}</b><p>${esc(x.texto)}</p></div><div class="btns"><button class="primary" data-guia-ok="${esc(id)}">Entendido</button><button data-ayuda-abrir="como">Más en la ayuda</button></div></aside>`;
}
