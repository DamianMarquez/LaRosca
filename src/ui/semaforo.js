// Semáforos: un valor numérico → color + una palabra. En Casual se ve la palabra; el número queda para Experto.
// Los umbrales viven acá, en un solo lugar: [límite superior de «bien», límite superior de «atención»].
const U = {
  exito: { sube: true, cortes: [55, 75], pal: ['Arriesgado', 'Probable', 'Seguro'] },
  exposicion: { sube: false, cortes: [30, 60], pal: ['Baja', 'Media', 'Alta'] },
  desgaste: { sube: false, cortes: [40, 70], pal: ['Descansado', 'Cansado', 'Agotado'] },
  confianza: { sube: true, cortes: [30, 60], pal: ['Floja', 'Media', 'Buena'] },
  relacion: { sube: true, cortes: [30, 60], pal: ['Mala', 'Neutral', 'Buena'] },
};
export const CLASES = ['mal', 'med', 'bien'];
// Devuelve { cls: 'bien|med|mal', palabra }
export function semaforo(tipo, valor) {
  const u = U[tipo]; if (!u) return { cls: 'med', palabra: '' };
  const n = valor < u.cortes[0] ? 0 : valor < u.cortes[1] ? 1 : 2;      // 0 = bajo, 2 = alto
  const i = u.sube ? n : 2 - n;                                         // índice de clase: 0 mal … 2 bien
  return { cls: CLASES[i], palabra: u.pal[n] };
}
export const semaforoHtml = (tipo, valor, numero = '') => { const s = semaforo(tipo, valor); return `<span class="sem ${s.cls}"><i></i>${s.palabra}</span>${numero ? ` <small class="detalle">${numero}</small>` : ''}`; };
