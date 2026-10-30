const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const make=(options={})=>E.createSession({qnh:1013,letter:'BRAVO',aircraftIndex:0,routeIndex:0,...options});
const send=(state,text)=>E.processMessage(state.aircraft.radio+', '+text,state);
function accepted(state,text){const r=send(state,text);assert.equal(r.ok,true,r.message||text);return r;}
function atIAF(options={}){let s=make(options);s=accepted(s,'RADAR CONTACT').state;return accepted(s,'CLEARED DIRECT ERASU').state;}
function onILS(options={}){let s=atIAF(options);s=accepted(s,`DESCEND ALTITUDE 4000 QNH ${s.qnh}`).state;s=accepted(s,'TURN LEFT HEADING 210').state;return accepted(s,'CLEARED FOR ILS APPROACH RUNWAY 24, REPORT ESTABLISHED').state;}

test('published Czech transition-level boundaries are exact, including 1013/1014',()=>{
  for(const [q,fl] of [[970,80],[977,80],[978,70],[1013,70],[1014,60],[1050,60],[1051,50]])assert.equal(E.transitionLevel(q),fl);
});
test('all 85 LKPR PR points and all nine TMA components are present with valid coordinates',()=>{
  assert.equal(Object.values(E.DATA.points).filter(p=>p.kind==='rnav').length,85);
  assert.equal(E.DATA.tma.length,9);
  for(const area of E.DATA.tma){assert.ok(area.points.length>=4,area.name);for(const [lat,lon] of area.points){assert.ok(lat>49&&lat<51,area.name);assert.ok(lon>12&&lon<16,area.name);}}
  for(const route of E.DATA.routes)for(const name of [...route.points,route.entry])assert.ok(E.DATA.points[name],name);
  assert.ok(E.DATA.ctr.length>15&&E.DATA.ctr.length<150);
  for(const [lat,lon] of E.DATA.ctr)assert.ok(lat>49.98&&lat<50.24&&lon>14.02&&lon<14.57,'CTR vertices and sampled arcs must remain inside the published lateral envelope');
});
test('a complete arrival can be flown with independent decisions and no exact heading solution',()=>{
  let s=make();
  for(const text of ['RADAR CONTACT','DESCEND FLIGHT LEVEL 100','CLEARED DIRECT ERASU','DESCEND ALTITUDE 4000 QNH 1013','TURN LEFT HEADING 205','CLEARED FOR ILS APPROACH RUNWAY 24 REPORT ESTABLISHED'])s=accepted(s,text).state;
  assert.equal(s.aircraft.established,true);
  const r=accepted(s,'CONTACT RUZYNE TOWER 134.560');assert.match(r.readback,/134\.560/);assert.equal(r.state.aircraft.complete,true);assert.equal(r.state.completed,1);
});
test('independent command order does not change the navigation or altitude result',()=>{
  const s=atIAF();
  const x=accepted(s,'TURN LEFT HEADING 210 DESCEND ALTITUDE 4000 QNH 1013').state;
  const y=accepted(s,'QNH 1013 DESCEND TO 4000 FEET TURN LEFT HEADING 210').state;
  assert.deepEqual(x.aircraft,y.aircraft);
});
test('vertical and lateral instructions can also be issued in separate transmissions',()=>{
  let s=atIAF();s=accepted(s,'TURN LEFT HEADING 215').state;s=accepted(s,'QNH 1013').state;s=accepted(s,'DESCEND ALTITUDE 4000').state;
  assert.equal(s.aircraft.heading,215);assert.deepEqual(s.aircraft.level,{kind:'alt',value:4000});
});
test('case, comma and spacing do not affect phrase recognition',()=>{
  const r=E.processMessage('  lufthansa 618, RADAR contact;  descend flight level 100. ',make());assert.equal(r.ok,true);assert.equal(r.state.aircraft.level.value,100);
});
test('FL70 is typed without a leading zero, while a heading retains all three digits',()=>{
  assert.equal(send(make(),'DESCEND FLIGHT LEVEL 70').ok,true);
  assert.equal(send(make(),'DESCEND FLIGHT LEVEL 070').category,'phraseology');
  assert.equal(send(make(),'FLY HEADING 070').ok,true);
  assert.equal(send(make(),'FLY HEADING 70').category,'phraseology');
});
test('a flight level below the published transition level is a context issue',()=>{
  assert.equal(send(make({qnh:1013}),'DESCEND FLIGHT LEVEL 60').category,'context');
  assert.equal(send(make({qnh:1014}),'DESCEND FLIGHT LEVEL 60').ok,true);
});
test('descent across the transition level requires correct QNH, in either command order',()=>{
  assert.equal(send(make(),'DESCEND ALTITUDE 4000').category,'context');
  assert.equal(send(make(),'DESCEND ALTITUDE 4000 QNH 1013').ok,true);
  assert.equal(send(make(),'QNH 1013 DESCEND TO 4000 FEET').ok,true);
  assert.equal(send(make(),'QNH 1020 DESCEND ALTITUDE 4000').category,'context');
});
test('no part of a rejected mixed transmission mutates the original state',()=>{
  const s=make(),before=JSON.stringify(s);
  const r=send(s,'RADAR CONTACT DESCEND FLIGHT LEVEL 100 BANANA');
  assert.equal(r.ok,false);assert.equal(JSON.stringify(s),before);assert.equal(s.aircraft.identified,false);
});
test('unknown text and radio shorthand are not silently ignored',()=>{
  for(const command of ['TURN LEFT HEADING 210 PLEASE','DCT ERASU','DESCEND FL70','CLEARED FOR ILS','RADAR CONTACT I LIKE TURTLES'])assert.equal(send(make(),command).ok,false,command);
});
test('an unknown fix is distinguishable from incorrect grammar',()=>{const r=send(make(),'CLEARED DIRECT ZZZZZ');assert.equal(r.category,'context');});
test('the short DIRECT [TO] instruction from II/7.5 is a valid alternative',()=>{
  for(const command of ['DIRECT ERASU','DIRECT TO ERASU','PROCEED DIRECT TO ERASU'])assert.equal(send(make(),command).ok,true,command);
});
test('unsupported conditional and holding constructions are not called phraseology errors',()=>{
  for(const command of ['HOLD AT ERASU','WHEN PASSING FLIGHT LEVEL 100 TURN LEFT HEADING 210','RADAR CONTACT DESCEND VIA STAR TO FLIGHT LEVEL 100'])assert.equal(send(make(),command).category,'unsupported');
});
test('callsign address must match the aircraft, and airline flight callsigns cannot be shortened',()=>{
  for(const name of ['DLH618','LUFTHANSA 18','AUSTRIAN 618'])assert.equal(E.processMessage(name+', RADAR CONTACT',make()).ok,false);
});
test('registration shortening is accepted only after reliable contact and is echoed by the pilot',()=>{
  let s=make({aircraftIndex:3});assert.equal(E.processMessage('OBC, RADAR CONTACT',s).ok,false);
  s=accepted(s,'RADAR CONTACT').state;
  const r=E.processMessage('OBC, DESCEND FLIGHT LEVEL 100',s);assert.equal(r.ok,true);assert.match(r.readback,/, OBC\.$/);
  const full=E.processMessage('OSCAR KILO ALFA BRAVO CHARLIE, DESCEND FLIGHT LEVEL 100',s);assert.equal(full.ok,true);
});
test('readback repeats the issued values and uses pilot wording',()=>{
  const r=accepted(atIAF(),'DESCEND TO 4000 FEET QNH 1013 TURN LEFT HEADING 225');
  assert.match(r.readback,/DESCENDING TO 4000 FEET/);assert.match(r.readback,/QNH 1013/);assert.match(r.readback,/LEFT HEADING 225/);
});
test('STANDBY has no pilot readback, while SAY AGAIN repeats the last pilot transmission',()=>{
  let s=make();s.lastPilot=E.initialCall(s);
  const standby=accepted(s,'STANDBY');assert.equal(standby.readback,'');assert.deepEqual(standby.state.aircraft.pos,s.aircraft.pos);
  const repeat=accepted(s,'SAY AGAIN');assert.equal(repeat.readback,s.lastPilot);assert.deepEqual(repeat.state.aircraft.pos,s.aircraft.pos);
});
test('SAY AGAIN cannot hide a combined new clearance behind a repeated pilot message',()=>{assert.equal(send(make(),'SAY AGAIN DESCEND FLIGHT LEVEL 100').category,'context');});
test('an ILS clearance alone never teleports an aircraft from FL150 onto final',()=>{
  const r=accepted(atIAF(),'CLEARED ILS APPROACH RUNWAY 24');assert.equal(r.state.aircraft.approachCleared,true);assert.equal(r.state.aircraft.established,false);
});
test('the approach clearance may omit the runway when its identity is unambiguous (II/3.2)',()=>{
  let s=atIAF();s=accepted(s,'DESCEND ALTITUDE 4000 QNH 1013').state;
  assert.equal(accepted(s,'CLEARED FOR ILS APPROACH').state.aircraft.established,true);
});
test('an opposite vector is accepted as phraseology but does not establish the aircraft',()=>{
  let s=atIAF();s=accepted(s,'DESCEND ALTITUDE 4000 QNH 1013').state;s=accepted(s,'TURN RIGHT HEADING 060').state;
  const r=accepted(s,'CLEARED ILS APPROACH RUNWAY 24');assert.equal(r.state.aircraft.established,false);
  assert.equal(accepted(r.state,'TURN LEFT HEADING 220').state.aircraft.established,true);
});
test('a procedural approach from a real IAF is allowed without a forced vector instruction',()=>{
  let s=atIAF();s=accepted(s,'DESCEND ALTITUDE 4000 QNH 1013').state;
  assert.equal(accepted(s,'CLEARED ILS APPROACH RUNWAY 24').state.aircraft.established,true);
});
test('new vectors after establishment invalidate the established flag',()=>{
  const s=onILS();assert.equal(s.aircraft.established,true);
  const r=accepted(s,'TURN LEFT HEADING 090');assert.equal(r.state.aircraft.established,false);assert.equal(r.state.aircraft.approachCleared,false);
});
test('tower transfer uses the published channel and requires the established report',()=>{
  assert.equal(send(atIAF(),'CONTACT RUZYNE TOWER 134.560').category,'context');
  assert.equal(send(onILS(),'CONTACT RUZYNE TOWER 118.310').category,'context');
  assert.equal(send(onILS(),'CONTACT RUZYNE TOWER 134.56').category,'phraseology');
  assert.equal(accepted(onILS(),'CONTACT RUZYNE TOWER 134.560').state.aircraft.complete,true);
});
test('new arrivals keep the session ATIS/QNH and have a new flight and route',()=>{
  const s=onILS({qnh:1020}),n=E.nextFlight(s);assert.equal(n.qnh,s.qnh);assert.deepEqual(n.atis,s.atis);assert.notEqual(n.aircraft.label,s.aircraft.label);assert.notEqual(n.aircraft.route.name,s.aircraft.route.name);assert.equal(n.aircraft.identified,false);assert.equal(n.aircraft.established,false);
});
test('all four actual STAR routes support the complete training flow',()=>{
  for(let routeIndex=0;routeIndex<E.DATA.routes.length;routeIndex++){
    let s=make({routeIndex,qnh:1020});s=accepted(s,'RADAR CONTACT').state;s=accepted(s,'CLEARED DIRECT '+s.aircraft.route.iaf).state;
    s=accepted(s,'DESCEND ALTITUDE 4000 QNH 1020').state;s=accepted(s,'CLEARED FOR ILS APPROACH RUNWAY 24').state;
    assert.equal(s.aircraft.established,true,s.aircraft.route.name);assert.equal(accepted(s,'CONTACT RUZYNE TOWER 134.560').state.aircraft.complete,true);
  }
});
