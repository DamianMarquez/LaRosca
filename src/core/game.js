// Núcleo de juego: estado, misiones y simulación diaria. Sin DOM.
import { generateCity } from './city.js';
import { perfil, intencionVoto } from './electoral.js';
import { sortear, resolver } from './events.js';
import { tick as tickRivales, efectosActivos, nuevosBots, choques, sanearBots, sanearHistorial, sanearPres, rivales, presencia } from './rivals.js';
import * as linea from './linea.js';
import * as eco from './economia.js';
import * as plantel from './plantel.js';
import * as escalafon from './escalafon.js';
import * as pactos from './pactos.js';
import * as personaje from './personaje.js';
import { SCHEMA } from './save.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  // city: datos reales (data/ciudades/<id>.json) o null para barrios sintéticos
  // partido: { nombre, principios: [ids] } fundado por el jugador
  constructor(cfg, provId, provName, city = null, partido = null) {
    this.cfg = cfg;
    const cap = cfg.capitales[provId];
    this.prov = { id: provId, nombre: provName };
    this.partido = { nombre: partido?.nombre ?? 'Tu partido', principios: partido?.principios ?? [],
      trasfondo: eco.trasfondoDe(cfg, partido?.trasfondo) ? partido.trasfondo : eco.trasfondoPorDefecto(cfg) };
    this.city = city ?? generateCity(provId, cap.ciudad, cap.pop);
    this.zonas = Object.fromEntries(this.city.zonas.map(z => [z.id, { ...z, control: 0, trust: cfg.start.trust, efectos: [] }]));
    this.jugador = personaje.iniciar(this, partido);   // habilidades, familia, trabajo y desgaste del personaje
    this.player = { rank: 0, xp: 0, money: this.trasfondo?.dineroInicial ?? cfg.start.money, black: cfg.start.black ?? 0 };
    this.economia = eco.estadoInicial();   // historial de cierres mensuales y números rojos
    this.favores = [];                     // deudas con quienes te dieron plata sin recibo
    this.exposure = 0;    // 0..100: riesgo de escándalo por uso de dinero opaco
    this.pending = null;  // evento esperando decisión del jugador
    this.ultimoEvento = 0;
    this.bots = nuevosBots(this);      // acción actual de cada rival (una a la vez)
    this.historialRivales = [];        // acciones rivales ya hechas, para el feed y los choques
    this.linea = linea.iniciar(this);  // líder superior y directivas
    this.plantel = plantel.iniciar(this);                          // cuadros con nombre, cargos y vacantes
    this.rivalesPlantel = plantel.iniciarRivales(this, rivales(this)); // líder y cuadros de cada rival
    this.alianzas = pactos.iniciar(this);                          // relación con cada rival y pactos vigentes
    this.jobs = [];       // {mission, zone, start, end, pago, modo}
    this.log = [];        // {day, text, kind}
    this.day = 0;
    this.listeners = [];
    this.note(`Fundaste «${this.partido.nombre}» en ${cap.ciudad}. Empezás como afiliado, sin poder interno.`, 'info');
  }

  // Datos reales de la provincia (INDEC 2022 / padrón 2025), si están cargados
  get provData() { return this.cfg.datos?.provincias?.[this.prov.id] ?? null; }
  // Electores estimados de una zona: población × proporción de electores de la provincia
  electores(z) { const d = this.provData; return d ? Math.round(z.pop * d.electoresPorHabitante) : null; }

  // Panorama electoral histórico de la provincia (partidos ficticios)
  get perfilElectoral() { return perfil(this.cfg.historicos, this.cfg.partidos?.partidos ?? [], this.prov.id); }
  // Intención de voto del partido del jugador en la ciudad (0..1)
  get intencionVoto() {
    const d = this.provData;
    return intencionVoto(Object.values(this.zonas), d ? d.electoresPorHabitante : 0.75);
  }

  // Capacidad de acción: el jugador es una sola persona (1 acción personal a la vez).
  // Al subir de rango se suma "equipo" para delegar, que es un contador aparte.
  get slots() { return this.cfg.personalSlots[this.player.rank]; }
  get equipo() { return this.cfg.equipoSlots[this.player.rank] + personaje.equipoExtra(this); }
  usados(modo) { return this.jobs.filter(j => (j.modo ?? 'personal') === modo).length; }
  get freeSlots() { return this.slots - this.usados('personal') - (this.jugador.descanso ? 1 : 0); }   // descansar también ocupa tu acción
  get freeEquipo() { return this.equipo - this.usados('delegada'); }
  get rankName() { return this.cfg.ranks[this.player.rank]; }
  get nextXp() { return this.cfg.promotionXp[this.player.rank + 1] ?? null; }
  // Escala de la ciudad: los umbrales de afiliados se achican en ciudades chicas (Rawson no es Córdoba)
  get escala() {
    this._escala ??= clamp(Math.pow(Object.values(this.zonas).reduce((s, z) => s + z.pop, 0) / 1.2e6, 0.65), 0.12, 1.5);
    return this._escala;
  }
  umbral(n) { return Math.max(2, Math.round(n * this.escala)); }
  get trasfondo() { return eco.trasfondoDe(this.cfg, this.partido.trasfondo); }
  // Afiliados formales: una parte de los seguidores se afilia (pagan cuota y cuentan para el escalafón)
  get afiliados() { return Math.round(this.followers * this.cfg.economia.tasaAfiliacion * (1 + this.cfg.plantel.bonos.interna * plantel.bono(this, 'interna')) * personaje.afiliacionMult(this)); }
  get etapa() { return plantel.etapa(this); }
  // Experiencia ganada en una misión: el cargo de Formación la potencia
  ganarXp(n) { this.player.xp += Math.round((n ?? 0) * (1 + this.cfg.plantel.bonos.formacion * plantel.bono(this, 'formacion'))); }
  // Escalafón: checklist para el próximo rango, pedir el ascenso, designar vacantes y captar cuadros rivales
  get requisitos() { return escalafon.requisitos(this); }
  ascender() { return escalafon.ascender(this); }
  get carga() { return plantel.carga(this); }
  delegar(cargo) { return plantel.delegar(this, cargo); }
  retomar(cargo) { return plantel.retomar(this, cargo); }
  designar(vid, cid) { return plantel.designar(this, vid, cid); }
  captarCuadro(rivalId, mid, con) { return plantel.captarCuadro(this, rivalId, mid, con); }
  // Pactos: oferta (costo y probabilidad) y propuesta a un rival
  ofertaPacto(rid, tipo) { return pactos.oferta(this, rid, tipo); }
  proponerPacto(rid, tipo, opts) { return pactos.proponer(this, rid, tipo, opts); }
  // Duración efectiva de una misión: el trasfondo da más o menos tiempo libre
  dias(m) { return Math.max(1, Math.round(m.dias * personaje.tiempoMult(this, m))); }
  // Proyección del mes (ingresos − gastos) y dinero esperado de una recaudación
  get flujo() { return eco.proyeccion(this); }
  ingresoEsperado(m, z) { return eco.ingresoMision(this, m, z); }
  pagarFavor(id, con) { return eco.pagarFavor(this, id, con); }
  get followers() { return Math.round(Object.values(this.zonas).reduce((s, z) => s + z.pop * z.control * 0.02, 0)); }

  note(text, kind = 'info') { this.log.unshift({ day: this.day, text, kind }); this.log.length = Math.min(this.log.length, 60); }
  emit(ev) { this.listeners.forEach(f => f(ev)); }

  mission(id) { return this.cfg.missions.find(m => m.id === id); }

  // Principios fundacionales del partido (catálogo en data/principios.json)
  get principios() {
    const cat = this.cfg.principios?.principios ?? [];
    return this.partido.principios.map(id => cat.find(p => p.id === id)).filter(Boolean);
  }
  // Modificadores acumulados de los principios para una misión
  modsPrincipios(m) {
    let chance = 0, expoMult = 1, negroConfianzaMult = 1, alcanceMult = 1;
    const nombres = [];
    for (const p of this.principios) {
      const x = p.mods ?? {};
      const c = x.chance?.[m.id] ?? 0;
      if (c) { chance += c; nombres.push(p.nombre); }
      expoMult *= x.expoMult ?? 1; negroConfianzaMult *= x.negroConfianzaMult ?? 1; alcanceMult *= x.alcanceMult ?? 1;
    }
    // las habilidades del jugador (Oratoria 5, Finanzas 5) se suman a lo que dan los principios
    return { chance, expoMult: expoMult * personaje.expoIlegalMult(this), negroConfianzaMult, alcanceMult: alcanceMult * personaje.alcanceMult(this, m), nombres };
  }

  // Efecto de la densidad (hab/km²) de la zona sobre una misión.
  // mult: multiplicador de alcance; riesgo: puntos de probabilidad (+ si la densidad favorece a esta misión)
  densidadEfecto(m, z) {
    const D = this.cfg.densidad, d = z.densidad ?? D.ref;           // zona sin dato: neutral
    const ratio = Math.max(d, 50) / D.ref;
    const mult = clamp(Math.pow(ratio, m.densExp ?? 0), D.minMult, D.maxMult);
    const riesgo = Math.round(clamp(Math.log10(ratio) * 6, -D.maxBonusRiesgo, D.maxBonusRiesgo) * (m.densPref ?? 0));
    return { densidad: Math.round(d), mult, riesgo };
  }

  // Personas alcanzadas por la misión y cuánto sube el control del barrio (0..1)
  alcance(m, z) {
    if (!m.alcance) return { personas: 0, control: 0 };   // recaudación: no mueve control
    const personas = Math.round(m.alcance * this.densidadEfecto(m, z).mult * this.modsPrincipios(m).alcanceMult * (1 + this.cfg.plantel.bonos.territorial * plantel.bono(this, 'territorial')));
    const control = Math.min(this.cfg.densidad.maxControlPorMision, personas / Math.max(z.pop, 100));
    return { personas, control };
  }

  // Probabilidad de éxito (%) y factores visibles
  // pago: 'blanco' o 'negro' (más eficaz, sube la exposición) · modo: 'personal' o 'delegada' (equipo, menos eficaz)
  // ventana: [desde, hasta] de la misión (por defecto, si la lanzaras hoy) para detectar choques con los rivales
  chance(m, z, pago = 'blanco', modo = 'personal', ventana = null) {
    const de = this.densidadEfecto(m, z);
    const factors = [['Dificultad base', m.base], ['Confianza local', Math.round((z.trust - 50) * 0.25)]];
    if (de.riesgo) factors.push([`Densidad (${de.densidad.toLocaleString('es-AR')} hab/km²)`, de.riesgo]);
    if (z.control > 0.5) factors.push(['Presencia previa', 4]);
    if (pago === 'negro' && m.negro) factors.push(['Dinero negro', m.negro.bonus]);
    if (modo === 'delegada') factors.push(['Equipo con menos experiencia', -this.cfg.delegacion.penal]);
    const pr = this.modsPrincipios(m);
    if (pr.chance) factors.push([`Principios (${pr.nombres.join(', ')})`, pr.chance]);
    if (['volantes', 'pintadas'].includes(m.id)) { const t = plantel.aporte(this, 'comunicacion'); if (t.cap) factors.push([`Comunicación (${t.quien})`, Math.round(this.cfg.plantel.bonos.comunicacion * t.cap / 100)]); }
    if (m.id === 'reunion') { const t = plantel.aporte(this, 'campana'); if (t.cap) factors.push([`Campaña y alianzas (${t.quien})`, Math.round(this.cfg.plantel.bonos.campana * t.cap / 100)]); }
    const ref = plantel.referenteDe(this, z.id);
    if (ref && m.categoria !== 'finanzas') factors.push([`Referente del barrio (${ref.nombre})`, Math.round(this.cfg.plantel.referente.chancePorCap * ref.capacidad / 100)]);
    for (const a of pactos.apoyosZona(this, z.id, rid => presencia(this, z.id)[rid])) factors.push([`Apoyo de ${this.rival(a.rival).nombre} (pacto)`, a.puntos]);
    factors.push(...personaje.factores(this, m, modo));
    const tc = this.trasfondo?.chance?.[m.id];
    if (tc) factors.push([`Trasfondo (${this.trasfondo.nombre})`, tc]);
    const [desde, hasta] = ventana ?? [this.day, this.day + this.dias(m)];
    for (const c of choques(this, m, z.id, desde, hasta)) {
      factors.push([`Choque con ${this.rival(c.rival).nombre}: ${c.accion.nombre.toLowerCase()}${c.enCurso ? '' : ` (en ${c.enDias} d)`}`, c.chance]);
    }
    const fl = linea.factorLider(this);
    if (fl) factors.push(fl);
    const c = clamp(Math.round(factors.reduce((s, f) => s + f[1], 0)), 5, 95);
    return { c, factors };
  }

  rival(id) { return this.cfg.partidos.partidos.find(p => p.id === id); }

  // Acción rival que impide lanzar la misión en la zona (o null)
  bloqueo(m, zoneId) {
    for (const e of efectosActivos(this, zoneId)) {
      const a = this.cfg.rivales.acciones.find(x => x.id === e.accion);
      if (a?.bloquea?.includes(m.id)) return { texto: `${this.rival(e.rival).nombre}: ${a.nombre.toLowerCase()}`, dias: e.hasta - this.day };
    }
    return null;
  }

  canStart(m, zoneId, pago = 'blanco', modo = 'personal') {
    if (this.pending) return 'Resolvé el evento pendiente';
    if (modo !== 'delegada' && this.jugador.descanso) return 'Estás descansando';
    if (this.player.rank < m.minRank) return 'Requiere rango: ' + this.cfg.ranks[m.minRank];
    if (modo === 'delegada') {
      if (!m.delegable) return 'No se puede delegar';
      if (this.equipo === 0) return 'Requiere rango: ' + this.cfg.ranks[this.cfg.delegacion.rangoMin];
      if (this.freeEquipo <= 0) return 'Tu equipo está ocupado';
    } else if (this.freeSlots <= 0) return 'Ya estás en una acción';
    const b = this.bloqueo(m, zoneId);
    if (b) return `Bloqueada (${b.dias} d)`;
    if (pago === 'negro') {
      if (!m.negro) return 'No admite dinero negro';
      if (this.player.black < m.costo) return 'Falta dinero negro';
    } else if (m.costo > 0 && this.player.money < 0) return 'Números rojos';
    else if (m.costo > 0 && this.player.money < m.costo) return 'Falta dinero';
    if (this.jobs.some(j => j.zone === zoneId && j.mission === m.id)) return 'Ya en curso aquí';
    return null;
  }

  start(missionId, zoneId, pago = 'blanco', modo = 'personal') {
    const m = this.mission(missionId);
    if (this.canStart(m, zoneId, pago, modo)) return false;
    if (pago === 'negro') {
      this.player.black -= m.costo;
      this.exposure = clamp(this.exposure + Math.round(m.negro.expo * this.modsPrincipios(m).expoMult), 0, 100);
      linea.alUsarNegro(this);
    } else this.player.money -= m.costo;
    this.jobs.push({ mission: missionId, zone: zoneId, start: this.day, end: this.day + this.dias(m), pago, modo });
    this.note(`${modo === 'delegada' ? 'Delegaste' : 'Empezaste'} «${m.nombre}» en ${this.zonas[zoneId].nombre}${pago === 'negro' ? ' con dinero negro' : ''}.`);
    return true;
  }

  // Avanza un día simulado
  advanceDay() {
    this.day++;
    this._ocupadoHoy = this.jobs.some(j => (j.modo ?? 'personal') === 'personal');   // el día cuenta como trabajado si empezó con una acción en curso
    for (const j of this.jobs.filter(j => j.end <= this.day)) this.resolve(j);
    this.jobs = this.jobs.filter(j => j.end > this.day);
    // Con el tiempo, la confianza se enfría lentamente hacia 20 si no hay actividad
    for (const z of Object.values(this.zonas)) z.trust += (20 - z.trust) * 0.002;
    this.exposure = Math.max(0, this.exposure - 0.15);        // el olvido enfría los rumores
    tickRivales(this);
    linea.tick(this);
    eco.tick(this);
    plantel.tick(this);
    escalafon.tick(this);
    pactos.tick(this);
    personaje.tick(this);
    const ev = sortear(this);
    if (ev) {
      this.pending = ev;
      this.ultimoEvento = this.day;
      this.note(`Evento: ${ev.titulo}.`, ev.tipo === 'escandalo' ? 'bad' : 'info');
      this.emit('event');
    }
  }

  // Aceptar o rechazar la directiva que baja el partido / tu líder
  responderDirectiva(aceptar) { return linea.responder(this, aceptar); }

  // El personaje: gastar un punto de habilidad, cambiar de trabajo y descansar
  invertirHabilidad(id) { return personaje.invertir(this, id); }
  cambiarTrabajo(estado) { return personaje.cambiarTrabajo(this, estado); }
  descansar() { return personaje.descansar(this); }

  // El jugador elige una opción del evento pendiente
  choose(idx) {
    const ev = this.pending;
    if (!ev) return null;
    const r = resolver(this, ev, idx);
    if (!r) return null;
    this.pending = null;
    this.ultimoEvento = this.day;
    this.note(r.texto, r.ok ? 'ok' : 'bad');
    this.checkPromotion();
    return r;
  }

  // Informe transitorio (no se guarda): lo que pasó al terminar una acción, para mostrarlo al jugador
  informar(inf) { (this.informes ??= []).push({ dia: this.day, ...inf }); if (this.informes.length > 8) this.informes.shift(); }

  resolve(j) {
    const m = this.mission(j.mission), z = this.zonas[j.zone];
    const a = { Control: z.control * 100, Confianza: z.trust, Dinero: this.player.money, Negro: this.player.black, Exposición: this.exposure, XP: this.player.xp };
    const tope = this.log[0];
    this._resolver(j);
    const nuevas = []; for (const e of this.log) { if (e === tope) break; nuevas.push(e); }
    const d = { Control: z.control * 100, Confianza: z.trust, Dinero: this.player.money, Negro: this.player.black, Exposición: this.exposure, XP: this.player.xp };
    const cambios = Object.keys(a).map(k => ({ k, d: d[k] - a[k] })).filter(c => Math.abs(c.d) >= (c.k === 'Dinero' || c.k === 'Negro' ? 1 : 0.5));
    this.informar({ tipo: 'mision', nombre: m.nombre, zona: j.zone, zonaNombre: z.nombre, ok: this._ok !== false, modo: j.modo ?? 'personal', texto: nuevas.length ? nuevas[nuevas.length - 1].text : '', cambios });
  }

  _resolver(j) {
    const m = this.mission(j.mission), z = this.zonas[j.zone], pr = this.modsPrincipios(m);
    const ok = Math.random() * 100 < this.chance(m, z, j.pago, j.modo ?? 'personal', [j.start, j.end]).c;
    this._ok = ok;
    linea.alResolver(this, j, ok);
    personaje.alResolver(this, m, ok);
    if (m.categoria === 'finanzas') { this.resolverFinanzas(m, z, pr, ok); this.checkPromotion(); return; }
    if (ok) {
      const al = this.alcance(m, z);
      z.control = clamp(z.control + al.control, 0, 1);
      z.trust = clamp(z.trust + m.gana.trust * (j.pago === 'negro' ? pr.negroConfianzaMult : 1) * personaje.confianzaMult(this, m), 0, 100);
      this.ganarXp(m.gana.xp);
      this.note(`«${m.nombre}» salió bien en ${z.nombre}: llegaste a unas ${al.personas.toLocaleString('es-AR')} personas.`, 'ok');
    } else {
      z.trust = clamp(z.trust + m.falla.trust, 0, 100);
      if (j.pago === 'negro') this.exposure = clamp(this.exposure + Math.round(m.negro.expo * pr.expoMult), 0, 100); // si sale mal con plata opaca, se nota más
      this.note(`«${m.nombre}» falló en ${z.nombre}: se perdieron recursos y confianza${j.pago === 'negro' ? ' y creció la sospecha' : ''}.`, 'bad');
    }
    this.checkPromotion();
  }

  // Recaudación: legal (plata blanca) o ilegal (plata negra con exposición y deuda de favor)
  resolverFinanzas(m, z, pr, ok) {
    const f = n => '$' + Math.round(n).toLocaleString('es-AR');
    if (ok) {
      const monto = this.ingresoEsperado(m, z);
      z.trust = clamp(z.trust + (m.gana.trust ?? 0), 0, 100);
      this.ganarXp(m.gana.xp ?? 0);
      if (m.ilegal) {
        this.player.black += monto;
        this.exposure = clamp(this.exposure + Math.round(m.expo * pr.expoMult), 0, 100);
        const fav = eco.registrarFavor(this, monto);
        this.note(`«${m.nombre}» en ${z.nombre}: conseguiste ${f(monto)} en negro. Quedaste en deuda con ${fav.nombre} (${f(fav.valor)}).`, 'info');
      } else {
        this.player.money += monto;
        this.note(`«${m.nombre}» en ${z.nombre}: recaudaste ${f(monto)}.`, 'ok');
      }
    } else {
      z.trust = clamp(z.trust + m.falla.trust, 0, 100);
      if (m.ilegal) {
        this.exposure = clamp(this.exposure + Math.round(m.expo * 1.5 * pr.expoMult), 0, 100);
        this.note(`«${m.nombre}» salió mal en ${z.nombre}: no cobraste y creció la sospecha.`, 'bad');
        if (m.id === 'desvio' && !this.pending) {
          const esc = this.cfg.eventos?.eventos.find(e => e.tipo === 'escandalo');
          if (esc) { this.pending = esc; this.ultimoEvento = this.day; this.emit('event'); }
        }
      } else this.note(`«${m.nombre}» en ${z.nombre}: casi no se juntó nada.`, 'bad');
    }
  }

  // El ascenso ya no es automático: se pide desde Partido cuando se cumplen todos los requisitos.
  // Acá solo se avisa una vez cuando el jugador queda en condiciones.
  checkPromotion() { escalafon.revisarAviso(this); }

  // Estado serializable. Las zonas guardan solo lo que cambia: el resto sale de data/ciudades.
  toJSON() {
    return {
      schemaVersion: SCHEMA, prov: this.prov, partido: this.partido, day: this.day, exposure: this.exposure, ultimoEvento: this.ultimoEvento,
      player: this.player, jobs: this.jobs, log: this.log, pending: this.pending?.id ?? null,
      bots: this.bots, historialRivales: this.historialRivales, linea: this.linea, economia: this.economia, favores: this.favores, jugador: this.jugador, plantel: this.plantel, rivalesPlantel: this.rivalesPlantel, alianzas: this.alianzas,
      zonas: Object.fromEntries(Object.entries(this.zonas).map(([id, z]) => [id, { control: +z.control.toFixed(5), trust: +z.trust.toFixed(3), efectos: z.efectos, rivalPres: z.rivalPres }])),
    };
  }

  // Reconstruye una partida validada (ver save.js). city: mismos datos de ciudad que la partida original.
  static fromJSON(cfg, d, city = null) {
    const g = new Game(cfg, d.prov.id, d.prov.nombre, city, d.partido);
    for (const [id, z] of Object.entries(d.zonas)) {
      if (!g.zonas[id]) continue;
      g.zonas[id].control = clamp(z.control, 0, 1);
      g.zonas[id].trust = clamp(z.trust, 0, 100);
      g.zonas[id].efectos = (z.efectos ?? []).filter(e => cfg.rivales.acciones.some(a => a.id === e.accion) && cfg.partidos.partidos.some(p => p.id === e.rival) && Number.isFinite(e.hasta))
        .map(e => ({ rival: e.rival, accion: e.accion, hasta: e.hasta }));
    }
    const p = d.player;
    g.player = { rank: clamp(Math.floor(p.rank), 0, cfg.ranks.length - 1), xp: Math.max(0, p.xp), money: clamp(p.money, -1e9, 1e12), black: Math.max(0, p.black) };
    g.day = Math.floor(d.day);
    g.exposure = clamp(d.exposure, 0, 100);
    g.ultimoEvento = isFinite(d.ultimoEvento) ? d.ultimoEvento : g.day;
    g.jobs = d.jobs.filter(j => g.zonas[j.zone]).map(j => ({ mission: j.mission, zone: j.zone, start: j.start, end: j.end, pago: j.pago === 'negro' ? 'negro' : 'blanco', modo: j.modo === 'delegada' ? 'delegada' : 'personal' }));
    g.log = d.log.slice(0, 60).map(e => ({ day: Number(e.day) || 0, text: String(e.text ?? ''), kind: ['ok', 'bad', 'promo', 'info', 'rival', 'linea'].includes(e.kind) ? e.kind : 'info' }));
    g.pending = d.pending ? (cfg.eventos?.eventos.find(e => e.id === d.pending) ?? null) : null;
    // Campos opcionales (las partidas anteriores no los traen: quedan con sus valores iniciales)
    for (const [id, z] of Object.entries(d.zonas)) if (g.zonas[id]) g.zonas[id].rivalPres = sanearPres(g, z.rivalPres);
    g.bots = sanearBots(g, d.bots);
    g.historialRivales = sanearHistorial(g, d.historialRivales);
    g.linea = linea.sanear(g, d.linea);
    g.economia = eco.sanear(g, d.economia);
    g.favores = eco.sanearFavores(g, d.favores);
    g.plantel = plantel.sanear(g, d.plantel);
    g.rivalesPlantel = plantel.sanearRivales(g, d.rivalesPlantel, rivales(g));
    g.alianzas = pactos.sanear(g, d.alianzas);
    g.jugador = personaje.sanear(g, d.jugador, d.partido);
    return g;
  }
}
