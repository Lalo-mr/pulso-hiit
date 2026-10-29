'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Audio = require('./voice-audio.js');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
function harness(options = {}) {
  const requests = [], nodes = [], states = [], errors = [];
  let decodeCount = 0;
  const manifest = options.manifest || {version:1,voices:{
    male:{url:'audio/male.mp3',clips:{work:[0,1],round:[1.1,.4],n3:[1.6,.5],of:[2.2,.2],n8:[2.5,.5]}},
    female:{url:'audio/female.mp3',clips:{work:[0,.8],rest:[1,1]}}
  }};
  const context = {
    state: options.suspended ? 'suspended' : 'running', currentTime: 12, destination:{},
    decodeAudioData(bytes, resolve) {
      decodeCount++;
      if(options.decodeFailure?.()) return Promise.reject(new Error('decode failed'));
      const result = {duration:options.duration || 10};
      if(options.callbackDecode) { resolve(result); return; }
      return Promise.resolve(result);
    },
    createBufferSource() {
      const node = {
        stopped:0,disconnected:0,
        connect(destination){this.destination=destination;},
        disconnect(){this.disconnected++;},
        start(...args){this.startArgs=args;},
        stop(){this.stopped++;}
      };
      nodes.push(node);return node;
    }
  };
  const jsonResponse = {ok:true,json:async()=>manifest};
  const assetResponse = {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};
  const fetch = async (url, init) => {
    requests.push({url,init});
    if(url.endsWith('manifest.json')) return options.manifestResponse ? options.manifestResponse() : jsonResponse;
    return options.assetResponse ? options.assetResponse(url) : assetResponse;
  };
  const player = Audio.create({
    context,fetch,baseURL:'https://example.test/pulso-hiit/',activation:options.activation,
    onState(voice,state){states.push([voice,state]);if(options.callbackThrows)throw Error('UI failed');},
    onError(error,voice){errors.push({error,voice});if(options.callbackThrows)throw Error('UI failed');}
  });
  return {player,context,requests,nodes,states,errors,assetResponse,decodeCount:()=>decodeCount};
}

test('does no eager network or playback and caches one decoded sprite per requested voice',async()=>{
  const h=harness();
  assert.equal(h.requests.length,0);assert.equal(h.player.state('male'),'idle');
  await Promise.all([h.player.load('male'),h.player.load('male')]);
  assert.equal(h.requests.length,2);assert.equal(h.decodeCount(),1);assert.equal(h.nodes.length,0);
  assert.equal(h.player.state('male'),'ready');assert.equal(h.player.state('female'),'idle');
  await h.player.load('male');assert.equal(h.requests.length,2);
  await h.player.load('female');assert.equal(h.requests.length,3);assert.equal(h.decodeCount(),2);
  assert.ok(h.requests.every(r=>r.url.startsWith('https://example.test/pulso-hiit/audio/')));
  assert.ok(h.requests.every(r=>r.init.credentials==='same-origin'));
  assert.deepEqual(h.states,[['male','loading'],['male','ready'],['female','loading'],['female','ready']]);
});

test('schedules the exact chosen voice clips in spoken order using sprite offsets',async()=>{
  const h=harness();
  assert.equal(await h.player.play(['work','round','n3','of','n8'],'male'),true);
  assert.equal(h.nodes.length,5);
  assert.deepEqual(h.nodes.map(n=>n.startArgs.slice(1)),[[0,1],[1.1,.4],[1.6,.5],[2.2,.2],[2.5,.5]]);
  for(let i=1;i<h.nodes.length;i++)assert.ok(h.nodes[i].startArgs[0]>=h.nodes[i-1].startArgs[0]+h.nodes[i-1].startArgs[2]);
  assert.equal(h.requests.some(r=>r.url.endsWith('female.mp3')),false);
  assert.ok(h.nodes.every(n=>n.destination===h.context.destination));
});

test('stop immediately cancels all current and scheduled clips',async()=>{
  const h=harness();await h.player.play(['work','round','n3'],'male');
  h.player.stop();
  assert.ok(h.nodes.every(n=>n.stopped===1&&n.disconnected===1));
  h.player.stop();assert.ok(h.nodes.every(n=>n.stopped===1));
});

test('stopping during a download prevents a late phase announcement but keeps the downloaded cache',async()=>{
  const gate=deferred();const h=harness({assetResponse:()=>gate.promise});
  const pending=h.player.play(['work'],'male');await flush();
  h.player.stop();gate.resolve(h.assetResponse);
  assert.equal(await pending,false);assert.equal(h.nodes.length,0);
  assert.equal(h.player.state('male'),'ready');assert.equal(h.errors.length,0);
});

test('a new voice request supersedes a pending old voice and never falls back to it',async()=>{
  const gate=deferred();const h=harness({assetResponse:url=>url.endsWith('male.mp3')&&!url.endsWith('female.mp3')?gate.promise:h.assetResponse});
  const old=h.player.play(['work'],'male');await flush();
  const current=h.player.play(['rest'],'female');
  assert.equal(await current,true);assert.equal(h.nodes.length,1);assert.deepEqual(h.nodes[0].startArgs.slice(1),[1,1]);
  gate.resolve(h.assetResponse);assert.equal(await old,false);assert.equal(h.nodes.length,1);
});

