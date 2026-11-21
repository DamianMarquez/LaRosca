// Tooltips accesibles: aparecen con mouse, foco de teclado o toque; el contenido sale del glosario (data-tip="id")
// o de atributos directos (data-tip-texto / data-tip-titulo). Todo se inserta como texto, nunca como HTML.
const SEL = '[data-tip], [data-tip-texto]';   // con glosario (data-tip) o con texto directo (data-tip-texto)

export function initTooltips(glosario = {}) {
  const tip = document.createElement('div');
  tip.id = 'tooltip'; tip.className = 'tooltip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  tip.innerHTML = '<b class="tt-titulo"></b><span class="tt-texto"></span>';
  document.body.appendChild(tip);
  const tTitulo = tip.querySelector('.tt-titulo'), tTexto = tip.querySelector('.tt-texto');
  let actual = null;

  const contenido = el => {
    if (el.dataset.tipTexto) return { titulo: el.dataset.tipTitulo ?? '', texto: el.dataset.tipTexto };
    const g = glosario[el.dataset.tip];
    return g ? { titulo: g.titulo, texto: g.texto } : null;
  };
  const ocultar = () => { tip.hidden = true; actual?.removeAttribute('aria-describedby'); actual = null; };
  const mostrar = el => {
    const c = contenido(el); if (!c) return;
    actual = el; el.setAttribute('aria-describedby', 'tooltip');
    tTitulo.textContent = c.titulo; tTitulo.hidden = !c.titulo; tTexto.textContent = c.texto;
    tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, m = 8;
    let x = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), innerWidth - w - m);
    let y = r.bottom + 8; if (y + h > innerHeight - m) y = Math.max(m, r.top - h - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };

  document.addEventListener('mouseover', e => { const el = e.target.closest?.(SEL); if (el && el !== actual) mostrar(el); });
  document.addEventListener('mouseout', e => { const el = e.target.closest?.(SEL); if (el && !el.contains(e.relatedTarget)) ocultar(); });
  document.addEventListener('focusin', e => { const el = e.target.closest?.(SEL); if (el) mostrar(el); });
  document.addEventListener('focusout', e => { if (e.target.closest?.(SEL)) ocultar(); });
  document.addEventListener('click', e => {                         // en pantallas táctiles no hay hover: el toque alterna
    const el = e.target.closest?.(SEL);
    if (el && matchMedia('(hover: none)').matches) { actual === el ? ocultar() : mostrar(el); } else if (!el) ocultar();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ocultar(); });
  addEventListener('scroll', ocultar, true);
  // Si el elemento que mostraba el tooltip fue reemplazado por un refresco de la interfaz, se oculta
  return { ocultar, revisar: () => { if (actual && !actual.isConnected) ocultar(); } };
}
