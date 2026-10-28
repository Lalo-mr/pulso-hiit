const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const V = require('./voices.js');
const voice = (name, lang='es-MX', extra={}) => ({name, lang, voiceURI: `${lang}:${name}`, ...extra});

test('recognizes Spanish female and male engine voice names without changing voices', () => {
  for(const name of ['Mónica','Paulina','Angélica','Luciana','Marisol','Microsoft Elvira Online (Natural)','Dalia','Laura','Sabina']) assert.equal(V.gender(voice(name)), 'female', name);
  for(const name of ['Jorge','Juan','Diego','Carlos','Rodrigo','Antonio','MicrosoftPablo','Álvaro','Alonso']) assert.equal(V.gender(voice(name)), 'male', name);
});

test('classification is accent/case insensitive and uses complete name tokens', () => {
  assert.equal(V.gender(voice('APPLE MÓNICA (mejorada)')), 'female');
  assert.equal(V.gender(voice('microsoft ALVARO online')), 'male');
  assert.equal(V.gender(voice('Carlota')), 'unknown');
  assert.equal(V.gender(voice('JorgePaulina')), 'unknown');
  assert.equal(V.gender(voice('Diego y Paulina')), 'unknown');
});

test('unknown voices are not presented as a confirmed requested gender', () => {
  const unknown = voice('Google español');
  assert.equal(V.gender(unknown), 'unknown');
  assert.equal(V.gender({...unknown, gender:'female'}), 'unknown');
  const result = V.choose([unknown], {gender:'male'});
  assert.equal(result.voice, unknown);
  assert.equal(result.matched, false);
  assert.equal(result.reason, 'gender-unavailable');
});

test('lists only Spanish voices, ranked es-MX then default Spanish then others', () => {
  const es = voice('Jorge','es-ES'), def = voice('Otra','es-AR',{default:true}), mx = voice('Paulina','es-MX'), en = voice('English','en-US',{default:true});
  assert.deepEqual(V.listSpanish([en,es,def,mx]), [mx,def,es]);
  assert.deepEqual(V.listSpanish([null,{},voice('English','en-US')]), []);
  assert.equal(V.listSpanish([voice('Paulina','ES_mx')]).length, 1);
});

test('same-rank voices preserve device order and exact identities are deduplicated', () => {
  const a = voice('Paulina'), b = voice('Mónica'), duplicate = {...a};
  assert.deepEqual(V.listSpanish([a,b,duplicate]), [a,b]);
});

test('gender preference picks a matching actual device voice over preferred locale', () => {
  const female = voice('Paulina'), male = voice('Jorge','es-ES');
  const result = V.choose([female,male], {gender:'male'});
  assert.equal(result.voice, male);
  assert.equal(result.matched, true);
  assert.equal(result.reason, 'gender');
  assert.equal(V.choose([male,female], {gender:'female'}).voice, female);
});

test('missing requested gender falls back honestly instead of pretending availability', () => {
  const female = voice('Paulina');
  const result = V.choose([female], {gender:'male'});
  assert.deepEqual(result, {voice:female, matched:false, reason:'gender-unavailable'});
});

test('manual selected voice wins, including unknown gender, and persists by exact key', () => {
  const female = voice('Paulina'), chosen = voice('Google español','es-ES');
  const prefs = JSON.parse(JSON.stringify({gender:'female',voiceURI:V.key(chosen)}));
  const result = V.choose([female,chosen],prefs);
  assert.equal(result.voice, chosen);
  assert.equal(result.matched, true);
  assert.equal(result.reason, 'manual');
});

test('a stale manual voice key returns a fallback with an explicit mismatch reason', () => {
  const male = voice('Jorge');
  assert.deepEqual(V.choose([male],{gender:'male',voiceURI:'removed-device-voice'}), {voice:male,matched:false,reason:'missing-selected-voice'});
  assert.equal(V.choose([voice('English','en-US'),male],{voiceURI:'en-US:English'}).reason, 'missing-selected-voice');
});

test('missing URI uses a stable encoded name and normalized language key', () => {
  const selected = voice('Mónica / compacta','ES_mx',{voiceURI:''});
  assert.equal(V.key(selected), 'M%C3%B3nica%20%2F%20compacta::es-mx');
  assert.equal(V.key({...selected, lang:'es-MX'}), V.key(selected));
  assert.equal(V.choose([selected],{voiceURI:V.key(selected)}).voice, selected);
  assert.equal(V.key(null), '');
});

test('an initially empty list can be picked again when device voices become available', () => {
  assert.deepEqual(V.choose([],{gender:'male'}),{voice:null,matched:false,reason:'no-spanish-voices'});
  const loaded = voice('Jorge');
  assert.equal(V.choose([loaded],{gender:'male'}).voice, loaded);
  assert.equal(V.choose(undefined).voice, null);
});

test('automatic and invalid preferences use the best available Spanish voice safely', () => {
  const female = voice('Paulina');
  assert.deepEqual(V.choose([female]),{voice:female,matched:true,reason:'automatic'});
  assert.deepEqual(V.choose([female],{gender:'not-a-gender'}),{voice:female,matched:true,reason:'automatic'});
});

test('browser global and CommonJS expose the same public helper API', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'voices.js'),'utf8'),context);
  assert.deepEqual(Object.keys(context.PulsoVoices).sort(), ['choose','gender','key','listSpanish']);
  assert.equal(context.PulsoVoices.choose([voice('Jorge')],{gender:'male'}).matched,true);
});


test('Windows Spanish Raul/Sabina and Helena use their documented voice gender', () => {
  const raul = voice('Microsoft Raul - Spanish (Mexico)','es-MX',{voiceURI:'Microsoft Raul - Spanish (Mexico)'});
  const sabina = voice('Microsoft Sabina - Spanish (Mexico)','es-MX',{voiceURI:'Microsoft Sabina - Spanish (Mexico)'});
  const helena = voice('Microsoft Helena - Spanish (Spain)','es-ES');
  assert.equal(V.gender(raul),'male');
  assert.equal(V.gender(voice('Microsoft Raúl - Spanish (Mexico)')),'male');
  assert.equal(V.gender(sabina),'female');
  assert.equal(V.gender(helena),'female');
  assert.equal(V.choose([sabina,raul],{gender:'male'}).voice,raul);
  assert.equal(V.choose([raul,sabina],{gender:'female'}).voice,sabina);
});
