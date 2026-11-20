// Render del mapa SVG con zoom (rueda) y pan (arrastre). Sin lógica de juego.
const NS = 'http://www.w3.org/2000/svg';

export class GameMap {
  constructor(svg, data, { onSelect }) {
    this.svg = svg;
    this.base = data.viewBox.slice();
    this.vb = data.viewBox.slice();
    this.onSelect = onSelect;
    this.paths = new Map();
    this.selected = null;
    svg.replaceChildren();
    svg.setAttribute('viewBox', this.vb.join(' '));
    const g = document.createElementNS(NS, 'g');
    svg.appendChild(g);
    const zones = data.zonas ?? data.provincias;
    for (const z of zones) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', z.d);
      p.classList.add('zone');
      p.dataset.id = z.id;
      const t = document.createElementNS(NS, 'title');
      t.textContent = z.nombre;
      p.appendChild(t);
      g.appendChild(p);
      this.paths.set(z.id, p);
    }
    this.labels = [];
    if (data.zonas) for (const z of zones.filter(z => z.tipo !== 'fraccion')) { // etiquetas solo de barrios con nombre
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', z.cx); t.setAttribute('y', z.cy);
      t.classList.add('lbl');
      t.textContent = z.nombre;
      g.appendChild(t);
      this.labels.push({ el: t, w: this.paths.get(z.id).getBBox().width });
    }
    this.apply();
    this.bind();
  }

  setBusy(ids) {
    for (const [id, el] of this.paths) el.classList.toggle('busy', ids.has(id));
  }

  // Colorea cada zona según un valor 0..1 (control del jugador)
  paint(fn) {
    for (const [id, el] of this.paths) {
      const v = fn(id);
      el.style.setProperty('--control', v);
    }
  }

  select(id) {
    this.selected && this.paths.get(this.selected).classList.remove('sel');
    this.selected = id;
    id && this.paths.get(id).classList.add('sel');
  }

  bind() {
    const svg = this.svg;
    let drag = null;
    svg.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, y: e.clientY, moved: false, vb: this.vb.slice() };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      const r = svg.getBoundingClientRect(), s = drag.vb[2] / r.width;
      this.vb[0] = drag.vb[0] - dx * s;
      this.vb[1] = drag.vb[1] - dy * s;
      this.apply();
    });
    svg.addEventListener('pointerup', e => {
      if (drag && !drag.moved) {
        const z = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.zone');
        this.onSelect(z ? z.dataset.id : null);
      }
      drag = null;
    });
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      const w = Math.min(this.base[2], Math.max(this.base[2] / 12, this.vb[2] * f));
      const k = w / this.vb[2];
      const r = svg.getBoundingClientRect();
      const mx = this.vb[0] + ((e.clientX - r.left) / r.width) * this.vb[2];
      const my = this.vb[1] + ((e.clientY - r.top) / r.height) * this.vb[3];
      this.vb[0] = mx - (mx - this.vb[0]) * k;
      this.vb[1] = my - (my - this.vb[1]) * k;
      this.vb[2] *= k; this.vb[3] *= k;
      this.apply();
    }, { passive: false });
  }

  apply() {
    this.svg.setAttribute('viewBox', this.vb.map(v => v.toFixed(1)).join(' '));
    // Las etiquetas escalan con el zoom y solo se muestran si la zona ocupa suficiente pantalla
    const fs = (this.vb[2] / 75).toFixed(1) + 'px';
    for (const l of this.labels ?? []) {
      l.el.style.fontSize = fs;
      l.el.style.display = l.w / this.vb[2] > 0.035 ? '' : 'none';
    }
  }
}
