/* Motor independiente. El reloj calcula el tiempo con una referencia absoluta. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PulsoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const labels = { prepare: 'Prepárate', work: 'Entrena', rest: 'Descansa', cycleRest: 'Recupera', cooldown: 'Enfriamiento' };
  function validate(w) {
    if (!w || !['tabata', 'rounds', 'stopwatch'].includes(w.mode)) throw new Error('Selecciona un tipo de entrenamiento.');
    if (typeof w.name !== 'string' || !w.name.trim() || w.name.length > 60) throw new Error('Escribe un nombre de hasta 60 caracteres.');
    for (const field of ['prepare', 'work', 'rest', 'cycleRest', 'cooldown', 'lap']) {
      if (!Number.isInteger(w[field]) || w[field] < 0 || w[field] > 3600) throw new Error('Los tiempos deben ser segundos enteros entre 0 y 60 minutos.');
    }
    for (const field of ['rounds', 'cycles']) {
      if (!Number.isInteger(w[field]) || w[field] < 1 || w[field] > 100) throw new Error('Rondas y ciclos deben estar entre 1 y 100.');
    }
    if (w.mode !== 'stopwatch' && w.work < 1) throw new Error('El tiempo de ejercicio debe ser mayor que cero.');
    if (w.mode !== 'stopwatch' && totalDuration(w) > 4 * 3600) throw new Error('Ajusta los intervalos: la sesión puede durar hasta 4 horas.');
    return { ...w, name: w.name.trim() };
  }
  function buildPhases(w) {
    if (w.mode === 'stopwatch') return [];
    const result = [];
    function add(kind, duration, round, cycle) {
      if (duration > 0) result.push({ kind, duration, round, cycle, title: labels[kind], id: result.length });
    }
    add('prepare', w.prepare, 1, 1);
    const cycles = w.mode === 'rounds' ? 1 : w.cycles;
    for (let cycle = 1; cycle <= cycles; cycle++) {
      for (let round = 1; round <= w.rounds; round++) {
        add('work', w.work, round, cycle);
        if (round < w.rounds) add('rest', w.rest, round, cycle);
      }
      if (cycle < cycles) add('cycleRest', w.cycleRest, w.rounds, cycle);
    }
    add('cooldown', w.cooldown, w.rounds, cycles);
    return result;
  }
  function totalDuration(w) {
    if (w.mode === 'stopwatch') return 0;
    const cycles = w.mode === 'rounds' ? 1 : w.cycles;
    return w.prepare + cycles * (w.rounds * w.work + Math.max(0, w.rounds - 1) * w.rest) + Math.max(0, cycles - 1) * w.cycleRest + w.cooldown;
  }
  class Clock {
    constructor(phases) {
      this.phases = phases;
      this.total = phases.reduce((sum, p) => sum + p.duration, 0);
      this.offset = 0;
      this.anchor = null;
      this.running = false;
    }
    elapsed(now) { return this.offset + (this.running ? Math.max(0, now - this.anchor) / 1000 : 0); }
    resume(now) { if (!this.running) { this.anchor = now; this.running = true; } }
    pause(now) { this.offset = this.elapsed(now); this.running = false; this.anchor = null; }
    seek(seconds, now) { this.offset = Math.max(0, seconds); this.anchor = this.running ? now : null; }
    snapshot(now) {
      const elapsed = this.elapsed(now);
      let start = 0;
      for (let i = 0; i < this.phases.length; i++) {
        const phase = this.phases[i];
        const end = start + phase.duration;
        if (elapsed < end) return { done: false, phase, index: i, remaining: end - elapsed, fraction: (end - elapsed) / phase.duration, elapsed, start, end, total: this.total };
        start = end;
      }
      return { done: true, elapsed: Math.min(elapsed, this.total), remaining: 0, fraction: 0, index: this.phases.length, total: this.total };
    }
    skip(now) { const current = this.snapshot(now); if (!current.done) this.seek(current.end, now); return this.snapshot(now); }
  }
  function format(seconds, hours = false) {
    const whole = Math.max(0, Math.ceil(seconds));
    const h = Math.floor(whole / 3600);
    const m = Math.floor((whole % 3600) / 60);
    const s = whole % 60;
    return h || hours ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function recordedDuration(actualSeconds, scheduledSeconds, skippedSeconds = 0) { return Math.min(Math.max(0, actualSeconds), Math.max(0, scheduledSeconds - skippedSeconds)); }
  return { validate, buildPhases, totalDuration, Clock, format, recordedDuration };
});


