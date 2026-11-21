// Recorrido guiado de primer uso: pasos cortos sobre lo que hay que mirar. Se muestra una sola vez y se puede repetir desde la ayuda.
const KEY = 'larosca.onb.v2';

export const yaVisto = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const marcarVisto = () => { try { localStorage.setItem(KEY, '1'); } catch { /* sin almacenamiento */ } };

// pasos: [{ancla, titulo, texto}] · final: {titulo, texto} (se muestra al medio, sin ancla) · forzar: ignora que ya se haya visto
export function iniciarOnboarding({ pasos = [], final = null, forzar = false, root = document.getElementById('onboarding-root') } = {}) {
  if (!root || (!forzar && yaVisto()) || !pasos.length) return;
  const lista = [...pasos, ...(final ? [{ ...final, ancla: null }] : [])];
  let i = 0;
  const cerrar = () => { root.innerHTML = ''; marcarVisto(); document.removeEventListener('keydown', tecla); removeEventListener('resize', pintar); };
  const tecla = e => { if (e.key === 'Escape') cerrar(); else if (e.key === 'ArrowRight') siguiente(); else if (e.key === 'ArrowLeft') atras(); };
  const siguiente = () => { if (++i >= lista.length) cerrar(); else pintar(); };
  const atras = () => { if (i > 0) { i--; pintar(); } };
  function pintar() {
    const paso = lista[i], el = paso.ancla ? document.querySelector(paso.ancla) : null;
    const r = el?.getBoundingClientRect();
    const hay = r && r.width > 0;
    const caja = hay ? r : { left: innerWidth / 2 - 5, top: innerHeight / 2 - 5, width: 10, height: 10, bottom: innerHeight / 2 };
    const left = hay ? Math.min(Math.max(12, r.left), innerWidth - 330) : Math.max(12, innerWidth / 2 - 155);
    const top = hay ? Math.min(r.bottom + 14, innerHeight - 220) : Math.max(12, innerHeight / 2 - 90);
    root.innerHTML = `<div class="onb" role="dialog" aria-modal="true" aria-label="Recorrido guiado">${hay ? `<div class="onb-hole" style="left:${caja.left - 6}px;top:${caja.top - 6}px;width:${caja.width + 12}px;height:${caja.height + 12}px"></div>` : '<div class="onb-fondo"></div>'}
      <div class="onb-card" style="top:${top}px;left:${left}px"><small class="muted">Paso ${i + 1} de ${lista.length}</small><h3>${paso.titulo}</h3><p>${paso.texto}</p>
      <div class="btns"><button data-onb="omitir">Omitir</button>${i > 0 ? '<button data-onb="atras">Atrás</button>' : ''}<button class="primary" data-onb="sig">${i === lista.length - 1 ? 'Empezar' : 'Siguiente'}</button></div></div></div>`;
    root.querySelector('[data-onb="sig"]').onclick = siguiente;
    root.querySelector('[data-onb="omitir"]').onclick = cerrar;
    const b = root.querySelector('[data-onb="atras"]'); if (b) b.onclick = atras;
    root.querySelector('[data-onb="sig"]').focus();
  }
  document.addEventListener('keydown', tecla);
  addEventListener('resize', pintar);
  pintar();
}
