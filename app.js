(function () {
  'use strict';
  const E=window.PhraseologyEngine,D=E.DATA,$=id=>document.getElementById(id),SVG='http://www.w3.org/2000/svg';
  const KEY='prg-phraseology-v1';
  let stored={};try{stored=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){/* Storage is optional. */}
  const prefs={tma:true,fixes:true,rnav:true,star:true,traffic:true,...stored.prefs};
  const stats={accepted:0,errors:0,flights:0,...stored.stats};
  let state,newSessionCount=0,log=[],undo=[],inputs=[],inputIndex=0,selected=true,referenceTab='phrases';
  let view={center:[0,0],range:100,manual:false},viewport={w:1000,h:680};
  const origin=D.airport.pos,cos=Math.cos(origin[0]*Math.PI/180);
  const local=p=>[(p[1]-origin[1])*60*cos,(p[0]-origin[0])*60];
  const project=p=>{const t=local(p),scale=viewport.w/view.range;return [viewport.w/2+(t[0]-view.center[0])*scale,viewport.h/2-(t[1]-view.center[1])*scale];};
  const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function save(){try{localStorage.setItem(KEY,JSON.stringify({prefs,stats}));}catch(_){/* Private mode and file:// remain playable. */}}
  function utcTime(){const n=new Date();return String(n.getUTCHours()).padStart(2,'0')+String(Math.floor(n.getUTCMinutes()/5)*5).padStart(2,'0');}
  function startSession(){
    newSessionCount++;
    state=E.createSession({time:utcTime()});state.lastPilot=E.initialCall(state);
    log=[];undo=[];inputs=[];inputIndex=0;
    addLog('system',`Relace ${String(newSessionCount).padStart(2,'0')} · ${state.atis.letter} · QNH ${state.qnh} · RWY 24`);
    addLog('pilot',state.lastPilot);
    $('transmission').value='';view.manual=false;fitView();render();
    feedback('Volíš postup. Pořadí nezávislých pokynů je na tobě.','neutral');
  }
  function setText(id,text){$(id).textContent=text;}
  function addLog(kind,text,source){if(!text)return;log.push({kind,text,source,snapshot:state.snapshot,callsign:state.aircraft.label});if(log.length>160)log.shift();}
  function feedback(message,kind='neutral',source){
    const el=$('feedback');el.className='feedback'+(kind==='neutral'?'':' '+kind);el.replaceChildren();
    const icon=document.createElement('span');icon.className='feedback-icon';icon.textContent=kind==='error'?'!':kind==='success'?'✓':kind==='warning'?'△':'↳';
    const text=document.createElement('span');text.textContent=message;
    if(source){text.append(' ');const button=document.createElement('button');button.type='button';button.textContent='↗ '+source;button.onclick=()=>openReference('sources');text.append(button);}
    el.append(icon,text);
  }
  function prefill(){
    if(state.aircraft.complete)return;
    const el=$('transmission'),call=state.aircraft.shortCallsign||state.aircraft.radio;
    const prefix=E.parseMessage(el.value,state);
    if(!el.value.trim()||!prefix.ok) {
      // Preserve an in-progress command when the field already starts with this aircraft.
      const text=E.clean(el.value),a=state.aircraft;
      if(!(text.startsWith(a.radio)||a.registration&&text.replace(/[- ]/g,'').startsWith(a.registration)))el.value=call+', ';
    }
    selected=true;el.focus();el.setSelectionRange(el.value.length,el.value.length);
  }
  function renderAtis(){
    const a=state.atis;
    setText('atis-letter',a.letter[0]);setText('atis-qnh',state.qnh);setText('atis-tl','FL'+state.tl);
    setText('atis-wind',`${a.wind}° / ${String(a.windSpeed).padStart(2,'0')} KT`);
    setText('atis-weather',`10 KM+ · ${a.cloud}${String(a.cloudBase/100).padStart(3,'0')} · ${a.temp}/${a.dew}°`);
    setText('atis-full',`RUZYNĚ INFORMATION ${a.letter}. TIME ${a.time} UTC. ILS APPROACH. RUNWAY IN USE 24. TRANSITION LEVEL ${state.tl}. WIND ${a.wind} DEGREES ${a.windSpeed} KNOTS. VISIBILITY 10 KILOMETRES OR MORE. CLOUD ${a.cloud} ${a.cloudBase} FEET. TEMPERATURE ${a.temp}. DEW POINT ${a.dew}. QNH ${state.qnh}. NO SIGNIFICANT CHANGE. ACKNOWLEDGE RECEIPT OF INFORMATION ${a.letter} ON FIRST CONTACT.`);
    $('atis-letter').title=a.letter;
  }
  function renderLog(){
    const el=$('radio-log'),atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<80;
    el.replaceChildren();
    for(const item of log){
      const message=document.createElement('article');message.className='radio-message '+item.kind;
      const meta=document.createElement('div');meta.className='message-meta';
      const role=document.createElement('b');role.textContent=item.kind==='controller'?'ATC':item.kind==='pilot'?item.callsign:item.kind==='invalid'?'NEODESLÁNO':'SESSION';
      const tag=document.createElement('span');tag.textContent='S'+String(item.snapshot).padStart(3,'0');meta.append(role,tag);
      const p=document.createElement('p');p.textContent=item.text;message.append(meta,p);
      if(item.source){const source=document.createElement('span');source.className='source-tag';source.textContent=item.source;message.append(source);}
      el.append(message);
    }
    if(atBottom||log.length<5)el.scrollTop=el.scrollHeight;
  }
  function renderStrip(){
    const a=state.aircraft,phase=E.phase(state);
    setText('strip-call',a.label);setText('strip-type',a.type);setText('strip-wake',a.category);setText('strip-squawk',a.squawk);
    setText('strip-origin',a.origin);setText('strip-level',E.levelLabel(a.level));
    setText('strip-cleared',a.clearedLevel?'CFL '+E.levelLabel(a.clearedLevel):'CFL —');
    setText('strip-route',a.route.name);setText('strip-target',a.mode==='vector'?'HDG '+String(a.heading).padStart(3,'0'):a.established?'ILS 24':(a.target||'—'));
    setText('strip-ident',a.identified?'● IDENTIFIED':'○ UNIDENTIFIED');$('strip-ident').className=a.identified?'yes':'';
    setText('strip-atis',(a.atisConfirmed?'● ':'○ ')+'ATIS '+state.atis.letter[0]);$('strip-atis').className=a.atisConfirmed?'yes':'';
    setText('strip-ils',a.established?'● ILS EST':a.approachCleared?'● ILS CLR':'○ ILS —');$('strip-ils').className=a.approachCleared?'yes':'';
    setText('strip-phase',a.complete?'TRANSFERRED':phase==='ACC'?'FIRST CONTACT':phase);
    setText('phase-label',phase);setText('sector',phase==='ACC'?'PRAHA RADAR':'PRAHA APP');
    setText('snapshot-label','SNAPSHOT '+String(state.snapshot).padStart(3,'0'));setText('flight-number','ARRIVAL '+String(state.flight).padStart(2,'0'));
    setText('session-number','SESSION '+String(newSessionCount).padStart(2,'0'));setText('exchange-count',String(state.accepted).padStart(2,'0')+' EXCHANGES');
    const accuracy=stats.accepted+stats.errors?Math.round(stats.accepted/(stats.accepted+stats.errors)*100):null;
    setText('accuracy',`${state.accepted} PŘIJATÝCH ZPRÁV${accuracy===null?'':' · '+accuracy+' % FRAZEOLOGIE'}`);
    $('completion').hidden=!a.complete;$('transmission').disabled=a.complete;document.querySelector('.transmit-button').disabled=a.complete;
    $('undo').disabled=!undo.length;
  }
  function render(){renderAtis();renderStrip();renderMap();renderLog();save();}
  function fitView(){
    if(!state)return;
    const a=state.aircraft,phase=E.phase(state);
    const relevant=[a.pos,D.airport.pos];
    if(['ACC','STAR'].includes(phase))a.route.points.slice(Math.max(0,a.routeIndex)).forEach(n=>relevant.push(D.points[n].pos));
    else relevant.push(D.points[a.route.iaf].pos,E.move(D.airport.threshold24,60,18));
    const positions=relevant.map(local),xs=positions.map(p=>p[0]),ys=positions.map(p=>p[1]);
    const x0=Math.min(...xs)-5,x1=Math.max(...xs)+5,y0=Math.min(...ys)-5,y1=Math.max(...ys)+5;
    const rect=$('radar-wrap').getBoundingClientRect(),ratio=(rect.width||1000)/(rect.height||680);
    view.center=[(x0+x1)/2,(y0+y1)/2];view.range=Math.min(200,Math.max(phase==='ACC'?90:phase==='STAR'?85:48,(x1-x0)*1.2,(y1-y0)*ratio*1.2));
  }
  function svg(name,attrs={},text){const el=document.createElementNS(SVG,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);if(text!==undefined)el.textContent=text;return el;}
  function line(group,a,b,cls,extra={}){const x=project(a),y=project(b);group.append(svg('line',{x1:x[0],y1:x[1],x2:y[0],y2:y[1],class:cls,...extra}));}
  function path(positions){return positions.map((p,i)=>{const [x,y]=project(p);return (i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2);}).join(' ');}
  function renderMap(){
    const surface=$('radar'),rect=surface.getBoundingClientRect();viewport={w:rect.width||1000,h:rect.height||680};surface.setAttribute('viewBox',`0 0 ${viewport.w} ${viewport.h}`);
    surface.querySelectorAll('g').forEach(el=>el.remove());
    const map=svg('g',{'aria-hidden':'true'});surface.append(map);
    const scale=viewport.w/view.range;
    // A fixed geographic projection: all layers and traffic share the same scale.
    for(let lat=49;lat<=52;lat+=.25)line(map,[lat,11],[lat,17],'map-grid');
    for(let lon=11;lon<=17;lon+=.5)line(map,[48,lon],[52,lon],'map-grid');
    const airport=project(D.airport.pos);
    for(const radius of [10,20,30,40,50,60])map.append(svg('circle',{cx:airport[0],cy:airport[1],r:radius*scale,class:'map-ring'}));
    if(prefs.tma){
      D.tma.forEach(area=>{
        const poly=svg('path',{d:path(area.points)+'Z',class:'tma-area'+(area.conditional?' conditional':'')});poly.append(svg('title',{},area.name+(area.conditional?' · podmíněná aktivace dle AIP':'')));map.append(poly);
      });
      if(D.ctr.length)map.append(svg('path',{d:path(D.ctr)+'Z',class:'ctr-area'}));
      const names=[['I',[50.011,14.19]],['II',[49.875,14.28]],['III',[50.025,14.79]],['IV',[49.78,14.63]],['V',[50.47,14.16]],['VI',[49.80,13.59]],['VII',[49.70,14.75]],['VIII',[50.20,14.50]],['IX',[50.57,14.68]]];
      names.forEach(([name,pos])=>{const p=project(pos);map.append(svg('text',{x:p[0],y:p[1],class:'tma-name'},'TMA '+name));});
    }
    if(prefs.star)D.routes.forEach(route=>{
      map.append(svg('path',{d:path(route.points.map(n=>D.points[n].pos)),class:'star-route'+(route.name===state.aircraft.route.name?' selected':'')}));
    });
    // Actual runway axis: 240° magnetic / 245° true; 5 NM distance marks.
    const threshold=D.airport.threshold24,outer=E.move(threshold,60,24);
    line(map,threshold,outer,'ils-axis');
    for(const d of [5,10,15,20]){const p=E.move(threshold,60,d);line(map,E.move(p,150,.35),E.move(p,330,.35),'ils-tick');}
    D.airport.runways.forEach(r=>line(map,r.a,r.b,'runway'));
    map.append(svg('text',{x:airport[0]-13,y:airport[1]+19,class:'airport-name'},'LKPR'));
    const current=new Set(state.aircraft.route.points);current.add(state.aircraft.target);
    const reserved=[];
    const points=Object.entries(D.points).sort((a,b)=>{
      const priority=([name,p])=>(current.has(name)?100:0)+(p.iaf?50:0)+(p.kind==='vor'?25:p.kind==='fix'?10:0);
      return priority(b)-priority(a);
    });
    points.forEach(([name,point])=>{
      if(!prefs.fixes||point.kind==='rnav'&&!prefs.rnav)return;
      const [x,y]=project(point.pos);if(x<10||x>viewport.w-10||y<14||y>viewport.h-15)return;
      const group=svg('g',{class:'point-group'+(current.has(name)?' active':'')+(point.iaf?' iaf':''),'data-fix':name});
      if(point.kind==='vor')group.append(svg('path',{d:`M${x-3} ${y-3}h6v6h-6Z M${x-2} ${y-2}l4 4 M${x-2} ${y+2}l4-4`,class:'point-symbol'}));
      else group.append(svg('path',{d:`M${x} ${y-3}l3.1 5.5h-6.2Z`,class:'point-symbol'}));
      const width=name.length*5.6,box={x:x+5,y:y-10,w:width+2,h:12};
      const collides=reserved.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
      if(!collides||current.has(name)){
        group.append(svg('text',{x:x+5,y:y-2,class:'point-name'},name));reserved.push(box);
      }
      group.append(svg('circle',{cx:x,cy:y,r:7,class:'point-hit'}));
      group.append(svg('title',{},`${name}${point.iaf?' · IAF':''}\n${point.pos[0].toFixed(5)}N ${point.pos[1].toFixed(5)}E`));map.append(group);
    });
    if(prefs.traffic)renderPassive(map);
    const a=state.aircraft,p=project(a.pos),track=svg('g');surface.append(track);
    a.trail.slice(-6).forEach(pos=>{const t=project(pos);track.append(svg('rect',{x:t[0]-1,y:t[1]-1,width:2,height:2,class:'track-trail'}));});
    line(track,a.pos,E.move(a.pos,a.heading,a.speed/30),'track-vector');
    const symbol=svg('path',{d:`M${p[0]} ${p[1]-4}l4 4-4 4-4-4Z`,class:'track-symbol'});track.append(symbol);
    const labelWidth=143,labelHeight=63;
    let lx=p[0]+24,ly=p[1]-37;if(lx+labelWidth>viewport.w-12)lx=p[0]-labelWidth-24;
    ly=Math.max(18,Math.min(viewport.h-labelHeight-20,ly));lx=Math.max(10,Math.min(viewport.w-labelWidth-10,lx));
    const anchor=lx>p[0]?lx:lx+labelWidth;
    track.append(svg('path',{d:`M${p[0]} ${p[1]}L${anchor} ${ly+17}`,class:'track-link'}));
    const label=svg('g',{class:'track-label',role:'button',tabindex:'0','aria-label':`Vybrat ${a.radio} a vložit callsign`});
    label.append(svg('rect',{x:lx,y:ly,width:labelWidth,height:labelHeight,rx:2,class:'label-bg'}));
    label.append(svg('text',{x:lx+8,y:ly+16,class:'track-call'},a.label));
    label.append(svg('text',{x:lx+8,y:ly+32,class:'track-alt'},`${E.levelLabel(a.level)}  ${a.clearedLevel?'→ '+E.levelLabel(a.clearedLevel):'→ —'}`));
    label.append(svg('text',{x:lx+8,y:ly+47,class:'track-data'},`${a.type}  GS${a.speed}  ${a.established?'ILS24':String(a.heading).padStart(3,'0')+'°'}`));
    label.append(svg('text',{x:lx+8,y:ly+58,class:'track-data',style:'font-size:8px;opacity:.65'},a.complete?'TWR 134.560':a.mode==='direct'?'DCT '+a.target:a.mode==='vector'?'RADAR VECTORS':a.route.name));
    label.addEventListener('click',prefill);label.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();prefill();}});track.append(label);
    setText('range-label',Math.round(view.range)+' NM');
    document.querySelector('.scale-bar').style.width=(10*scale)+'px';
  }
  function renderPassive(map){
    const t=(state.snapshot-1)%8;
    const traffic=[{id:'SAS761',pos:[50.39-t*.008,14.85-t*.012],heading:215,fl:'FL180',speed:330},{id:'AFR1382',pos:[49.96+t*.006,13.97+t*.017],heading:60,fl:'FL110',speed:250}];
    traffic.forEach(a=>{
      const p=project(a.pos);if(p[0]<10||p[0]>viewport.w-70||p[1]<50||p[1]>viewport.h-40)return;
      const g=svg('g',{class:'passive-track','aria-hidden':'true'});line(g,a.pos,E.move(a.pos,a.heading,a.speed/30),'track-vector');
      g.append(svg('path',{d:`M${p[0]-2.5} ${p[1]-2.5}h5v5h-5Z`,class:'track-symbol'}));
      g.append(svg('path',{d:`M${p[0]} ${p[1]}l16-17h55`,class:'track-link'}));
      g.append(svg('text',{x:p[0]+19,y:p[1]-20},a.id));g.append(svg('text',{x:p[0]+19,y:p[1]-8},a.fl+'  '+a.speed));
      g.append(svg('title',{},'Sekundární provoz · není na tvém spojení'));map.append(g);
    });
  }
  function transmit(event){
    event.preventDefault();const input=$('transmission'),message=input.value.trim();if(!message)return;
    const before=state,result=E.processMessage(message,state);
    inputs.push(message);if(inputs.length>50)inputs.shift();inputIndex=inputs.length;
    if(!result.ok){
      if(result.category==='phraseology')stats.errors++;
      feedback(result.message,result.category==='phraseology'?'error':'warning',result.ref);
      input.setAttribute('aria-invalid',result.category==='phraseology'?'true':'false');save();renderStrip();return;
    }
    undo.push({state:E.copy(state),log:E.copy(log),stats:{...stats}});if(undo.length>30)undo.shift();
    addLog('controller',message,result.commands.map(c=>c.ref).filter((r,i,a)=>a.indexOf(r)===i).join(' · '));
    state=result.state;stats.accepted++;if(state.aircraft.complete&&!before.aircraft.complete)stats.flights++;
    if(result.readback)addLog('pilot',result.readback);
    result.events.forEach(e=>addLog(e.kind,e.text));
    if(!view.manual&&(E.phase(before)!==E.phase(state)||result.commands.some(c=>['direct','approach'].includes(c.type))))fitView();
    input.value='';input.removeAttribute('aria-invalid');
    if(result.notes.length)feedback(result.notes.join(' '),'warning');
    else if(state.aircraft.complete)feedback('Přílet dokončen. Další letadlo dostane stejné podmínky a nový přílet.','success');
    else feedback(result.readback?'Zpráva přijata. Readback je v přepisu.':'Zpráva přijata. Na STANDBY posádka neodpovídá.','success');
    render();$('radio-log').scrollTop=$('radio-log').scrollHeight;
    if(!state.aircraft.complete)input.focus();
  }
  const phraseRows=[
    ['Identifikace','RADAR CONTACT [bod]<br>IDENTIFIED [bod]','II/7.1'],
    ['Odpovídač','SQUAWK 4261<br>SQUAWK IDENT','II/9.2–3'],
    ['Letová hladina','DESCEND [TO] FLIGHT LEVEL 100<br>CLIMB [TO] FLIGHT LEVEL 120','II/2.3'],
    ['Nadmořská výška','DESCEND [TO] ALTITUDE 4000<br>DESCEND TO 4000 FEET, QNH 1015','II/2.1, 2.3'],
    ['Udržování','MAINTAIN FLIGHT LEVEL 100<br>MAINTAIN 4000 FEET','II/2.3'],
    ['Direct','CLEARED DIRECT ERASU<br>PROCEED DIRECT RATEV<br>DIRECT [TO] ERASU','II/3.2, 7.5'],
    ['Vektorování','TURN LEFT HEADING 210<br>FLY HEADING 240<br>TURN RIGHT 30 DEGREES<br>CONTINUE PRESENT HEADING','II/7.3'],
    ['Rychlost','REDUCE SPEED TO 180 KNOTS<br>MAINTAIN 160 KNOTS<br>INCREASE SPEED TO 220 KNOTS<br>RESUME NORMAL SPEED','II/7.6'],
    ['Přiblížení','VECTORING FOR ILS APPROACH RUNWAY 24<br>CLEARED [FOR] ILS APPROACH [RUNWAY 24]<br>REPORT ESTABLISHED [ON LOCALIZER]<br>INTERCEPT LOCALIZER RUNWAY 24','II/3.2, 8.1–2'],
    ['Výška na přiblížení','MAINTAIN 4000 FEET UNTIL GLIDE PATH INTERCEPTION','II/8.2'],
    ['Hlášení hladiny','REPORT REACHING FLIGHT LEVEL 100<br>REPORT REACHING 4000 FEET','II/2.3'],
    ['Spojení','CONTACT RUZYNE TOWER 134.560<br>CONTACT PRAHA RADAR 127.580<br>CONTACT RUZYNE RADAR 119.010','I/A.6; AD 2.18'],
    ['ATIS','CONFIRM INFORMATION BRAVO<br>INFORMATION BRAVO','I/A.7; II/3.2'],
    ['Opakování','SAY AGAIN<br>READ BACK<br>ROGER<br>STANDBY','I/A.7'],
  ];
  function openReference(tab='phrases'){
    referenceTab=tab;
    for(const t of ['phrases','controls','sources'])$('tab-'+t).classList.toggle('active',t===tab);
    const el=$('dialog-body');
    if(tab==='phrases')el.innerHTML=`<p>Začni callsignem z labelu nebo stripu. Hranaté závorky označují volitelnou část; do zprávy je nepiš. Nezávislé pokyny můžeš spojit i přehodit.</p><table class="phrase-table"><tbody>${phraseRows.map(r=>`<tr><td>${r[0]}</td><td><code>${r[1]}</code></td><td>${r[2]}</td></tr>`).join('')}</tbody></table><p class="subnote">Čísla se zapisují číslicemi. FLIGHT LEVEL 70 bez úvodní nuly; HEADING 070 třemi číslicemi. Zápisy bez TO a tvar ALTITUDE 4000 jsou přijímané textové varianty podle zadání tohoto tréninku. Výslovnost čísel tato hra nezkouší.</p><p>U ATIS se spojuje standardní výraz CONFIRM s informací scénáře; nejde o samostatný doslovný vzor uvedený v tabulce předpisu. Posádka v prvním volání aktuální ATIS hlásí.</p>`;
    if(tab==='controls')el.innerHTML=`<h3>Radar stojí. Další krok je na tobě.</h3><p>Klikni na zelený label nebo letový strip. Do spodní řádky se vloží radiotelefonní callsign. Napiš zbytek zprávy anglicky a odešli ji Enterem. Posádka odpoví a situace přeskočí do dalšího snímku.</p><p>Heading a klesání můžeš vydat společně i zvlášť. Direct přesune letadlo k danému bodu. Vektor posune letadlo o několik mil daným směrem. Po povolení ILS v oblasti přiblížení, klesání na QNH a přibližném vektoru do směru příletu ohlásí letadlo usazení. Přesný zásah FAFu se nehodnotí.</p><h3>Klávesnice a mapa</h3><table class="phrase-table"><tbody><tr><td>Enter</td><td>Odeslat zprávu</td><td></td></tr><tr><td>Escape</td><td>Vymazat řádku / zavřít přehled</td><td></td></tr><tr><td>↑ / ↓</td><td>Historie zadaných zpráv</td><td></td></tr><tr><td>F1</td><td>Přehled frází</td><td></td></tr><tr><td>Tažení / kolečko</td><td>Posun / přiblížení radaru</td><td></td></tr><tr><td>⌖</td><td>Přizpůsobit mapu situaci</td><td></td></tr><tr><td>Kliknutí na bod</td><td>Vložit jeho název do zprávy</td><td></td></tr><tr><td>↶ Zpět</td><td>Vrátit poslední přijatou zprávu i její účinek</td><td></td></tr></tbody></table><h3>Volací znaky</h3><p>Provozovatel + označení letu se nezkracuje. Registrační znak můžeš po identifikaci zkrátit na první a nejméně poslední dva znaky (např. OK-ABC → OBC). Posádka pak odpovídá stejným zkrácením. Identifikace zde zároveň představuje navázání spolehlivého spojení; zaměnitelné registrace se negenerují.</p><h3>Co hra počítá</h3><p>Úspěšnost sleduje pouze rozpoznanou frazeologii. Nesprávné QNH, neznámý bod nebo nepodporovaná konstrukce nezhoršují procenta frazeologie. Zpráva se při odmítnutí neprovede ani částečně.</p><div class="stats-row"><div><strong>${stats.accepted}</strong><span>přijatých zpráv</span></div><div><strong>${stats.flights}</strong><span>dokončených příletů</span></div><div><strong>${stats.errors}</strong><span>chyb formulace</span></div></div>`;
    if(tab==='sources')el.innerHTML=`<h3>Podklady</h3><p>Frazeologie vychází z dodaného dokumentu <strong>L Frazeologie</strong>, zejména částí I/A, I/D–E, II/2, II/3 a II/7–9. Číselné údaje a dvě výslovně požadované textové varianty jsou normalizovány podle zadání hry; nejde o nácvik výslovnosti.</p><p>Geografická data byla načtena z AIP ČR dne <strong>30. 10. 2026</strong>. Obsahují ${Object.keys(D.points).length} bodů v oblasti Prahy a okolí, včetně všech 85 bodů PR z LKPR AD 2.22.7, devět částí TMA Praha, CTR Ruzyně a čtyři STAR pro RWY 24. Při překryvu se některé názvy skrývají; jejich značky zůstávají dostupné a přiblížení je zobrazí.</p><ul class="source-list">${D.sources.map(s=>`<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)}</a></li>`).join('')}</ul><h3>Převodní hladiny</h3><table class="phrase-table"><tbody><tr><td>QNH ≤ 977</td><td>FL80</td><td>ENR 1.7.4.5</td></tr><tr><td>978–1013</td><td>FL70</td><td></td></tr><tr><td>1014–1050</td><td>FL60</td><td></td></tr><tr><td>QNH ≥ 1051</td><td>FL50</td><td></td></tr></tbody></table><h3>Rozsah první verze</h3><p>ACC a APP obsluhuješ jako jeden zjednodušený sektor. Publikované STAR jsou vykresleny jako spojnice bodů, bez zatáčkových oblouků. Přívod od vstupního bodu ke STAR, vektory i skok na ILS jsou scénářové. TMA VIII je vyznačena přerušovaně, protože její aktivace je podmíněná. Sekundární provoz není na tvém spojení.</p><p>ATIS a lety jsou vymyšlené; meteorologická situace je po celou relaci stejná. Hra nehodnotí rozstupy, sekvenci, přesné nalétnutí osy ani všechny provozní postupy. Nepodporuje zatím holding, složité podmíněné instrukce, nouzové situace a jiné dráhy. Ruzyně Radar 119.010 je ve scénáři považován za dostupný.</p><p class="subnote">U každé zprávy se kontrolují celé rozpoznané konstrukce, nikoli jen přítomnost slov. Hra pokrývá vypsané vzory; obecnou platnost libovolné anglické ATC zprávy neumí posoudit.</p>`;
    if(!$('reference-dialog').open)$('reference-dialog').showModal();
  }
  $('radio-form').addEventListener('submit',transmit);
  $('flight-strip').addEventListener('click',prefill);
  $('clear-input').onclick=()=>{$('transmission').value='';$('transmission').focus();};
  $('help-button').onclick=()=>openReference('phrases');$('source-button').onclick=()=>openReference('sources');
  for(const tab of ['phrases','controls','sources'])$('tab-'+tab).onclick=()=>openReference(tab);
  $('close-dialog').onclick=()=>$('reference-dialog').close();
  $('reference-dialog').addEventListener('click',event=>{if(event.target===$('reference-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
  $('new-session').onclick=()=>{startSession();};
  $('next-flight').onclick=()=>{state=E.nextFlight(state);undo=[];addLog('system',`Přílet ${state.flight} · ${state.aircraft.route.name} · stejné letištní podmínky`);addLog('pilot',state.lastPilot);$('transmission').value='';view.manual=false;fitView();render();feedback('Nové letadlo je na spojení. Aktuální ATIS a QNH zůstávají stejné.');};
  $('undo').onclick=()=>{const previous=undo.pop();if(!previous)return;state=previous.state;log=previous.log;Object.assign(stats,previous.stats);$('transmission').value='';if(!view.manual)fitView();render();feedback('Poslední přijatá zpráva a její účinek byly vráceny.');$('transmission').focus();};
  for(const key of ['tma','fixes','rnav','star','traffic']){const el=$('layer-'+key);el.checked=!!prefs[key];el.onchange=()=>{prefs[key]=el.checked;renderMap();save();};}
  function zoom(factor){view.range=Math.min(240,Math.max(18,view.range*factor));view.manual=true;renderMap();}
  $('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);$('center-map').onclick=()=>{view.manual=false;fitView();renderMap();};
  const radar=$('radar');let drag=null;
  radar.addEventListener('pointerdown',e=>{if(e.target.closest('.track-label')||e.target.closest('[data-fix]'))return;drag={x:e.clientX,y:e.clientY,center:[...view.center]};radar.setPointerCapture(e.pointerId);radar.classList.add('panning');});
  radar.addEventListener('pointermove',e=>{if(!drag)return;const scale=viewport.w/view.range;view.center=[drag.center[0]-(e.clientX-drag.x)/scale,drag.center[1]+(e.clientY-drag.y)/scale];view.manual=true;renderMap();});
  function endDrag(){drag=null;radar.classList.remove('panning');}radar.addEventListener('pointerup',endDrag);radar.addEventListener('pointercancel',endDrag);
  radar.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.12:.89);},{passive:false});
  radar.addEventListener('click',e=>{const point=e.target.closest('[data-fix]');if(!point||state.aircraft.complete)return;prefill();const input=$('transmission');input.setRangeText(point.dataset.fix+' ',input.selectionStart,input.selectionEnd,'end');input.focus();});
  document.addEventListener('keydown',e=>{
    if(e.key==='F1'){e.preventDefault();openReference('phrases');return;}
    if(e.key==='Escape'&&!$('reference-dialog').open){$('transmission').value='';$('transmission').removeAttribute('aria-invalid');}
    if(e.target===$('transmission')&&['ArrowUp','ArrowDown'].includes(e.key)&&inputs.length){e.preventDefault();inputIndex=Math.max(0,Math.min(inputs.length,inputIndex+(e.key==='ArrowUp'?-1:1)));$('transmission').value=inputs[inputIndex]||'';}
  });
  new ResizeObserver(()=>{if(!state)return;if(!view.manual)fitView();renderMap();}).observe($('radar-wrap'));
  startSession();
})();
