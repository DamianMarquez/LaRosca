// Movimiento suave: entradas que se animan UNA vez, números que cuentan y salidas diferidas. Sin dependencias.
// Regla: refreshAll() redibuja todo con innerHTML; por eso solo se anima lo que se ve por primera vez.
const vistos = new Set();
const KEY = 'larosca.anim';
export const reducido = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
export function animacionesOn() { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } }
export function setAnimaciones(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* sin almacenamiento */ } aplicarAnimaciones(); }
export function aplicarAnimaciones() { if (typeof document !== 'undefined') document.body.classList.toggle('sin-anim', !animacionesOn()); }
export const reiniciarMov = () => { vistos.clear(); valores.clear(); };

// ' entra' la primera vez que se ve este id (con retraso escalonado opcional); '' las siguientes
export function entrada(id, n = 0) {
  if (vistos.has(id)) return '';
  vistos.add(id); if (vistos.size > 600) vistos.delete(vistos.values().next().value);
  return ` entra" style="--d:${Math.min(n, 8) * 35}ms`;
}
// Variante para usar como clase suelta: devuelve ['entra', delayMs] o null
export function esNuevo(id) { if (vistos.has(id)) return false; vistos.add(id); return true; }

// Números: cuenta de 0.4 s hacia el valor nuevo solo si cambió (elementos con data-num="clave" y data-val="número")
const valores = new Map();
export function animarNumeros(raiz = document, ahora = (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null)) {
  const off = reducido() || !animacionesOn();
  raiz.querySelectorAll('[data-num]').forEach(el => {
    const k = el.dataset.num, v = Number(el.dataset.val), prev = valores.get(k);
    valores.set(k, v);
    if (off || prev === undefined || prev === v || !Number.isFinite(v) || !ahora) return;
    const fmt = el.dataset.fmt === 'money' ? n => '$' + Math.round(n).toLocaleString('es-AR') : n => Math.round(n).toLocaleString('es-AR');
    const t0 = performance.now(), dur = 420, txt = el.textContent;
    el.classList.add(v > prev ? 'sube' : 'baja');
    const paso = t => { const f = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - f, 3); el.textContent = fmt(prev + (v - prev) * e); if (f < 1) ahora(paso); else { el.textContent = txt; setTimeout(() => el.classList.remove('sube', 'baja'), 500); } };
    ahora(paso);
  });
}

// Quita un nodo con una animación de salida (con respaldo por si transitionend no llega)
export function salir(el, clase = 'cierra', ms = 200) {
  if (!el) return;
  if (reducido() || !animacionesOn()) { el.remove(); return; }
  el.classList.add(clase); setTimeout(() => el.remove(), ms);
}
