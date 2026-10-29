const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(options = {}) {
  class Element {
    constructor() { this.listeners = new Map(); this.attributes = {}; this.hidden = false; this.textContent = ''; this.open = false; }
    addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
    fire(type, event = {}) { for (const fn of this.listeners.get(type) || []) fn({preventDefault(){}, ...event}); }
    setAttribute(key, value) { this.attributes[key] = value; }
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const ids = ['expandTimerButton','expandTimerIcon','timerScreen','displayStatus','projectionHelpButton','projectionHelpDialog'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  elements.timerScreen.hidden = !!options.screenHidden;
  const document = new Element(), classes = new Set(), timers = new Map(), orientation = new Element();
  orientation.matches = !options.portrait;
  let timerSequence = 0, screenChanged;
  document.body = {classList:{toggle(name, force) { if(force)classes.add(name); else classes.delete(name); }}};
  document.documentElement = new Element();
  document.getElementById = id => elements[id] || null;
  document.querySelector = () => elements.projectionHelpDialog.open ? elements.projectionHelpDialog : null;
  document.fullscreenElement = null;
  let requests = 0, exits = 0, resolveRequest;
  if (options.native !== false) {
    const request = function () {
      requests += 1;
      if (options.reject) return Promise.reject(new Error('permission denied'));
      if (options.throwRequest) throw new Error('not supported');
      const complete = () => {
        document[options.webkit ? 'webkitFullscreenElement' : 'fullscreenElement'] = document.documentElement;
        document.fire(options.webkit ? 'webkitfullscreenchange' : 'fullscreenchange');
      };
      if (options.pending) return new Promise(resolve => { resolveRequest = () => { complete(); resolve(); }; });
      complete();
      return Promise.resolve();
    };
    const exit = function () {
      exits += 1;
      if(options.rejectExit) return Promise.reject(new Error('cannot exit'));
      document.fullscreenElement = null;
      document.webkitFullscreenElement = null;
      document.fire(options.webkit ? 'webkitfullscreenchange' : 'fullscreenchange');
      return Promise.resolve();
    };
    if(options.webkit) { document.documentElement.webkitRequestFullscreen = request; document.webkitExitFullscreen = exit; }
    else { document.documentElement.requestFullscreen = request; document.exitFullscreen = exit; }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'display.js'),'utf8'),{
    document, Promise, matchMedia: () => orientation,
    MutationObserver: class { constructor(fn){screenChanged=fn;} observe(target,config){assert.equal(target,elements.timerScreen);assert.equal(config.attributeFilter[0],'hidden');} },
    setTimeout(fn, milliseconds){const id=++timerSequence;timers.set(id,{fn,milliseconds});return id;},
    clearTimeout(id){timers.delete(id);}
  },{filename:'display.js'});
  return {elements,document,classes,timers,
    screen(hidden){elements.timerScreen.hidden=hidden;screenChanged();},
    rotate(landscape){orientation.matches=landscape;orientation.fire('change');},
    fireTimer(id){const timer=timers.get(id);timers.delete(id);timer?.fn();},
    click:id=>elements[id].fire('click'),requests:()=>requests,exits:()=>exits,resolve:()=>resolveRequest?.()};
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('expand appears only for a visible horizontal workout and never opens itself',()=>{
  const h=harness({screenHidden:true});
  assert.equal(h.elements.expandTimerButton.hidden,true);
  h.click('expandTimerButton');assert.equal(h.requests(),0);
  h.screen(false);assert.equal(h.elements.expandTimerButton.hidden,false);
  h.rotate(false);assert.equal(h.elements.expandTimerButton.hidden,true);
  h.click('expandTimerButton');assert.equal(h.requests(),0);
  h.rotate(true);assert.equal(h.elements.expandTimerButton.hidden,false);
  assert.equal(h.classes.has('presentation-mode'),false);
});

test('one tap requests fullscreen synchronously and the same icon exits',async()=>{
  const h=harness();h.click('expandTimerButton');
  assert.equal(h.requests(),1);assert.equal(h.classes.has('presentation-mode'),true);
  await flush();
  assert.equal(h.elements.expandTimerButton.attributes['aria-label'],'Salir de pantalla completa');
  assert.equal(h.elements.expandTimerIcon.attributes.href,'#i-collapse');
  h.click('expandTimerButton');await flush();
  assert.equal(h.exits(),1);assert.equal(h.classes.has('presentation-mode'),false);
  assert.equal(h.elements.expandTimerButton.attributes['aria-label'],'Pantalla completa');
  assert.equal(h.elements.expandTimerIcon.attributes.href,'#i-expand');
});

test('unsupported or rejected fullscreen still provides an expanded view that can be exited',async()=>{
  for(const options of [{native:false},{reject:true},{throwRequest:true}]){
    const h=harness(options);h.click('expandTimerButton');await flush();
    assert.equal(h.classes.has('presentation-mode'),true);
    assert.match(h.elements.displayStatus.textContent,/pantalla de inicio/);
    assert.equal(h.elements.expandTimerButton.attributes['aria-pressed'],'true');
    h.click('expandTimerButton');await flush();
    assert.equal(h.classes.has('presentation-mode'),false);
    assert.equal(h.elements.displayStatus.hidden,true);
  }
});

test('rotating to portrait exits presentation and fullscreen before hiding the icon',async()=>{
  for(const options of [{},{native:false}]){
    const h=harness(options);h.click('expandTimerButton');await flush();h.rotate(false);await flush();
    assert.equal(h.classes.has('presentation-mode'),false);
    assert.equal(h.document.fullscreenElement,null);
    assert.equal(h.elements.expandTimerButton.hidden,true);
  }
});

test('leaving the workout also exits presentation, so completion and More have no floating control',async()=>{
  const h=harness();h.click('expandTimerButton');await flush();h.screen(true);await flush();
  assert.equal(h.classes.has('presentation-mode'),false);
  assert.equal(h.document.fullscreenElement,null);
  assert.equal(h.elements.expandTimerButton.hidden,true);
  h.screen(false);assert.equal(h.elements.expandTimerButton.hidden,false);
  assert.equal(h.requests(),1);
});

test('a delayed fullscreen request cannot re-enter after rotation or the workout ending',async()=>{
  for(const action of [h=>h.rotate(false),h=>h.screen(true),h=>h.click('expandTimerButton')]){
    const h=harness({pending:true});h.click('expandTimerButton');action(h);h.resolve();await flush();
    assert.equal(h.classes.has('presentation-mode'),false);
    assert.equal(h.document.fullscreenElement,null);
    assert.equal(h.exits(),1);
  }
});

test('TV help opens from More without starting a fullscreen request',()=>{
  const h=harness({screenHidden:true});h.click('projectionHelpButton');
  assert.equal(h.elements.projectionHelpDialog.open,true);
  assert.equal(h.requests(),0);assert.equal(h.elements.expandTimerButton.hidden,true);
});

test('Escape respects open dialogs, then exits presentation',()=>{
  const h=harness({native:false});h.click('expandTimerButton');h.click('projectionHelpButton');
  h.document.fire('keydown',{key:'Escape'});assert.equal(h.classes.has('presentation-mode'),true);
  h.elements.projectionHelpDialog.open=false;h.document.fire('keydown',{key:'Escape'});
  assert.equal(h.classes.has('presentation-mode'),false);
});

test('browser fullscreen exit updates the expand icon and clears presentation',async()=>{
  const h=harness();h.click('expandTimerButton');await flush();
  h.document.fullscreenElement=null;h.document.fire('fullscreenchange');
  assert.equal(h.classes.has('presentation-mode'),false);
  assert.equal(h.elements.expandTimerButton.attributes['aria-pressed'],'false');
  assert.equal(h.elements.expandTimerIcon.attributes.href,'#i-expand');
});

test('webkit-prefixed fullscreen requests and exit remain supported',async()=>{
  const h=harness({webkit:true});h.click('expandTimerButton');await flush();
  assert.equal(h.requests(),1);h.click('expandTimerButton');await flush();
  assert.equal(h.exits(),1);assert.equal(h.classes.has('presentation-mode'),false);
});

test('if the browser refuses to exit fullscreen the exit icon stays accessible in portrait',async()=>{
  const h=harness({rejectExit:true});h.click('expandTimerButton');await flush();h.rotate(false);await flush();
  assert.equal(h.classes.has('presentation-mode'),false);
  assert.equal(h.elements.expandTimerButton.hidden,false);
  assert.equal(h.elements.expandTimerButton.attributes['aria-label'],'Salir de pantalla completa');
  assert.match(h.elements.displayStatus.textContent,/navegador para salir/);
});

test('temporary notices expire and an older timer cannot hide a replacement notice',()=>{
  const h=harness({native:false});h.click('expandTimerButton');
  const old=[...h.timers.values()][0];assert.equal(old.milliseconds,7000);
  h.click('expandTimerButton');h.click('expandTimerButton');
  const [id]=[...h.timers.keys()];old.fn();assert.equal(h.elements.displayStatus.hidden,false);
  h.fireTimer(id);assert.equal(h.elements.displayStatus.hidden,true);
});
