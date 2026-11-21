// Modo de visualización: Rápido (lo esencial) o Detallado (todo). Es una preferencia del visor, no de la partida.
const KEY = 'larosca.modo';

export function getModo() {
  try { return localStorage.getItem(KEY) === 'detallado' ? 'detallado' : 'rapido'; } catch { return 'rapido'; }
}

export function aplicarModo(m = getModo()) {
  document.body.classList.toggle('modo-rapido', m === 'rapido');
  document.body.classList.toggle('modo-detallado', m === 'detallado');
  document.querySelectorAll('[data-modo-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modoBtn === m)));
}

export function setModo(m) {
  try { localStorage.setItem(KEY, m); } catch { /* sin almacenamiento: vale solo para esta sesión */ }
  aplicarModo(m);
  return m;
}

export const toggleModo = () => setModo(getModo() === 'rapido' ? 'detallado' : 'rapido');
