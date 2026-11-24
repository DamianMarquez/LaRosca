// Render del mapa SVG con zoom (rueda) y pan (arrastre). Sin lógica de juego.
const NS = 'http://www.w3.org/2000/svg';

export class GameMap {
  constructor(svg, data, { onSelect, onHover = () => {} }) {
    this.svg = svg;
    this.base = data.viewBox.slice();
    this.vb = data.viewBox.slice();
    this.onSelect = onSelect;
    this.onHover = onHover;
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
    this.viajero = null;
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

  // Marcas de rivales: items [{key, cx, cy, i, color, planeada, hostil, inicial, titulo}]
  // Círculo del color del rival con su inicial; punteado si solo está planeando; borde blanco si es un golpe contra vos.
  setRivalMarks(items) {
    const u = this.vb[2] / 90, live = new Set(items.map(i => i.key));
    for (const [k, n] of this.marks) if (!live.has(k)) { n.g.remove(); this.marks.delete(k); }
    for (const it of items) {
      let n = this.marks.get(it.key);
      if (!n) {
        const g = document.createElementNS(NS, 'g'), c = document.createElementNS(NS, 'circle'), t = document.createElementNS(NS, 'text');
        g.setAttribute('class', 'rmark'); t.setAttribute('class', 'rmark-i'); t.setAttribute('text-anchor', 'middle');
        g.append(c, t); this.markLayer.appendChild(g);
        n = { g, c, t }; this.marks.set(it.key, n);
      }
      const x = it.cx - u * 1.7 + it.i * u * 3.6, y = it.cy - u * 4.2, r = u * 1.7;
      n.c.setAttribute('cx', x); n.c.setAttribute('cy', y); n.c.setAttribute('r', r);
      n.c.setAttribute('stroke-width', (u * (it.hostil ? 0.7 : 0.4)).toFixed(2));
      n.c.setAttribute('stroke', it.hostil ? '#fff' : it.color);
      n.c.setAttribute('fill', it.planeada ? 'rgba(10,12,16,.75)' : it.color);
      n.c.setAttribute('stroke-dasharray', it.planeada ? `${(u * 0.6).toFixed(2)} ${(u * 0.5).toFixed(2)}` : '');
      n.t.setAttribute('x', x); n.t.setAttribute('y', y + u * 0.75); n.t.style.fontSize = (u * 2.1).toFixed(2) + 'px';
      n.t.setAttribute('fill', it.planeada ? it.color : '#10131a');
      n.t.textContent = it.inicial ?? '';
    }
  }

  // El jugador sobre el mapa: tu casa, tu posición y, si viajás, la ruta con rastro, el destino y una etiqueta. pos = salida de movilidad.posicion; etiqueta = texto sobre el personaje
  setViajero(pos, etiqueta = '') {
    if (!pos) { this.viajero?.g.remove(); this.viajero = null; return; }
    const mk = (tag, cls) => { const e = document.createElementNS(NS, tag); e.setAttribute('class', cls); return e; };
    if (!this.viajero) {
      const g = mk('g', 'viajero'); g.setAttribute('pointer-events', 'none');
      const o = { g, ruta: mk('line', 'v-ruta'), rastro: mk('line', 'v-rastro'), destino: mk('circle', 'v-destino'), casaD: mk('circle', 'v-casa-disco'), casaI: mk('text', 'v-casa-ico'), casaT: mk('text', 'v-casa-txt'), halo: mk('circle', 'v-halo'), disco: mk('circle', 'v-disco'), ico: mk('text', 'v-ico'), eti: mk('text', 'v-eti') };
      for (const k of ['casaI', 'casaT', 'ico', 'eti']) o[k].setAttribute('text-anchor', 'middle');
      g.append(o.ruta, o.rastro, o.destino, o.casaD, o.casaI, o.casaT, o.halo, o.disco, o.ico, o.eti); this.markLayer.after(g); this.viajero = o;
    }
    const u = this.vb[2] / 90, v = this.viajero, y = pos.y - u * 1.2, f = n => (+n).toFixed(2);
    if (pos.casa) {                                                      // 🏠 casa: siempre visible
      v.casaD.setAttribute('cx', pos.casa.x); v.casaD.setAttribute('cy', pos.casa.y - u * 1.2); v.casaD.setAttribute('r', f(u * 2.1)); v.casaD.setAttribute('stroke-width', f(u * 0.35));
      v.casaI.setAttribute('x', pos.casa.x); v.casaI.setAttribute('y', f(pos.casa.y - u * 0.4)); v.casaI.style.fontSize = f(u * 2.4) + 'px'; v.casaI.textContent = '🏠';
      v.casaT.setAttribute('x', pos.casa.x); v.casaT.setAttribute('y', f(pos.casa.y + u * 3.4)); v.casaT.style.fontSize = f(u * 1.8) + 'px'; v.casaT.textContent = 'Casa';
    }
    const viaj = !!pos.viajando;
    for (const k of ['ruta', 'rastro', 'destino']) v[k].style.display = viaj ? '' : 'none';
    v.halo.style.display = viaj ? '' : 'none'; v.eti.style.display = viaj && etiqueta ? '' : 'none';
    v.g.classList.toggle('vuelta', viaj && pos.etapa === 'vuelta');
    if (viaj) {
      for (const [k, x1, y1, x2, y2] of [['ruta', pos.x0, pos.y0, pos.x1, pos.y1], ['rastro', pos.x0, pos.y0, pos.x, pos.y]]) { v[k].setAttribute('x1', f(x1)); v[k].setAttribute('y1', f(y1)); v[k].setAttribute('x2', f(x2)); v[k].setAttribute('y2', f(y2)); }
      v.ruta.setAttribute('stroke-width', f(u * 0.45)); v.ruta.setAttribute('stroke-dasharray', `${f(u * 1.2)} ${f(u * 1)}`); v.rastro.setAttribute('stroke-width', f(u * 0.9));
      v.destino.setAttribute('cx', pos.x1); v.destino.setAttribute('cy', pos.y1); v.destino.setAttribute('r', f(u * 3)); v.destino.setAttribute('stroke-width', f(u * 0.6));
      v.halo.setAttribute('cx', pos.x); v.halo.setAttribute('cy', y); v.halo.setAttribute('r', f(u * 4.6));
      v.eti.setAttribute('x', pos.x); v.eti.setAttribute('y', f(y - u * 5.4)); v.eti.style.fontSize = f(u * 2) + 'px'; v.eti.setAttribute('stroke-width', f(u * 0.5)); v.eti.textContent = etiqueta;
    }
    v.disco.setAttribute('cx', pos.x); v.disco.setAttribute('cy', y); v.disco.setAttribute('r', f(u * (viaj ? 3.2 : 2.4))); v.disco.setAttribute('stroke-width', f(u * 0.55));
    v.ico.setAttribute('x', pos.x); v.ico.setAttribute('y', f(y + u * (viaj ? 1.2 : 0.9))); v.ico.style.fontSize = f(u * (viaj ? 3.8 : 2.8)) + 'px'; v.ico.textContent = pos.icono;
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
      if (!drag) { const z = e.target.closest?.('.zone'); this.onHover(z ? z.dataset.id : null, e.clientX, e.clientY); return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      const r = svg.getBoundingClientRect(), s = drag.vb[2] / r.width;
      this.vb[0] = drag.vb[0] - dx * s;
      this.vb[1] = drag.vb[1] - dy * s;
      this.apply();
    });
    svg.addEventListener('pointerleave', () => this.onHover(null));
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
