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
  }
  const ids = ['tvModeButton','tvTimerButton','fullscreenButton','exitTVButton','displayStatus','projectionHelpButton','projectionHelpDialog'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  const document = new Element(), classes = new Set(), timers = new Map();
  let timerSequence = 0;
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
      if (options.pending) return new Promise(resolve => { resolveRequest = () => { document.fullscreenElement = document.documentElement; document.fire('fullscreenchange'); resolve(); }; });
      document.fullscreenElement = document.documentElement;
      document.fire('fullscreenchange');
      return Promise.resolve();
    };
    const exit = function () {
      exits += 1;
      document.fullscreenElement = null;
      document.webkitFullscreenElement = null;
      document.fire(options.webkit ? 'webkitfullscreenchange' : 'fullscreenchange');
      return Promise.resolve();
    };
    if(options.webkit) { document.documentElement.webkitRequestFullscreen = request; document.webkitExitFullscreen = exit; }
    else { document.documentElement.requestFullscreen = request; document.exitFullscreen = exit; }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'display.js'),'utf8'),{
    document,Promise,
    setTimeout(fn, milliseconds){const id=++timerSequence;timers.set(id,{fn,milliseconds});return id;},
    clearTimeout(id){timers.delete(id);}
  },{filename:'display.js'});
  return {elements,document,classes,timers,fireTimer(id){const timer=timers.get(id);timers.delete(id);timer?.fn();},click:id=>elements[id].fire('click'),requests:()=>requests,exits:()=>exits,resolve:()=>resolveRequest?.()};
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('TV starts only after user action and requests native fullscreen synchronously', async () => {
  const h = harness();
  assert.equal(h.requests(),0);
  assert.equal(h.classes.has('presentation-mode'),false);
  assert.equal(h.elements.exitTVButton.hidden,true);
  h.click('tvModeButton');
  assert.equal(h.requests(),1);
  assert.equal(h.classes.has('presentation-mode'),true);
  await flush();
  assert.equal(h.elements.fullscreenButton.attributes['aria-pressed'],'true');
  assert.equal(h.elements.fullscreenButton.textContent,'Salir de pantalla completa');
  assert.equal(h.elements.exitTVButton.hidden,false);
});

test('missing or rejected fullscreen keeps usable TV layout with honest iPhone help', async () => {
  for(const options of [{native:false},{reject:true},{throwRequest:true}]) {
    const h = harness(options); h.click('fullscreenButton'); await flush();
    assert.equal(h.classes.has('presentation-mode'),true);
    assert.match(h.elements.displayStatus.textContent,/pantalla de inicio/);
    assert.equal(h.elements.fullscreenButton.attributes['aria-pressed'],'false');
    assert.equal(h.elements.exitTVButton.hidden,false);
  }
});

test('exit restores the layout and leaves fullscreen', async () => {
  const h = harness(); h.click('tvTimerButton'); await flush();
  h.click('exitTVButton'); await flush();
  assert.equal(h.exits(),1);
  assert.equal(h.classes.has('presentation-mode'),false);
  assert.equal(h.elements.exitTVButton.hidden,true);
  assert.equal(h.elements.tvModeButton.attributes['aria-pressed'],'false');
  assert.equal(h.elements.displayStatus.hidden,true);
});

test('Escape respects open dialogs, then exits TV mode when no dialog is open', async () => {
  const h = harness({native:false}); h.click('tvModeButton'); h.click('projectionHelpButton');
  assert.equal(h.elements.projectionHelpDialog.open,true);
  h.document.fire('keydown',{key:'Escape'});
  assert.equal(h.classes.has('presentation-mode'),true);
  h.elements.projectionHelpDialog.open=false;
  h.document.fire('keydown',{key:'Escape'});
  assert.equal(h.classes.has('presentation-mode'),false);
});

test('browser fullscreen exit updates all controls and clears TV mode', async () => {
  const h = harness(); h.click('tvModeButton'); await flush();
  h.document.fullscreenElement=null; h.document.fire('fullscreenchange');
  assert.equal(h.classes.has('presentation-mode'),false);
  assert.equal(h.elements.fullscreenButton.textContent,'Pantalla completa');
  assert.equal(h.elements.fullscreenButton.attributes['aria-pressed'],'false');
  assert.equal(h.elements.exitTVButton.hidden,true);
});

test('a fullscreen request resolving after Exit does not re-enter TV mode', async () => {
  const h = harness({pending:true}); h.click('tvModeButton'); h.click('exitTVButton');
  h.resolve(); await flush();
  assert.equal(h.classes.has('presentation-mode'),false);
  assert.equal(h.document.fullscreenElement,null);
  assert.equal(h.exits(),1);
});

test('webkit-prefixed requests and exit remain supported', async () => {
  const h = harness({webkit:true}); h.click('tvModeButton'); await flush();
  assert.equal(h.requests(),1);
  h.click('exitTVButton'); await flush();
  assert.equal(h.exits(),1);
  assert.equal(h.classes.has('presentation-mode'),false);
});


test('display notices clear after seven seconds and stale notices cannot hide a replacement',()=>{
  const h=harness({native:false});
  h.click('tvModeButton');
  assert.equal(h.timers.size,1);
  const previous=[...h.timers.values()][0];
  assert.equal(previous.milliseconds,7000);
  h.click('tvTimerButton');
  assert.equal(h.timers.size,1);
  const [replacementId,replacement]=[...h.timers.entries()][0];
  assert.notEqual(replacement,previous);
  previous.fn();
  assert.equal(h.elements.displayStatus.hidden,false);
  assert.match(h.elements.displayStatus.textContent,/pantalla de inicio/);
  h.fireTimer(replacementId);
  assert.equal(h.elements.displayStatus.hidden,true);
  assert.equal(h.elements.displayStatus.textContent,'');
  h.click('tvTimerButton');
  assert.equal(h.timers.size,1);
  h.click('exitTVButton');
  assert.equal(h.timers.size,0);
  assert.equal(h.elements.displayStatus.hidden,true);
  assert.equal(h.elements.displayStatus.textContent,'');
});
