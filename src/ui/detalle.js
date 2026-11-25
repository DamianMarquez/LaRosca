// Patrón «resumen de una línea + Ver detalle»: Casual = plegado, Experto = abierto. Lo que el jugador abre o cierra se recuerda.
import { getModo } from './modo.js';
export const rdState = {};   // id -> true/false elegido por el jugador (vive mientras dura la sesión)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// resumen: texto corto (puede llevar HTML ya escapado); cuerpo: HTML del detalle
export function resumenDetalle(id, resumen, cuerpo, { clase = '' } = {}) {
  const abierto = id in rdState ? rdState[id] : getModo() === 'detallado';
  return `<details class="rd ${clase}" data-rd="${esc(id)}" ${abierto ? 'open' : ''}><summary><span class="rd-res">${resumen}</span><span class="rd-mas">Ver detalle</span></summary><div class="rd-cuerpo">${cuerpo}</div></details>`;
}
// Recordar lo que abre/cierra el jugador (el evento toggle no burbujea: se escucha en captura)
export function initDetalle() {
  document.addEventListener('toggle', e => { const d = e.target; if (d?.classList?.contains('rd')) rdState[d.dataset.rd] = d.open; }, true);
}