test('starting a new announcement stops the previous queue',async()=>{
  const h=harness();await h.player.play(['work','round'],'male');
  const oldNodes=[...h.nodes];await h.player.play(['rest'],'female');
  assert.ok(oldNodes.every(n=>n.stopped===1));assert.equal(h.nodes.at(-1).stopped,0);
});

test('download errors report once, do not reject play, and allow a later retry',async()=>{
  let offline=true;
  const h=harness({assetResponse:()=>offline?{ok:false}:h.assetResponse});
  assert.equal(await h.player.play(['work'],'male'),false);
  assert.equal(h.errors.length,1);assert.equal(h.errors[0].voice,'male');assert.equal(h.player.state('male'),'error');
  offline=false;assert.equal(await h.player.play(['work'],'male'),true);
  assert.equal(h.player.state('male'),'ready');assert.equal(h.errors.length,1);
});

test('decode errors reject explicit load and permit a retry, while stale failures stay silent',async()=>{
  let broken=true;const h=harness({decodeFailure:()=>broken});
  await assert.rejects(h.player.load('male'),/decode failed/);assert.equal(h.errors.length,1);
  broken=false;await h.player.load('male');assert.equal(h.player.state('male'),'ready');
  const gate=deferred();const stale=harness({assetResponse:()=>gate.promise});
  const request=stale.player.load('female');await flush();stale.player.stop();gate.reject(Error('old request'));
  await assert.rejects(request,/old request/);assert.equal(stale.errors.length,0);
});

test('invalid clip bounds or a cross-origin sprite fail before any playback',async()=>{
  for(const definition of [
    {url:'audio/male.mp3',clips:{work:[9.9,1]}},
    {url:'https://other.test/male.mp3',clips:{work:[0,1]}},
    {url:'audio/male.mp3',clips:{work:[-1,1]}},
    {url:'audio/male.mp3',clips:{work:[0,0]}}
  ]){
    const h=harness({manifest:{version:1,voices:{male:definition}}});
    assert.equal(await h.player.play(['work'],'male'),false);assert.equal(h.nodes.length,0);assert.equal(h.errors.length,1);
  }
});

test('MP3 end padding tolerance is clipped to decoded duration',async()=>{
  const h=harness({manifest:{version:1,voices:{male:{url:'audio/male.mp3',clips:{work:[9,1.06]}}}}});
  assert.equal(await h.player.play(['work'],'male'),true);assert.deepEqual(h.nodes[0].startArgs.slice(1),[9,1]);
});

test('missing clips fail the whole announcement before any partial speech',async()=>{
  const h=harness();assert.equal(await h.player.play(['work','n100'],'male'),false);
  assert.equal(h.nodes.length,0);assert.match(h.errors[0].error.message,/no está incluido/);
});

test('suspended audio needs a new user gesture rather than automatic late resumption',async()=>{
  const h=harness({suspended:true});assert.equal(await h.player.play(['work'],'male'),false);
  assert.equal(h.nodes.length,0);assert.match(h.errors[0].error.message,/Probar voz/);
  h.context.state='running';assert.equal(await h.player.play(['work'],'male'),true);
});

test('callback-style WebKit decoding and failing UI callbacks do not break playback',async()=>{
  const h=harness({callbackDecode:true,callbackThrows:true});
  assert.equal(await h.player.play(['work'],'male'),true);assert.equal(h.nodes.length,1);
});

test('a cached sprite waits for the gesture resume Promise captured when play was invoked',async()=>{
  const gate=deferred();let activation=gate.promise;
  const h=harness({activation:()=>activation});await h.player.load('male');
  h.context.state='suspended';
  const pending=h.player.play(['work'],'male');await flush();
  assert.equal(h.nodes.length,0);assert.equal(h.errors.length,0);
  // A later gesture must not replace the activation this call captured.
  activation=Promise.resolve();await flush();assert.equal(h.nodes.length,0);
  h.context.state='running';gate.resolve();
  assert.equal(await pending,true);assert.equal(h.nodes.length,1);
});

test('stop during context activation prevents playback when that activation eventually resolves',async()=>{
  const gate=deferred();const h=harness({activation:()=>gate.promise});
  await h.player.load('male');h.context.state='suspended';
  const pending=h.player.play(['work'],'male');await flush();h.player.stop();
  h.context.state='running';gate.resolve();
  assert.equal(await pending,false);assert.equal(h.nodes.length,0);assert.equal(h.errors.length,0);
});

test('a rejected context activation reports the current request without playing any clips',async()=>{
  const gate=deferred();const h=harness({activation:()=>gate.promise});
  const pending=h.player.play(['work'],'male');await flush();gate.reject(Error('activation failed'));
  assert.equal(await pending,false);assert.equal(h.nodes.length,0);
  assert.equal(h.errors.length,1);assert.match(h.errors[0].error.message,/activation failed/);
});
