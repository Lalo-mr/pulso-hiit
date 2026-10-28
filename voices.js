/* Browser speech voices have no standard gender field. Recognize only known
   Spanish engine voice names; unknown voices stay available for manual choice. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PulsoVoices = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const femaleNames = new Set(['monica', 'paulina', 'angelica', 'luciana', 'marisol', 'elvira', 'dalia', 'laura', 'sabina', 'helena']);
  const maleNames = new Set(['jorge', 'juan', 'diego', 'carlos', 'rodrigo', 'antonio', 'pablo', 'alvaro', 'alonso', 'raul']);

  function language(voice) {
    return typeof voice?.lang === 'string' ? voice.lang.trim().replace(/_/g, '-').toLowerCase() : '';
  }
  function isSpanish(voice) {
    return !!voice && /^es(?:-|$)/.test(language(voice));
  }
  function key(voice) {
    if (!voice) return '';
    if (typeof voice.voiceURI === 'string' && voice.voiceURI.trim()) return voice.voiceURI.trim();
    const name = typeof voice.name === 'string' ? voice.name.trim() : '';
    return encodeURIComponent(name) + '::' + language(voice);
  }
  function listSpanish(voices) {
    const seen = new Set();
    return Array.from(voices || []).filter(isSpanish).map((voice, index) => ({voice, index}))
      .sort((a, b) => {
        const rank = voice => language(voice) === 'es-mx' ? 0 : voice.default ? 1 : 2;
        return rank(a.voice) - rank(b.voice) || a.index - b.index;
      }).filter(({voice}) => {
        const identity = key(voice);
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      }).map(({voice}) => voice);
  }
  function gender(voice) {
    if (typeof voice?.name !== 'string') return 'unknown';
    const name = voice.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/\b(microsoft|apple|google)(?=[a-z])/g, '$1 ');
    const tokens = name.match(/[a-z]+/g) || [];
    const female = tokens.some(token => femaleNames.has(token));
    const male = tokens.some(token => maleNames.has(token));
    if (female === male) return 'unknown';
    return female ? 'female' : 'male';
  }
  function choose(voices, options) {
    options = options || {};
    const available = listSpanish(voices);
    if (!available.length) return {voice: null, matched: false, reason: 'no-spanish-voices'};
    const requestedGender = ['female', 'male'].includes(options.gender) ? options.gender : 'auto';
    const manualKey = typeof options.voiceURI === 'string' ? options.voiceURI : '';
    if (manualKey) {
      const manual = available.find(voice => key(voice) === manualKey);
      if (manual) return {voice: manual, matched: true, reason: 'manual'};
    }
    const matching = requestedGender === 'auto' ? null : available.find(voice => gender(voice) === requestedGender);
    const voice = matching || available[0];
    if (manualKey) return {voice, matched: false, reason: 'missing-selected-voice'};
    if (matching) return {voice, matched: true, reason: 'gender'};
    if (requestedGender !== 'auto') return {voice, matched: false, reason: 'gender-unavailable'};
    return {voice, matched: true, reason: 'automatic'};
  }
  return {listSpanish, key, gender, choose};
});
