// Primer uso: cuatro pasos breves sobre lo que hay que mirar. Se muestra una sola vez y se puede omitir.
const KEY = 'larosca.onb';
const PASOS = [
  { ancla: '.mapa-wrap', titulo: 'El mapa', texto: 'Esta es tu ciudad, dividida en barrios. Tocá uno para ver sus datos y lanzar misiones. Los círculos de color son rivales actuando.' },
  { ancla: '.panel', titulo: 'El panel', texto: 'Acá decidís. En «Misiones» empezá por la que dice ★ Recomendada. Con «…» ves más opciones y con el modo Detallado, todos los números.' },
  { ancla: '.ahora-box, .tabs', titulo: 'Ahora', texto: 'Esta franja te avisa lo más importante en cada momento: una vacante, un ascenso listo, un golpe rival. Tocala para ir directo.' },
  { ancla: '.clock', titulo: 'El tiempo', texto: 'Las misiones avanzan con el tiempo. Ponelo a correr con ▶ o con la barra espaciadora, y pausalo cuando quieras pensar.' },
];

export const yaVisto = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const marcarVisto = () => { try { localStorage.setItem(KEY, '1'); } catch { /* sin almacenamiento */ } };

export function iniciarOnboarding(root = document.getElementById('onboarding-root')) {
  if (!root || yaVisto()) return;
  let i = 0;
  const cerrar = () => { root.innerHTML = ''; marcarVisto(); document.removeEventListener('keydown', tecla); removeEventListener('resize', pintar); };
  const tecla = e => { if (e.key === 'Escape') cerrar(); };
  function pintar() {
    const paso = PASOS[i], el = document.querySelector(paso.ancla);
    const r = el?.getBoundingClientRect() ?? { left: 80, top: 80, width: 200, height: 100, bottom: 180 };
    const card = root.querySelector('.onb-card');
    root.innerHTML = `<div class="onb" role="dialog" aria-modal="true" aria-label="Guía de primer uso"><div class="onb-hole" style="left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px"></div>
      <div class="onb-card" style="top:${Math.min(r.bottom + 14, innerHeight - 190)}px;left:${Math.min(Math.max(12, r.left), innerWidth - 330)}px"><small class="muted">Paso ${i + 1} de ${PASOS.length}</small><h3>${paso.titulo}</h3><p>${paso.texto}</p>
      <div class="btns"><button data-onb="omitir">Omitir</button><button class="primary" data-onb="sig">${i === PASOS.length - 1 ? 'Empezar' : 'Siguiente'}</button></div></div></div>`;
    root.querySelector('[data-onb="sig"]').onclick = () => { if (++i >= PASOS.length) cerrar(); else pintar(); };
    root.querySelector('[data-onb="omitir"]').onclick = cerrar;
    root.querySelector('[data-onb="sig"]').focus();
  }
  document.addEventListener('keydown', tecla);
  addEventListener('resize', pintar);
  pintar();
}
