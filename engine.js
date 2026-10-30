/* Phraseology Lab — deterministic, entirely local parsing and snapshot engine. */
(function (root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./data.js') : root.AIP_DATA);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhraseologyEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA) {
  'use strict';
  const NATO = ['ALFA','BRAVO','CHARLIE','DELTA','ECHO','FOXTROT','GOLF','HOTEL','INDIA','JULIETT','KILO','LIMA','MIKE','NOVEMBER','OSCAR','PAPA','QUEBEC','ROMEO','SIERRA','TANGO','UNIFORM','VICTOR','WHISKEY','X-RAY','YANKEE','ZULU'];
  const AIRCRAFT = [
    { label:'DLH618', radio:'LUFTHANSA 618', type:'A320', origin:'EDDF', category:'M' },
    { label:'BAW854', radio:'SPEEDBIRD 854', type:'A20N', origin:'EGLL', category:'M' },
    { label:'AUA711', radio:'AUSTRIAN 711', type:'E195', origin:'LOWW', category:'M' },
    { label:'OKABC', radio:'OK-ABC', type:'C510', origin:'EDDM', category:'L', registration:'OKABC' },
    { label:'LOT527', radio:'LOT 527', type:'E190', origin:'EPWA', category:'M' },
    { label:'RYR284', radio:'RYANAIR 284', type:'B738', origin:'EIDW', category:'M' },
    { label:'TVS412', radio:'SKYTRAVEL 412', type:'B738', origin:'LEPA', category:'M' },
    { label:'OKJHZ', radio:'OK-JHZ', type:'C525', origin:'LOWI', category:'L', registration:'OKJHZ' },
  ];
  const copy = value => JSON.parse(JSON.stringify(value));
  const clean = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[\n\r,;:]/g,' ').replace(/\s+/g,' ').trim().replace(/[.!?]+$/,'').trim();
  const delta = (a,b) => ((a-b+540)%360)-180;
  const error = (category, message, ref, extra={}) => ({ok:false,category,message,ref,...extra});
  const ref = { level:'II/2.1, II/2.3', vector:'II/7.3', approach:'II/8.2', ident:'II/7.1', radio:'I/A.6', callsign:'I/D.1–2, I/E.2.5.1', number:'I/A.2', atis:'I/A.7 (CONFIRM), II/3.2 (INFORMATION)', speed:'II/7.6' };
  function transitionLevel(qnh) { return qnh>=1051 ? 50 : qnh>=1014 ? 60 : qnh>=978 ? 70 : 80; }
  function bearing(a,b) {
    const y=(b[1]-a[1])*Math.cos((a[0]+b[0])/2*Math.PI/180), x=b[0]-a[0];
    return (Math.atan2(y,x)*180/Math.PI- DATA.airport.magVar+360)%360;
  }
  function distance(a,b) { return Math.hypot((b[0]-a[0])*60,(b[1]-a[1])*60*Math.cos((a[0]+b[0])/2*Math.PI/180)); }
  function move(a,heading,nm) {
    const r=(heading+DATA.airport.magVar)*Math.PI/180;
    return [a[0]+Math.cos(r)*nm/60,a[1]+Math.sin(r)*nm/(60*Math.cos(a[0]*Math.PI/180))];
  }
  function makeAircraft(index,routeIndex) {
    const aircraft=copy(AIRCRAFT[index%AIRCRAFT.length]);
    const route=DATA.routes[routeIndex%DATA.routes.length];
    const pos=copy(DATA.points[route.entry].pos);
    return {...aircraft,route:copy(route),pos,trail:[],routeIndex:-1,heading:Math.round(bearing(pos,DATA.points[route.points[0]].pos))||169,
      level:{kind:'fl',value:150},clearedLevel:null,speed:280,mode:'route',target:route.points[0],identified:false,
      atisConfirmed:true,qnhIssued:false,approachCleared:false,reportEstablished:false,established:false,complete:false,shortCallsign:null,squawk:'4261'};
  }
  function createSession(options={}) {
    const rng=options.rng||Math.random;
    const qnh=options.qnh===undefined?Math.floor(rng()*76)+970:options.qnh;
    const letter=options.letter||NATO[Math.floor(rng()*NATO.length)];
    const routeIndex=options.routeIndex===undefined?0:options.routeIndex;
    const aircraftIndex=options.aircraftIndex===undefined?Math.floor(rng()*AIRCRAFT.length):options.aircraftIndex;
    const temp=7+Math.floor(rng()*15), wind=220+Math.floor(rng()*6)*10;
    return {version:1,qnh,tl:transitionLevel(qnh),atis:{letter,wind,windSpeed:6+Math.floor(rng()*12),visibility:10,cloud:'FEW',cloudBase:3000+Math.floor(rng()*5)*500,temp,dew:temp-3-Math.floor(rng()*5),time:options.time||'1200'},
      aircraft:makeAircraft(aircraftIndex,routeIndex),aircraftIndex,routeIndex,snapshot:1,flight:1,accepted:0,completed:0,lastReadback:'',lastPilot:'',lastCommands:[]};
  }
  function levelText(level) { return level.kind==='fl'?`FLIGHT LEVEL ${level.value}`:`${level.value} FEET`; }
  function levelLabel(level) { return level.kind==='fl'?`FL${level.value}`:`A${level.value}`; }
  function initialCall(state) {
    const a=state.aircraft;
    return `PRAHA RADAR, ${a.radio}, ${levelText(a.level)}, ${a.route.entry}, ${a.route.spoken} ARRIVAL, INFORMATION ${state.atis.letter}.`;
  }
  function nextFlight(state) {
    const n=copy(state);
    n.aircraftIndex=(n.aircraftIndex+1)%AIRCRAFT.length;n.routeIndex=(n.routeIndex+1)%DATA.routes.length;
    n.aircraft=makeAircraft(n.aircraftIndex,n.routeIndex);n.flight++;n.snapshot++;n.lastReadback='';n.lastCommands=[];
    n.lastPilot=initialCall(n);return n;
  }
  function callAliases(a) {
    if (!a.registration) {
      const [name,number]=a.radio.split(' ');
      return [{pattern:new RegExp('^'+name+' ?'+number+'(?= |$)'),short:false}];
    }
    const r=a.registration;
    const spell=letters=>letters.split('').map(c=>NATO[c.charCodeAt(0)-65]).join(' ');
    const forms=[{pattern:new RegExp('^'+r.slice(0,2)+'[- ]?'+r.slice(2)+'(?= |$)'),short:false},
      {pattern:new RegExp('^'+spell(r)+'(?= |$)'),short:false}];
    if(a.identified)for(let count=2;count<r.length-1;count++) {
      const short=r[0]+r.slice(-count);
      forms.push({pattern:new RegExp('^'+short[0]+'[- ]?'+short.slice(1)+'(?= |$)'),short:true,call:short});
      forms.push({pattern:new RegExp('^'+spell(short)+'(?= |$)'),short:true,call:short});
    }
    return forms;
  }
  function parseMessage(input,state) {
    const text=clean(input),a=state.aircraft;
    if(!text)return error('phraseology','Zpráva je prázdná. Kliknutím na label nebo strip vložíš callsign.',ref.callsign);
    let address=null;
    for(const alias of callAliases(a)) { const m=text.match(alias.pattern);if(m){address={...alias,length:m[0].length};break;} }
    if(!address) {
      if(a.registration&&!a.identified&&/^(?:O[- ]?[A-Z]{2,3}|OSCAR [A-Z]+ [A-Z]+)\b/.test(text)&&!text.startsWith('OK'))
        return error('context','Zkrácený callsign použij až po navázání spolehlivého spojení. Nejprve použij '+a.radio+'.',ref.callsign);
      return error('phraseology',`Začni radiotelefonním callsignem ${a.radio}. ${a.registration?'':'Provozovatel + označení letu se nezkracuje; radarová zkratka '+a.label+' není radiotelefonní oslovení.'}`,ref.callsign);
    }
    let rest=text.slice(address.length).trim();
    if(!rest)return error('phraseology','Za callsign doplň zprávu.',ref.callsign);
    const commands=[];
    const specs=[
      [/^SQUAWK IDENT/,m=>({type:'identRequest',ref:'II/9.3'})],
      [/^SQUAWK ([0-7]{4})/,m=>({type:'squawk',value:m[1],ref:'II/9.2'})],
      [/^(RADAR CONTACT|IDENTIFIED)/,m=>({type:'identify',ref:ref.ident})],
      [/^CONFIRM (?:YOU HAVE )?INFORMATION ([A-Z-]+)/,m=>({type:'confirmAtis',value:m[1],ref:ref.atis})],
      [/^INFORMATION ([A-Z-]+)(?: (?:IS )?(?:CURRENT|CORRECT))?/,m=>({type:'atis',value:m[1],ref:ref.atis})],
      [/^QNH (\d{3,4})(?: HECTOPASCALS)?/,m=>({type:'qnh',value:+m[1],ref:ref.level})],
      [/^TRANSITION LEVEL (\d{1,3})/,m=>({type:'tl',value:+m[1],raw:m[1],ref:'ENR 1.7.4.5'})],
      [/^(CLIMB|DESCEND)(?: TO)? FLIGHT LEVEL (\d{1,3})/,m=>({type:'level',verb:m[1],kind:'fl',value:+m[2],raw:m[2],ref:ref.level})],
      [/^(CLIMB|DESCEND)(?: TO)? (ALTITUDE )?(\d{3,5})( FEET)?/,m=>({type:'level',verb:m[1],kind:'alt',value:+m[3],typed:!!(m[2]||m[4]),ref:ref.level})],
      [/^MAINTAIN(?: ALTITUDE)? (\d{3,5}) FEET UNTIL GLIDE PATH INTERCEPTION/,m=>({type:'level',verb:'MAINTAIN',kind:'alt',value:+m[1],typed:true,glide:true,ref:ref.approach})],
      [/^MAINTAIN FLIGHT LEVEL (\d{1,3})/,m=>({type:'level',verb:'MAINTAIN',kind:'fl',value:+m[1],raw:m[1],ref:ref.level})],
      [/^(MAINTAIN|REDUCE SPEED TO|INCREASE SPEED TO) (\d{2,3}) KNOTS(?: (OR GREATER|OR LESS))?/,m=>({type:'speed',verb:m[1],value:+m[2],limit:m[3]||'',ref:ref.speed})],
      [/^MAINTAIN (ALTITUDE )?(\d{3,5})( FEET)?/,m=>({type:'level',verb:'MAINTAIN',kind:'alt',value:+m[2],typed:!!(m[1]||m[3]),ref:ref.level})],
      [/^TURN (LEFT|RIGHT) HEADING (\d{3})(?: TO INTERCEPT(?: (?:THE )?LOCALIZER)?)?/,m=>({type:'heading',direction:m[1],value:+m[2],ref:ref.vector})],
      [/^TURN (LEFT|RIGHT) (\d{1,3}) DEGREES/,m=>({type:'relativeHeading',direction:m[1],value:+m[2],ref:ref.vector})],
      [/^FLY HEADING (\d{3})/,m=>({type:'heading',value:+m[1],ref:ref.vector})],
      [/^CONTINUE PRESENT HEADING/,m=>({type:'presentHeading',ref:ref.vector})],
      [/^CONTINUE HEADING (\d{3})/,m=>({type:'heading',value:+m[1],ref:ref.vector})],
      [/^(?:CLEARED DIRECT|PROCEED DIRECT(?: TO)?|DIRECT(?: TO)?) ([A-Z][A-Z0-9]{1,6})/,m=>({type:'direct',value:m[1],ref:'II/3.2, II/7.5'})],
      [/^CLEARED (?:FOR )?ILS APPROACH(?: RUNWAY (\d{2}))?/,m=>({type:'approach',runway:m[1]||'24',ref:'II/3.2, II/8.2'})],
      [/^VECTORING FOR ILS APPROACH(?: RUNWAY (\d{2}))?/,m=>({type:'vectoring',runway:m[1]||'24',ref:'II/8.1'})],
      [/^EXPECT ILS APPROACH(?: RUNWAY (\d{2}))?/,m=>({type:'expectApproach',runway:m[1]||'24',ref:'II/3.2'})],
      [/^INTERCEPT (?:THE )?LOCALIZER(?: RUNWAY (\d{2}))?/,m=>({type:'intercept',runway:m[1]||'24',ref:ref.approach})],
      [/^REPORT ESTABLISHED(?: ON (?:THE )?LOCALIZER)?/,m=>({type:'reportEstablished',ref:ref.approach})],
      [/^REPORT (REACHING|LEAVING|PASSING) FLIGHT LEVEL (\d{1,3})/,m=>({type:'reportLevel',event:m[1],kind:'fl',value:+m[2],raw:m[2],ref:ref.level})],
      [/^REPORT (REACHING|LEAVING|PASSING) (?:ALTITUDE )?(\d{3,5}) FEET/,m=>({type:'reportLevel',event:m[1],kind:'alt',value:+m[2],ref:ref.level})],
      [/^RESUME NORMAL SPEED/,m=>({type:'normalSpeed',ref:ref.speed})],
      [/^CONTACT (RUZYNE TOWER|PRAHA RADAR|RUZYNE RADAR) (\d{3}\.\d{3})/,m=>({type:'contact',unit:m[1],value:m[2],ref:ref.radio})],
      [/^SAY AGAIN/,m=>({type:'sayAgain',ref:'I/A.7'})],
      [/^READ BACK/,m=>({type:'readBack',ref:'I/A.7'})],
      [/^STANDBY/,m=>({type:'standby',ref:'I/A.7'})],
      [/^ROGER/,m=>({type:'roger',ref:'I/A.7'})],
    ];
    while(rest) {
      if(commands.length&&rest.startsWith('AND '))rest=rest.slice(4);
      let found=false;
      for(const [pattern,build] of specs) {
        const m=rest.match(pattern);
        if(!m|| (rest[m[0].length]&&rest[m[0].length]!==' '))continue;
        const command=build(m);command.text=m[0];commands.push(command);rest=rest.slice(m[0].length).trim();found=true;
        if(command.type==='identify') {
          const pos=rest.match(/^(?:OVER )?([A-Z][A-Z0-9]{2,5})(?= |$)/);
          if(pos&&DATA.points[pos[1]]) {command.position=pos[1];rest=rest.slice(pos[0].length).trim();}
        }
        break;
      }
      if(!found) {
        if(/^(?:HOLD|CLIMB VIA|DESCEND VIA|CONTINUE CLIMB|CONTINUE DESCENT|STOP CLIMB|STOP DESCENT|CORRECTION|DISREGARD|CANCEL|RESUME OWN NAVIGATION|LEAVE |DO NOT EXCEED|REDUCE SPEED BY|INCREASE SPEED BY|WHEN |AFTER |AT |NOT ABOVE|NOT BELOW)/.test(rest))
          return error('unsupported',`Tuto konstrukci první příletový scénář zatím neumí: „${rest}“. Zpráva se nepočítá jako chyba frazeologie.`,null);
        if(/^(?:TURN (?:LEFT|RIGHT) HEADING|FLY HEADING|CONTINUE HEADING)/.test(rest))
          return error('phraseology','Heading piš třemi číslicemi: TURN LEFT HEADING 090. Rozsah je 001–360.',ref.vector);
        if(/^DCT\b/.test(rest))return error('phraseology','Pro direct použij DIRECT (bod), CLEARED DIRECT (bod) nebo PROCEED DIRECT (bod). DCT je zápis do tratě.','II/7.5');
        if(/^CLEARED(?: FOR)? ILS/.test(rest))return error('phraseology','Úplný vzor je CLEARED [FOR] ILS APPROACH RUNWAY 24.',ref.approach);
        if(/^CONTACT/.test(rest))return error('phraseology','Uveď stanoviště i celý kanál: CONTACT RUZYNE TOWER 134.560.',ref.radio);
        if(/\b(?:FL\d+|HDG|FT)\b/.test(rest))return error('phraseology','V rádiové zprávě napiš FLIGHT LEVEL, HEADING nebo FEET; radarové zkratky FL, HDG a FT zde nepoužíváme.',ref.number);
        return error('phraseology',`Nerozpoznaná část: „${rest}“. Ověř formulaci v přehledu frází (F1). Zbytek zprávy nebyl proveden.`,null);
      }
    }
    for(const c of commands) {
      if(c.raw&&c.raw.length>1&&c.raw.startsWith('0'))return error('phraseology',`Letovou hladinu piš bez úvodní nuly: FLIGHT LEVEL ${c.value}, nikoli ${c.raw}.`,ref.number);
      if(c.type==='level'&&c.kind==='alt'&&!c.typed)return error('phraseology','U výšky uveď ALTITUDE nebo FEET: DESCEND ALTITUDE 4000 / DESCEND TO 4000 FEET.',ref.level);
      if(['heading','relativeHeading'].includes(c.type)&&(c.value<1||c.value>360))return error('phraseology','Heading musí být 001 až 360; 000 zde nepoužíváme.',ref.vector);
      if(['atis','confirmAtis'].includes(c.type)) {
        if(c.value.length===1&&/[A-Z]/.test(c.value))c.value=NATO[c.value.charCodeAt(0)-65];
        if(!NATO.includes(c.value))return error('phraseology','Označení ATIS piš kódovým písmenem nebo podle ICAO abecedy, např. INFORMATION BRAVO.',ref.atis);
      }
    }
    if(commands.length>12)return error('context','Rozděl takto dlouhou zprávu do několika vysílání.',null);
    return {ok:true,commands,address,text};
  }
  function processMessage(input,state) {
    const parsed=parseMessage(input,state);if(!parsed.ok)return parsed;
    const {commands}=parsed,old=state.aircraft;
    if(old.complete)return error('context','Letadlo už je na spojení s věží. Pokračuj dalším příletem.',ref.radio);
    if(commands.length>1&&commands.some(c=>['sayAgain','readBack','standby'].includes(c.type)))return error('context','SAY AGAIN, READ BACK a STANDBY odešli samostatně; v tomto scénáři je nekombinuj s novým povolením.', 'I/A.7');
    const levels=commands.filter(c=>c.type==='level');
    const horizontals=commands.filter(c=>['heading','relativeHeading','direct','presentHeading','intercept'].includes(c.type));
    if(levels.length>1||horizontals.length>1)return error('context','Zpráva obsahuje více různých pokynů pro stejnou osu. V tomto scénáři je vydej samostatně; podmíněné pokyny zatím nepodporuje.',null);
    const qs=commands.filter(c=>c.type==='qnh'),qnhReady=old.qnhIssued||qs.some(c=>c.value===state.qnh);
    if(qs.some(c=>c.value!==state.qnh))return error('context',`QNH ve zprávě nesouhlasí s aktuálním ATIS (${state.qnh}). Formulace je rozpoznaná; oprav hodnotu.`, 'ENR 1.7.3, 1.7.4');
    for(const c of commands) {
      if(c.type==='direct'&&!DATA.points[c.value])return error('context',`Bod ${c.value} není v načtených datech AIP. Formulace direct je rozpoznaná.`,c.ref);
      if(c.type==='tl'&&c.value!==state.tl)return error('context',`Při QNH ${state.qnh} je podle tabulky převodní hladina FL${state.tl}.`,'ENR 1.7.4.5');
      if(c.type==='level') {
        if(c.kind==='fl'&&(c.value<state.tl||c.value>300))return error('context',`V tomto příletu je nejnižší použitelná FL${state.tl}. Při klesání pod ni použij ALTITUDE / FEET a letištní QNH.`, 'ENR 1.7.2.5, 1.7.4.5');
        if(c.kind==='alt'&&(c.value<2000||c.value>5000))return error('context','Příletový scénář podporuje výšky 2000–5000 ft. Vyšší hladiny zadávej jako FLIGHT LEVEL. To je omezení scénáře, ne hodnocení samotné fráze.',c.ref);
        if(c.kind==='alt'&&!qnhReady)return error('context',`Při přechodu na altitude předej QNH ${state.qnh}; může být v téže zprávě před klesáním i za ním.`, 'ENR 1.7.3, 1.7.4');
        const before=old.level.kind==='fl'?old.level.value*100+(state.qnh-1013.25)*27:old.level.value;
        const after=c.kind==='fl'?c.value*100+(state.qnh-1013.25)*27:c.value;
        if((c.verb==='DESCEND'&&after>before+100)||(c.verb==='CLIMB'&&after<before-100))return error('context',`Pokyn ${c.verb} míří opačným vertikálním směrem. Aktuálně ${levelText(old.level)}. Fráze je rozpoznaná.`,c.ref);
      }
      if(c.type==='speed'&&(c.value<100||c.value>350))return error('context','Tento přílet podporuje rychlosti 100–350 kt.',c.ref);
      if(c.runway&&c.runway!=='24')return error('context','V této verzi je v používání RWY 24.',c.ref);
      if(c.type==='contact') {
        const correct={'RUZYNE TOWER':DATA.airport.tower,'PRAHA RADAR':DATA.airport.approach,'RUZYNE RADAR':DATA.airport.director}[c.unit];
        if(c.value!==correct)return error('context',`${c.unit} má v tomto scénáři kanál ${correct}. Formulace CONTACT je rozpoznaná.`,'LKPR AD 2.18');
        if(c.unit==='RUZYNE TOWER'&&!old.established)return error('context','Letadlo ještě neohlásilo usazení na ILS. Předání na TWR je závěrem tohoto scénáře.',ref.approach);
      }
      if(['atis','confirmAtis'].includes(c.type)&&c.value!==state.atis.letter)return error('context',`Aktuální ATIS je ${state.atis.letter}.`,c.ref);
    }
    const n=copy(state),a=n.aircraft,read=[],events=[],notes=[];
    let navigation=false,movement=false,repeat=null,ackOnly=false;
    a.trail.push(copy(a.pos));if(a.trail.length>18)a.trail.shift();
    if(parsed.address.short)a.shortCallsign=parsed.address.call;
    const pilotCall=a.shortCallsign||a.radio;
    for(const c of commands) {
      switch(c.type) {
        case 'identify':a.identified=true;ackOnly=true;movement=true;break;
        case 'identRequest':read.push('IDENT');break;
        case 'squawk':a.squawk=c.value;read.push(`SQUAWK ${c.value}`);break;
        case 'atis':case 'confirmAtis':a.atisConfirmed=true;read.push(`INFORMATION ${c.value}`);break;
        case 'qnh':a.qnhIssued=true;read.push(`QNH ${c.value}`);break;
        case 'tl':read.push(`TRANSITION LEVEL ${c.value}`);break;
        case 'level':
          a.level={kind:c.kind,value:c.value};a.clearedLevel=copy(a.level);movement=true;
          read.push(`${c.verb==='MAINTAIN'?'MAINTAINING':c.verb==='CLIMB'?'CLIMBING TO':'DESCENDING TO'} ${levelText(a.level)}${c.glide?' UNTIL GLIDE PATH INTERCEPTION':''}`);break;
        case 'speed':a.speed=c.value;read.push(`${c.verb==='MAINTAIN'?'MAINTAINING':c.verb.startsWith('REDUCE')?'REDUCING SPEED TO':'INCREASING SPEED TO'} ${c.value} KNOTS${c.limit?' '+c.limit:''}`);movement=true;break;
        case 'normalSpeed':a.speed=a.level.kind==='alt'?210:280;read.push('RESUMING NORMAL SPEED');break;
        case 'direct':
          if(a.established){a.established=false;a.approachCleared=false;}
          a.mode='direct';a.target=c.value;a.heading=Math.round(bearing(a.pos,DATA.points[c.value].pos))||360;a.pos=copy(DATA.points[c.value].pos);
          const idx=a.route.points.indexOf(c.value);if(idx>=0)a.routeIndex=idx;
          read.push(`DIRECT ${c.value}`);navigation=true;break;
        case 'heading':case 'relativeHeading':case 'presentHeading':
          if(a.established){a.established=false;a.approachCleared=false;}
          a.heading=c.type==='relativeHeading'?((a.heading+(c.direction==='LEFT'?-c.value:c.value)+360)%360||360):c.type==='heading'?c.value:a.heading;
          a.mode='vector';a.target=null;a.pos=move(a.pos,a.heading,4);navigation=true;
          read.push(c.type==='relativeHeading'?`${c.direction} ${c.value} DEGREES`:`${c.direction?c.direction+' ':''}HEADING ${String(a.heading).padStart(3,'0')}`);
          if(Math.abs(delta(a.heading,240))>110&&distance(a.pos,DATA.airport.pos)<30)notes.push('Heading míří od příletového směru RWY 24. Pokyn je frazeologicky přijat; situace zůstává na vektorech.');break;
        case 'intercept':a.mode='vector';a.heading=240;read.push('INTERCEPTING LOCALIZER RUNWAY 24');navigation=true;break;
        case 'vectoring':case 'expectApproach':ackOnly=true;break;
        case 'approach':a.approachCleared=true;read.push('CLEARED ILS APPROACH RUNWAY 24');movement=true;break;
        case 'reportEstablished':a.reportEstablished=true;read.push('WILCO');break;
        case 'reportLevel':a.reportLevel={kind:c.kind,value:c.value,event:c.event};read.push('WILCO');break;
        case 'contact':
          read.push(`${c.unit} ${c.value}`);
          if(c.unit==='RUZYNE TOWER'){a.complete=true;n.completed++;events.push({kind:'system',text:`${a.label} předáno na RUZYNĚ TOWER · 134.560.`});}
          else events.push({kind:'pilot',text:`${c.unit}, ${pilotCall}, ${levelText(a.level)}, INFORMATION ${n.atis.letter}.`});break;
        case 'sayAgain':repeat=state.lastPilot||initialCall(state);break;
        case 'readBack':repeat=state.lastReadback||state.lastPilot||initialCall(state);break;
        case 'standby':case 'roger':ackOnly=true;break;
      }
    }
    if(movement&&!navigation&&!a.established) {
      if(a.mode==='route') {
        a.routeIndex=Math.min(a.routeIndex+1,a.route.points.length-1);
        const point=a.route.points[a.routeIndex];a.pos=copy(DATA.points[point].pos);a.target=point;
        const next=a.route.points[a.routeIndex+1];if(next)a.heading=Math.round(bearing(a.pos,DATA.points[next].pos))||360;
        else a.heading=60;
      }else if(a.mode==='vector')a.pos=move(a.pos,a.heading,3);
    }
    const ready=a.identified&&a.atisConfirmed&&a.approachCleared&&a.level.kind==='alt'&&a.qnhIssued&&distance(a.pos,DATA.airport.threshold24)<40&&(a.mode!=='vector'||Math.abs(delta(a.heading,240))<=100);
    if(ready&&!a.established) {
      a.established=true;a.mode='ils';a.target='RWY24';a.heading=240;
      a.pos=move(DATA.airport.threshold24,60,8.7);a.speed=Math.min(a.speed,180);
      events.unshift({kind:'pilot',text:`${pilotCall}, ESTABLISHED ILS RUNWAY 24.`});
    }
    if(a.reportLevel&&a.level.kind===a.reportLevel.kind&&a.level.value===a.reportLevel.value&&a.reportLevel.event==='REACHING') {
      events.push({kind:'pilot',text:`${pilotCall}, REACHING ${levelText(a.level)}.`});a.reportLevel=null;
    }
    const readback=repeat|| (read.length?`${read.join(', ')}, ${pilotCall}.`:commands.every(c=>c.type==='standby')?'':`${pilotCall}.`);
    n.snapshot++;n.accepted++;n.lastCommands=commands.map(c=>c.type);
    if(read.length)n.lastReadback=readback;
    n.lastPilot=[...events].reverse().find(e=>e.kind==='pilot')?.text||readback||state.lastPilot;
    return {ok:true,state:n,readback,events,notes,commands:copy(commands),phraseology:true};
  }
  function phase(state) {
    const a=state.aircraft;
    return a.complete?'TWR':a.established?'ESTABLISHED':a.mode==='vector'?'VECTORS':a.identified&&DATA.points[a.target]?.iaf?'IAF':a.identified?'STAR':'ACC';
  }
  return {DATA,NATO,AIRCRAFT,createSession,nextFlight,parseMessage,processMessage,initialCall,transitionLevel,levelText,levelLabel,bearing,distance,move,phase,clean,copy};
});
