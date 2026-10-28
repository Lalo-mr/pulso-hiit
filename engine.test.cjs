const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const base = {name:'Test',mode:'tabata',prepare:5,work:20,rest:10,rounds:2,cycles:2,cycleRest:60,cooldown:30,lap:20};
test('timeline has no final round rest; cycle recovery replaces it',()=>{
 const p=E.buildPhases(base);
 assert.deepEqual(p.map(x=>x.kind),['prepare','work','rest','work','cycleRest','work','rest','work','cooldown']);
 assert.equal(E.totalDuration(base),195);
 assert.equal(p.reduce((s,p)=>s+p.duration,0),E.totalDuration(base));
});
test('rounds mode ignores cycles and cycle recovery',()=>{
 const w={...base,mode:'rounds'};
 assert.equal(E.totalDuration(w),85);
 assert.equal(E.buildPhases(w).filter(p=>p.kind==='work').length,2);
 assert.equal(E.buildPhases(w).some(p=>p.kind==='cycleRest'),false);
});
test('zero times never create empty or infinite phases',()=>{
 const w={...base,prepare:0,rest:0,cycleRest:0,cooldown:0};
 assert.deepEqual(E.buildPhases(w).map(p=>p.kind),['work','work','work','work']);
 const c=new E.Clock(E.buildPhases(w));c.resume(1000);
 assert.equal(c.snapshot(81000).done,true);
});
test('clock catches up across several intervals without accumulating tick drift',()=>{
 const c=new E.Clock(E.buildPhases(base));c.resume(10000);
 const s=c.snapshot(110000);
 assert.equal(s.phase.kind,'cycleRest');
 assert.equal(s.remaining,15);
 assert.equal(c.snapshot(205000).done,true);
});
test('pause/resume preserves fractional time and excludes paused duration',()=>{
 const c=new E.Clock(E.buildPhases(base));c.resume(0);c.pause(1500);
 assert.equal(c.snapshot(20000).remaining,3.5);c.resume(20000);
 assert.equal(c.snapshot(21500).remaining,2);
 c.resume(22000);assert.equal(c.snapshot(22500).remaining,1);
});
test('skip jumps exactly to next phase while preserving running or paused state',()=>{
 const c=new E.Clock(E.buildPhases(base));c.resume(0);
 assert.equal(c.skip(1000).phase.kind,'work');
 assert.equal(c.snapshot(2000).remaining,19);
 c.pause(2000);assert.equal(c.skip(5000).phase.kind,'rest');
 assert.equal(c.running,false);assert.equal(c.snapshot(100000).remaining,10);
});
test('validation rejects invalid numeric input and excessive session length',()=>{
 assert.throws(()=>E.validate({...base,work:0}));
 assert.throws(()=>E.validate({...base,rounds:1.5}));
 assert.throws(()=>E.validate({...base,rest:NaN}));
 assert.throws(()=>E.validate({...base,name:' '}));
 assert.throws(()=>E.validate({...base,work:3600,rounds:100,cycles:100}));
 assert.equal(E.validate({...base,rest:0}).rest,0);
});
test('format supports long sessions and never yields negative time',()=>{
 assert.equal(E.format(0),'00:00');assert.equal(E.format(-1),'00:00');
 assert.equal(E.format(59.01),'01:00');assert.equal(E.format(3661),'1:01:01');
});


test('history caps suspended catchup at the scheduled end and subtracts skipped time',()=>{
 assert.equal(E.recordedDuration(900,195),195);
 assert.equal(E.recordedDuration(900,195,40),155);
 assert.equal(E.recordedDuration(60,195,40),60);
 assert.equal(E.recordedDuration(0,195,195),0);
});
test('native limits accept 60 minute fields, 100 rounds and four hours exactly',()=>{
 assert.equal(E.validate({...base,prepare:0,work:3600,rest:0,rounds:4,cycles:1,cycleRest:0,cooldown:0}).work,3600);
 assert.equal(E.validate({...base,prepare:0,work:1,rest:0,rounds:100,cycles:1,cycleRest:0,cooldown:0}).rounds,100);
 assert.throws(()=>E.validate({...base,work:3601}));
 assert.throws(()=>E.validate({...base,rounds:101}));
});
test('reference Tabata matches the native 34:45 duration',()=>{
 const reference={...base,prepare:5,work:40,rest:20,rounds:8,cycles:4,cycleRest:60,cooldown:60};
 assert.equal(E.totalDuration(reference),2085);
 assert.equal(E.buildPhases(reference).reduce((sum,p)=>sum+p.duration,0),2085);
 assert.equal(E.format(E.totalDuration(reference)),'34:45');
});
