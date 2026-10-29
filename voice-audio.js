/* Included Spanish voice sprites. Audio starts only through the caller's gesture. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PulsoAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function create(options) {
    options = options || {};
    const context = options.context;
    if (!context || typeof context.createBufferSource !== 'function' || typeof context.decodeAudioData !== 'function') {
      throw new Error('Este navegador no ofrece reproducción de las voces incluidas.');
    }
    const request = options.fetch || (typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    const baseURL = new URL(options.baseURL || root.document?.baseURI || root.location?.href || 'http://localhost/');
    const manifestURL = resolveURL(options.manifestURL || 'audio/manifest.json');
    const records = new Map();
    const sources = new Set();
    let manifestPromise = null;
    let revision = 0;

    function resolveURL(value) {
      if (typeof value !== 'string' || !value.trim()) throw new Error('La dirección del paquete de voz no es válida.');
      const url = new URL(value, baseURL);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== baseURL.origin) {
        throw new Error('Las voces deben cargarse desde la misma página de Pulso.');
      }
      return url.href;
    }
    function voiceName(voice) {
      if (!['female', 'male'].includes(voice)) throw new Error('Elige la voz femenina o masculina.');
      return voice;
    }
    function asError(error) {
      return error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'No se pudo cargar la voz incluida.');
    }
    function callback(name, ...args) {
      try { if (typeof options[name] === 'function') options[name](...args); } catch (_) { /* UI callbacks cannot stop the clock. */ }
    }
    function setState(voice, record, state) {
      record.status = state;
      callback('onState', voice, state);
    }
    async function response(url) {
      if (!request) throw new Error('No se pueden descargar las voces en este navegador.');
      const result = await request(url, {credentials: 'same-origin'});
      if (!result || !result.ok) throw new Error('No se pudo descargar la voz. Abre Pulso con conexión e inténtalo de nuevo.');
      return result;
    }
    function manifest() {
      if (!manifestPromise) {
        manifestPromise = (async () => {
          const result = await (await response(manifestURL)).json();
          if (!result || result.version !== 1 || !result.voices || typeof result.voices !== 'object') {
            throw new Error('El paquete de voces no tiene un formato válido.');
          }
          return result;
        })().catch(error => { manifestPromise = null; throw asError(error); });
      }
      return manifestPromise;
    }
    function decode(bytes) {
      // Callback form also works in WebKit versions that do not return a Promise.
      return new Promise((resolve, reject) => {
        try {
          const decoded = context.decodeAudioData(bytes, resolve, reject);
          if (decoded && typeof decoded.then === 'function') decoded.then(resolve, reject);
        } catch (error) { reject(error); }
      });
    }
    function validateClips(value, duration) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || !Number.isFinite(duration) || duration <= 0) {
        throw new Error('El audio de la voz no tiene un formato válido.');
      }
      const clips = Object.create(null);
      for (const [key, entry] of Object.entries(value)) {
        if (!Array.isArray(entry) || entry.length !== 2 || !entry.every(Number.isFinite) || entry[0] < 0 || entry[1] <= 0 || entry[0] + entry[1] > duration + 0.08) {
          throw new Error('El paquete contiene un intervalo de voz no válido.');
        }
        // An MP3 encoder can add a small amount of padding. Never ask Web Audio
        // to play past the actual decoded buffer even within that tolerance.
        const length = Math.min(entry[1], duration - entry[0]);
        if (length <= 0) throw new Error('El paquete contiene un intervalo de voz vacío.');
        clips[key] = [entry[0], length];
      }
      if (!Object.keys(clips).length) throw new Error('El paquete de voz está vacío.');
      return clips;
    }
    function ensureLoaded(voice) {
      voiceName(voice);
      const existing = records.get(voice);
      if (existing?.status === 'ready') return Promise.resolve(existing);
      if (existing?.status === 'loading') return existing.promise;
      const record = {status: 'loading', promise: null, buffer: null, clips: null};
      records.set(voice, record);
      setState(voice, record, 'loading');
      record.promise = (async () => {
        const definition = (await manifest()).voices[voice];
        if (!definition || typeof definition !== 'object') throw new Error('La voz elegida no está incluida en este paquete.');
        const url = resolveURL(definition.url);
        const bytes = await (await response(url)).arrayBuffer();
        const buffer = await decode(bytes);
        const clips = validateClips(definition.clips, buffer?.duration);
        record.buffer = buffer;
        record.clips = clips;
        setState(voice, record, 'ready');
        return record;
      })().catch(error => {
        record.error = asError(error);
        setState(voice, record, 'error');
        throw record.error;
      });
      return record.promise;
    }
    async function load(voice) {
      const token = revision;
      try { await ensureLoaded(voice); return true; }
      catch (error) {
        const failure = asError(error);
        if (token === revision) callback('onError', failure, voice);
        throw failure;
      }
    }
    function stop() {
      revision += 1;
      for (const source of sources) {
        source.onended = null;
        try { source.stop(); } catch (_) { /* Already ended. */ }
        try { source.disconnect(); } catch (_) { /* Already disconnected. */ }
      }
      sources.clear();
    }
    async function play(keys, voice) {
      stop();
      const token = revision;
      try {
        if (!Array.isArray(keys) || !keys.length || !keys.every(key => typeof key === 'string')) throw new Error('No hay un aviso de voz válido para reproducir.');
        // The caller resumes AudioContext synchronously from a user gesture.
        // Capture that specific resume Promise now; never resume automatically
        // after a download or consult a newer gesture after this call.
        const activation = typeof options.activation === 'function' ? options.activation() : null;
        const [record] = await Promise.all([ensureLoaded(voice), Promise.resolve(activation)]);
        if (token !== revision) return false;
        if (context.state && context.state !== 'running') {
          throw new Error('Toca Probar voz o Continuar para activar el audio.');
        }
        const clips = keys.map(key => {
          if (!Object.prototype.hasOwnProperty.call(record.clips, key)) throw new Error('El aviso solicitado no está incluido en la voz.');
          return record.clips[key];
        });
        let when = context.currentTime + 0.02;
        for (const [offset, duration] of clips) {
          const source = context.createBufferSource();
          source.buffer = record.buffer;
          source.connect(context.destination);
          sources.add(source);
          source.onended = () => {
            sources.delete(source);
            try { source.disconnect(); } catch (_) { /* Already disconnected. */ }
          };
          source.start(when, offset, duration);
          when += duration + 0.035;
        }
        return true;
      } catch (error) {
        if (token === revision) {
          stop();
          callback('onError', asError(error), voice);
        }
        return false;
      }
    }
    function state(voice) { return records.get(voice)?.status || 'idle'; }
    return {load, play, stop, state};
  }
  return {create};
});
