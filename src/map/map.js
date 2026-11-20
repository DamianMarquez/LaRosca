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
    this.layer = document.createElementNS(NS, 'g');   // capa de progreso de misiones
    g.appendChild(this.layer);
    this.prog = new Map();
    this.markLayer = document.createElementNS(NS, 'g');   // marcas de acciones rivales
    g.appendChild(this.markLayer);
    this.marks = new Map();
    this.apply();
    this.bind();
  }

  // Muestra el avance de las misiones sobre su zona: items [{id, cx, cy, frac, text}]
  setProgress(items) {
    const u = this.vb[2] / 90, live = new Set(items.map(i => i.id));
    for (const [id, n] of this.prog) if (!live.has(id)) { n.g.remove(); this.prog.delete(id); }
    for (const it of items) {
      let n = this.prog.get(it.id);
      if (!n) {
        const mk = (tag, cls) => { const e = document.createElementNS(NS, tag); e.setAttribute('class', cls); return e; };
        n = { g: mk('g', 'prog'), bg: mk('rect', 'prog-bg'), fill: mk('rect', 'prog-fill'), txt: mk('text', 'prog-txt') };
        n.g.append(n.bg, n.fill, n.txt);
        this.layer.appendChild(n.g);
        this.prog.set(it.id, n);
      }
      const w = u * 17, h = u * 2.4, x = it.cx - w / 2, y = it.cy + u * 1.2;
      for (const [el, ww] of [[n.bg, w], [n.fill, w * it.frac]]) { el.setAttribute('x', x); el.setAttribute('y', y); el.setAttribute('width', ww); el.setAttribute('height', h); el.setAttribute('rx', h / 2); }
      n.txt.setAttribute('x', it.cx); n.txt.setAttribute('y', it.cy - u * 0.4);
      n.txt.style.fontSize = (u * 2.6).toFixed(2) + 'px'; n.txt.style.strokeWidth = (u * 0.7).toFixed(2) + 'px';
      n.txt.textContent = it.text;
    }
  }

  // Marcas de rivales: items [{key, cx, cy, i, color, planeada, hostil, titulo}]
  setRivalMarks(items) {
    const u = this.vb[2] / 90, live = new Set(items.map(i => i.key));
    for (const [k, n] of this.marks) if (!live.has(k)) { n.remove(); this.marks.delete(k); }
    for (const it of items) {
      let c = this.marks.get(it.key);
      if (!c) {
        c = document.createElementNS(NS, 'circle'); c.setAttribute('class', 'rmark');
        const t = document.createElementNS(NS, 'title'); c.appendChild(t);
        this.markLayer.appendChild(c); this.marks.set(it.key, c);
      }
      c.setAttribute('cx', it.cx - u * 1.7 + it.i * u * 3.6); c.setAttribute('cy', it.cy - u * 4.2); c.setAttribute('r', u * 1.5);
      c.setAttribute('stroke-width', (u * (it.hostil ? 0.7 : 0.4)).toFixed(2));
      c.setAttribute('stroke', it.hostil ? '#fff' : it.color);
      c.setAttribute('fill', it.planeada ? 'rgba(10,12,16,.7)' : it.color);
      c.setAttribute('stroke-dasharray', it.planeada ? `${(u * 0.6).toFixed(2)} ${(u * 0.5).toFixed(2)}` : '');
      c.firstChild.textContent = it.titulo;
    }
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
