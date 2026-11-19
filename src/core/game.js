// Núcleo de juego: estado, misiones y simulación diaria. Sin DOM.
import { generateCity } from './city.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  // city: datos reales de OSM (data/ciudades/<id>.json) o null para usar barrios sintéticos
  constructor(cfg, provId, provName, city = null) {
    this.cfg = cfg;
    const cap = cfg.capitales[provId];
    this.prov = { id: provId, nombre: provName };
    this.city = city ?? generateCity(provId, cap.ciudad, cap.pop);
    this.zonas = Object.fromEntries(this.city.zonas.map(z => [z.id, { ...z, control: 0, trust: cfg.start.trust }]));
    this.player = { rank: 0, xp: 0, money: cfg.start.money };
    this.jobs = [];       // {mission, zone, start, end}
    this.log = [];        // {day, text, kind}
    this.day = 0;
    this.listeners = [];
    this.note('Fundaste el partido en ' + cap.ciudad + '. Empezás como afiliado, sin poder interno.', 'info');
  }

  get slots() { return this.cfg.personalSlots[this.player.rank]; }
  get freeSlots() { return this.slots - this.jobs.length; }
  get rankName() { return this.cfg.ranks[this.player.rank]; }
  get nextXp() { return this.cfg.promotionXp[this.player.rank + 1] ?? null; }
  get followers() { return Math.round(Object.values(this.zonas).reduce((s, z) => s + z.pop * z.control * 0.02, 0)); }

  note(text, kind = 'info') { this.log.unshift({ day: this.day, text, kind }); this.log.length = Math.min(this.log.length, 60); }
  emit(ev) { this.listeners.forEach(f => f(ev)); }

  mission(id) { return this.cfg.missions.find(m => m.id === id); }

  // Probabilidad de éxito (%) y factores visibles
  chance(m, z) {
    const factors = [['Dificultad base', m.base], ['Confianza local', Math.round((z.trust - 50) * 0.25)]];
    if (z.control > 0.5) factors.push(['Presencia previa', 4]);
    const c = clamp(factors.reduce((s, f) => s + f[1], 0), 5, 95);
    return { c, factors };
  }

  canStart(m, zoneId) {
    if (this.player.rank < m.minRank) return 'Requiere rango: ' + this.cfg.ranks[m.minRank];
    if (this.freeSlots <= 0) return 'No tenés bloques libres';
    if (this.player.money < m.costo) return 'Falta dinero';
    if (this.jobs.some(j => j.zone === zoneId && j.mission === m.id)) return 'Ya en curso aquí';
    return null;
  }

  start(missionId, zoneId) {
    const m = this.mission(missionId);
    if (this.canStart(m, zoneId)) return false;
    this.player.money -= m.costo;
    this.jobs.push({ mission: missionId, zone: zoneId, start: this.day, end: this.day + m.dias });
    this.note(`Empezaste «${m.nombre}» en ${this.zonas[zoneId].nombre}.`);
    return true;
  }

  // Avanza un día simulado
  advanceDay() {
    this.day++;
    for (const j of this.jobs.filter(j => j.end <= this.day)) this.resolve(j);
    this.jobs = this.jobs.filter(j => j.end > this.day);
    // Con el tiempo, la confianza se enfría lentamente hacia 20 si no hay actividad
    for (const z of Object.values(this.zonas)) z.trust += (20 - z.trust) * 0.002;
  }

  resolve(j) {
    const m = this.mission(j.mission), z = this.zonas[j.zone];
    const ok = Math.random() * 100 < this.chance(m, z).c;
    if (ok) {
      z.control = clamp(z.control + m.gana.control, 0, 1);
      z.trust = clamp(z.trust + m.gana.trust, 0, 100);
      this.player.xp += m.gana.xp;
      this.note(`«${m.nombre}» salió bien en ${z.nombre}.`, 'ok');
    } else {
      z.trust = clamp(z.trust + m.falla.trust, 0, 100);
      this.note(`«${m.nombre}» falló en ${z.nombre}: se perdieron recursos y confianza.`, 'bad');
    }
    this.checkPromotion();
  }

  checkPromotion() {
    const p = this.player;
    while (p.rank < this.cfg.ranks.length - 1 && p.xp >= this.cfg.promotionXp[p.rank + 1]) {
      p.rank++;
      this.note(`¡Ascendiste a ${this.rankName}!`, 'promo');
      this.emit('promotion');
    }
  }

  toJSON() { return { schemaVersion: 2, prov: this.prov, zonas: this.zonas, player: this.player, jobs: this.jobs, log: this.log, day: this.day }; }
}
