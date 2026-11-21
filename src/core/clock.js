// Reloj de simulación: tiempo real -> días simulados. Sin DOM.
export const SECONDS_PER_DAY = 2; // a velocidad x1
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export class Clock {
  constructor(startDay = 0) {
    this.day = startDay;      // días simulados enteros transcurridos
    this.acc = 0;             // fracción acumulada de día
    this.speed = 0;           // 0 = pausa
    this.onDay = () => {};    // callback por cada día cumplido
  }
  setSpeed(s) { this.speed = s; }
  // dt en segundos reales
  tick(dt) {
    if (!this.speed) return;
    this.acc += (dt * this.speed) / SECONDS_PER_DAY;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.day++;
      this.onDay(this.day);
    }
  }
  // Día de simulación de una fecha de calendario (día 0 = 1/mar/2025)
  static dayOf(anio, mes, dia) { return Math.round((Date.UTC(anio, mes - 1, dia) - Date.UTC(2025, 2, 1)) / 86400000); }
  // Partes de la fecha de un día de simulación
  static parts(day) { const d = new Date(Date.UTC(2025, 2, 1 + day)); return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() }; }
  // Fecha de calendario a partir del 1/mar/2025
  static format(day) {
    const d = new Date(Date.UTC(2025, 2, 1 + day));
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
}
