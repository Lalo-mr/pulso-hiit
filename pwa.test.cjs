'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = __dirname;
const code = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
function worker(scope, options = {}) {
  const listeners = {}, stores = new Map(), network = [], events = [], navigations = [];
  let claimed = 0, skippedWaiting = 0;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const items = stores.get(name);
      return {
        async addAll(urls) {
          events.push('precache-start');
          if(options.onPrecacheStart) options.onPrecacheStart();
          if(options.precacheGate) await options.precacheGate;
          if(options.precacheFails) throw new Error('precache failed');
          for (const url of urls) items.set(url, {body:'cached:' + url});
          events.push('precache-complete');
        },
        async match(url) { return items.get(url); }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  const self = {
    registration:{scope},
    clients:{
      async claim(){ claimed++; events.push('clients-claimed'); },
      async matchAll(){ return [{async navigate(url){navigations.push(url);}}]; }
    },
    async skipWaiting(){ skippedWaiting++; events.push('skip-waiting'); },
    addEventListener(name, fn){listeners[name]=fn;}
  };
  vm.runInNewContext(code,{self,caches,URL,Set,fetch:async request=>{network.push(request.url);throw new Error('offline');}});
  return {
    stores, network, events, navigations, claimed:()=>claimed, skippedWaiting:()=>skippedWaiting,
    async lifecycle(name) { let pending;listeners[name]({waitUntil(p){pending=p;}});await pending; },
    async get(url, method='GET') {
      let response;
      listeners.fetch({request:{url,method},respondWith(p){response=p;}});
      return response === undefined ? undefined : await response;
    }
  };
}
for (const pathname of ['/', '/pulso-hiit/']) {
  test('offline shell works at ' + pathname + ' without network', async () => {
    const w=worker('https://lalo-mr.github.io'+pathname);
    await w.lifecycle('install');await w.lifecycle('activate');
    for(const file of ['', 'index.html','app.js','engine.js','voices.js','voice-audio.js','audio/manifest.json','audio/male.mp3','audio/female.mp3','audio/CREDITOS.md','display.js','pwa.js','styles.css','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png']){
      const url='https://lalo-mr.github.io'+pathname+file;
      assert.equal((await w.get(url)).body,'cached:'+url);
    }
    assert.equal(w.network.length,0);
    assert.equal(w.claimed(),1);
  });
}
test('worker leaves unrelated paths, origins, methods and personal exports untouched',async()=>{
 const w=worker('https://lalo-mr.github.io/pulso-hiit/');await w.lifecycle('install');
 for(const [url,method] of [
 ['https://lalo-mr.github.io/otra-app/app.js','GET'],
 ['https://lalo-mr.github.io/pulso-hiit-private/index.html','GET'],
 ['https://example.org/pulso-hiit/app.js','GET'],
 ['https://lalo-mr.github.io/pulso-hiit/copia-personal.json','GET'],
 ['https://lalo-mr.github.io/pulso-hiit/index.html','POST']
 ])assert.equal(await w.get(url,method),undefined);
 assert.equal(w.network.length,0);
});
test('query parameters do not create private or unbounded runtime caches',async()=>{
 const w=worker('https://lalo-mr.github.io/pulso-hiit/');await w.lifecycle('install');
 const before=[...w.stores.values()][0].size;
 assert.equal((await w.get('https://lalo-mr.github.io/pulso-hiit/?test=1')).body,'cached:https://lalo-mr.github.io/pulso-hiit/');
 assert.equal([...w.stores.values()][0].size,before);
});
test('activation removes only older caches for exactly this app scope',async()=>{
 const w=worker('https://lalo-mr.github.io/pulso-hiit/');await w.lifecycle('install');
 const current=[...w.stores.keys()][0], ownOld=current.replace(/[^:]+$/,'old');
 const others=['unrelated-site-cache','pulso-hiit:%2Fotra-app%2F:old','pulso-hiit:%2F:old'];
 w.stores.set(ownOld,new Map());for(const name of others)w.stores.set(name,new Map());
 await w.lifecycle('activate');
 assert.equal(w.stores.has(ownOld),false);assert.equal(w.stores.has(current),true);
 for(const name of others)assert.equal(w.stores.has(name),true);
});
test('manifest URLs remain inside root or project Pages deployment and icons exist',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
 assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
 for(const prefix of ['https://lalo-mr.github.io/','https://lalo-mr.github.io/pulso-hiit/']){
  assert.equal(new URL(manifest.start_url,prefix+'manifest.webmanifest').href,prefix);
  for(const icon of manifest.icons)assert.ok(new URL(icon.src,prefix+'manifest.webmanifest').href.startsWith(prefix));
 }
 for(const [name,size]of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]]){
  const bytes=fs.readFileSync(path.join(root,'icons',name));
  assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
 }
});
test('manual iPhone install and audible test controls are reachable',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const id of ['testVoiceButton','installHelpButton','installHelpDialog','offlineStatus'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/apple-mobile-web-app-capable/);assert.match(html,/apple-touch-icon/);
 assert.match(html,/Al bloquear el iPhone o cambiar de app/);assert.doesNotMatch(html,/Vista previa/);
});


test('update waits for the full shell before activation and never navigates a running client', async()=>{
  let complete, start;
  const gate = new Promise(resolve=>{complete=resolve;});
  const started = new Promise(resolve=>{start=resolve;});
  const w=worker('https://lalo-mr.github.io/pulso-hiit/',{precacheGate:gate,onPrecacheStart:start});
  const installing=w.lifecycle('install');
  await started;
  assert.deepEqual(w.events,['precache-start']);
  assert.equal(w.skippedWaiting(),0);
  assert.equal(w.claimed(),0);
  complete();await installing;
  assert.deepEqual(w.events,['precache-start','precache-complete','skip-waiting']);
  await w.lifecycle('activate');
  assert.equal(w.claimed(),1);
  assert.deepEqual(w.navigations,[]);
  assert.deepEqual(w.events,['precache-start','precache-complete','skip-waiting','clients-claimed']);
  assert.match((await w.get('https://lalo-mr.github.io/pulso-hiit/voices.js')).body,/cached:/);
  assert.match((await w.get('https://lalo-mr.github.io/pulso-hiit/display.js')).body,/cached:/);
});

test('failed precache does not skip waiting or claim current clients',async()=>{
  const w=worker('https://lalo-mr.github.io/pulso-hiit/',{precacheFails:true});
  await assert.rejects(w.lifecycle('install'),/precache failed/);
  assert.equal(w.skippedWaiting(),0);
  assert.equal(w.claimed(),0);
  assert.deepEqual(w.navigations,[]);
});
