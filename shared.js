/* ===== RAJGAR Ludo – shared engine: profile, coins, shop, codes, dice, sound, PWA ===== */
'use strict';
const RG = (() => {
  const KEY = 'rajgar-profile-v1';
  const FREE_AVATARS = ['🙂','😎','🦁','🐯','🐘','🦚'];

  const CATALOG = {
    dice: [
      { id:'classic', name:'Classic',       price:0 },
      { id:'numbers', name:'Numbers',       price:0 },
      { id:'wood',    name:'Sheesham Wood', price:150 },
      { id:'neon',    name:'Neon Night',    price:250 },
      { id:'ruby',    name:'Ruby',          premium:true },
      { id:'gold',    name:'Royal Gold',    premium:true },
      { id:'holi',    name:'Holi Rang',     code:true, premium:true },
      { id:'diwali',  name:'Diwali Diya',   code:true, premium:true },
    ],
    theme: [
      { id:'classic', name:'Emerald',       price:0 },
      { id:'night',   name:'Royal Night',   price:200 },
      { id:'sandal',  name:'Sandalwood',    price:200 },
      { id:'holi',    name:'Holi Festival', code:true, premium:true },
      { id:'diwali',  name:'Diwali Lights', code:true, premium:true },
    ],
    avatar: [
      ...FREE_AVATARS.map(a => ({ id:a, name:a, price:0 })),
      { id:'🦅', name:'🦅', price:150 },
      { id:'⚡', name:'⚡', price:150 },
      { id:'🐉', name:'🐉', premium:true },
      { id:'👑', name:'👑', premium:true },
    ],
    power: [
      { id:'lucky6', name:'Lucky Six', desc:'Your next roll is a guaranteed 6 (Ludo & Snakes, vs Computer)', price:40 },
    ],
  };

  /* RAJGAR Premium – Google Play Billing product IDs (create these in Play Console → Monetize).
     Prices shown come from Play; the ones below are only fallbacks for display. */
  /* Pricing: `offer` applies until offerEnds, then `regular`. `mrp` is the crossed-out price shown during the offer –
     keep it equal to the real regular price (showing a price nobody ever pays is a misleading reference price). */
  const PREMIUM = {
    trialDays: 90,
    offerEnds: '2028-03-31',
    /* Your purchase-check server (see rajgar-ludo-server/). Google refunds any purchase that is not
       acknowledged by a server within 3 days, so buying stays switched off until this is filled in. */
    verifyUrl: '',
    yearly:   { sku:'rajgar_premium_yearly',   label:'1 Year',   offer:4,  regular:9,  mrp:9,  per:'/ year', type:'subscription' },
    lifetime: { sku:'rajgar_premium_lifetime', label:'Lifetime', offer:19, regular:39, mrp:39, per:'once',   type:'onetime' },
    perks: ['All 👑 premium dice, themes & avatars', '2× coins on every win', '2× daily bonus + 1 free Lucky Six daily', 'Festival dice & themes included'],
  };

  /* Promo / festival codes. Stored as hashes so they are not readable at a glance.
     (Anyone determined can still find them – never use codes for anything that costs real money.) */
  const CODES = {
    '2fb8d0sm620': { label:'Holi pack unlocked! 🎨 +100 coins', coins:100, items:['dice:holi','theme:holi'] },        // HOLI
    '28eehetc72t': { label:'Diwali pack unlocked! 🪔 +100 coins', coins:100, items:['dice:diwali','theme:diwali'] }, // DIWALI
    '22vnn55ku42': { label:'+500 coins added! 🪙', coins:500 },                                                       // RAJGAR500
    '77x4egtrbm':  { label:'VIP: all premium items unlocked! 👑', all:true, power:{ lucky6:5 } },                     // GARAVIP
  };
  function hash(str, seed=7){
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i=0, ch; i<str.length; i++){ ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507); h1 ^= Math.imul(h2 ^ (h2>>>13), 3266489909);
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507); h2 ^= Math.imul(h1 ^ (h1>>>13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1>>>0)).toString(36);
  }

  /* ---------- profile ---------- */
  const k = (kind, id) => kind + ':' + id;
  const freeOwned = () => [
    ...CATALOG.dice.filter(i => !i.price && !i.code).map(i => k('dice', i.id)),
    ...CATALOG.theme.filter(i => !i.price && !i.code).map(i => k('theme', i.id)),
    ...FREE_AVATARS.map(a => k('avatar', a)),
  ];
  const DEF = () => ({
    v:1, name:'Player', avatar:'🙂', coins:100, owned:freeOwned(),
    equipped:{ dice:'classic', theme:'classic' }, power:{ lucky6:2 },
    stats:{ ludo:{p:0,w:0}, snakes:{p:0,w:0}, carrom:{p:0,w:0} },
    daily:{ last:'', streak:0 }, codes:[], sound:true, vibe:true, fast:false, volume:.7, soundStyle:'classic',
    firstRun:Date.now(), premium:{ kind:'', until:0 },
  });
  function load(){
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch(e){}
    const d = DEF();
    if (!s || typeof s !== 'object') return d;
    return { ...d, ...s,
      equipped:{ ...d.equipped, ...(s.equipped||{}) }, power:{ ...d.power, ...(s.power||{}) },
      stats:{ ...d.stats, ...(s.stats||{}) }, daily:{ ...d.daily, ...(s.daily||{}) },
      owned:Array.from(new Set([ ...d.owned, ...(s.owned||[]) ])), codes:s.codes||[],
      premium:{ ...d.premium, ...(s.premium||{}) }, firstRun:s.firstRun || d.firstRun };
  }
  let P = load();
  try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(P)); } catch(e){}

  /* ---------- premium state ---------- */
  const DAY = 864e5;
  const trialLeft = () => Math.max(0, Math.ceil((P.firstRun + PREMIUM.trialDays*DAY - Date.now()) / DAY));
  const paidPremium = () => P.premium.kind === 'lifetime' || P.premium.until > Date.now();
  const isPremium = () => paidPremium() || trialLeft() > 0;
  const listeners = [];
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(P)); } catch(e){} listeners.forEach(f => { try { f(P); } catch(e){} }); }
  const onChange = f => listeners.push(f);

  const item = (kind, id) => CATALOG[kind].find(x => x.id === id);
  const owns = (kind, id) => P.owned.includes(k(kind, id));
  const has = (kind, id) => { const it = item(kind, id); return owns(kind, id) || !!(it && it.premium && isPremium()); };
  function validateEquipped(){
    let changed = false;
    if (!has('dice', P.equipped.dice)){ P.equipped.dice = 'classic'; changed = true; }
    if (!has('theme', P.equipped.theme)){ P.equipped.theme = 'classic'; changed = true; }
    if (!has('avatar', P.avatar)){ P.avatar = '🙂'; changed = true; }
    if (changed) save();
  }
  validateEquipped();
  function buy(kind, id){
    const it = item(kind, id); if (!it) return { ok:false, msg:'Item not found' };
    if (kind === 'power'){
      if (P.coins < it.price) return { ok:false, msg:`Need ${it.price - P.coins} more coins` };
      P.coins -= it.price; P.power[id] = (P.power[id]||0) + 1; save();
      return { ok:true, msg:`${it.name} +1 (you have ${P.power[id]})` };
    }
    if (has(kind, id)) return { ok:true, msg:'Already yours' };
    if (it.premium && !it.price) return { ok:false, msg:it.code ? 'Included in Premium, or unlock with a festival code' : 'Included in RAJGAR Premium', premium:true };
    if (it.code) return { ok:false, msg:'Unlock this with a festival code' };
    if (P.coins < it.price) return { ok:false, msg:`Need ${it.price - P.coins} more coins` };
    P.coins -= it.price; P.owned.push(k(kind, id)); save();
    return { ok:true, msg:`Unlocked ${it.name}!` };
  }
  function equip(kind, id){
    if (!has(kind, id)) return false;
    if (kind === 'avatar') P.avatar = id; else P.equipped[kind] = id;
    save(); if (kind === 'theme') applyTheme();
    return true;
  }
  function addCoins(n){ P.coins = Math.max(0, P.coins + n); save(); }
  function winCoins(n){ const amt = isPremium() ? n*2 : n; addCoins(amt); return amt; }
  const speed = () => P.fast ? 2.2 : 1;
  function usePower(id){ if ((P.power[id]||0) <= 0) return false; P.power[id]--; save(); return true; }
  function recordGame(game, won){ const s = P.stats[game] || (P.stats[game] = {p:0,w:0}); s.p++; if (won) s.w++; save(); }
  function setName(n){ P.name = String(n||'').trim().slice(0,14) || 'Player'; save(); }
  function setPref(key, val){ P[key] = val; save(); }

  /* ---------- daily bonus ---------- */
  const dayKey = d => d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  const dailyAvailable = () => P.daily.last !== dayKey(new Date());
  function claimDaily(){
    if (!dailyAvailable()) return 0;
    const yest = dayKey(new Date(Date.now() - 864e5));
    P.daily.streak = P.daily.last === yest ? Math.min(7, P.daily.streak + 1) : 1;
    P.daily.last = dayKey(new Date());
    const amt = (20 + P.daily.streak * 10) * (isPremium() ? 2 : 1);
    P.coins += amt;
    if (isPremium()) P.power.lucky6 = (P.power.lucky6||0) + 1;
    save();
    return amt;
  }

  /* ---------- Google Play Billing (works only inside the Play Store app / TWA) ---------- */
  const PLAY = 'https://play.google.com/billing';
  let dgs = null;
  async function billingService(){
    if (dgs) return dgs;
    if (!('getDigitalGoodsService' in window)) return null;
    try { dgs = await window.getDigitalGoodsService(PLAY); } catch(e){ dgs = null; }
    return dgs;
  }
  const billingAvailable = async () => !!(await billingService());
  const offerActive = () => Date.now() <= new Date(PREMIUM.offerEnds + 'T23:59:59+05:30').getTime();
  const rupees = (v, cur='INR') => new Intl.NumberFormat('en-IN', { style:'currency', currency:cur, maximumFractionDigits:0 }).format(+v);
  /* Returns { yearly:{now, was, per, off}, lifetime:{...}, offer:bool, ends } – live prices from Play when available. */
  async function premiumPrices(){
    const on = offerActive();
    const mk = plan => {
      const c = PREMIUM[plan], now = on ? c.offer : c.regular;
      return { now:rupees(now), nowV:now, was: on && c.mrp > now ? rupees(c.mrp) : '', per:c.per,
               off: on && c.mrp > now ? Math.round(100 * (1 - now / c.mrp)) : 0 };
    };
    const out = { yearly:mk('yearly'), lifetime:mk('lifetime'), offer:on,
      ends:new Date(PREMIUM.offerEnds).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) };
    const s = await billingService(); if (!s) return out;
    try {
      const det = await s.getDetails([PREMIUM.yearly.sku, PREMIUM.lifetime.sku]);
      for (const d of det){
        const plan = d.itemId === PREMIUM.yearly.sku ? 'yearly' : d.itemId === PREMIUM.lifetime.sku ? 'lifetime' : null;
        if (!plan) continue;
        const live = d.price;   // the price Play will actually charge (set ₹4 / ₹19 as the real Play price, not as an offer)
        const o = out[plan], mrp = PREMIUM[plan].mrp;
        o.nowV = +live.value; o.now = rupees(live.value, live.currency);
        o.was = on && mrp > o.nowV ? rupees(mrp, live.currency) : '';
        o.off = o.was ? Math.round(100 * (1 - o.nowV / mrp)) : 0;
      }
    } catch(e){}
    return out;
  }
  function grant(sku, until){
    if (sku === PREMIUM.lifetime.sku) P.premium = { kind:'lifetime', until:0 };
    else if (sku === PREMIUM.yearly.sku && P.premium.kind !== 'lifetime')
      P.premium = { kind:'yearly', until: until || Date.now() + 366*DAY };
    save();
  }
  /* Server checks the purchase with Google and acknowledges it (without this Google refunds it after 3 days). */
  async function verify(sku, token){
    const r = await fetch(PREMIUM.verifyUrl, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ sku, token }) });
    if (!r.ok) throw new Error('verify ' + r.status);
    return r.json();                                       // { ok:true|false, until?:ms }
  }
  const buyingOpen = () => !!PREMIUM.verifyUrl;
  async function buyPremium(plan){
    const s = await billingService();
    if (!s) return { ok:false, msg:'Premium can be bought in the RAJGAR Ludo app from Google Play' };
    if (!buyingOpen()) return { ok:false, msg:'Premium purchase opens soon — enjoy your free trial!' };
    const sku = PREMIUM[plan].sku;
    let res;
    try {
      const req = new PaymentRequest([{ supportedMethods:PLAY, data:{ sku } }], { total:{ label:'Total', amount:{ currency:'INR', value:'0' } } });
      res = await req.show();
    } catch(e){ return { ok:false, msg:'Purchase cancelled' }; }
    try {
      const v = await verify(sku, res.details.purchaseToken);
      if (!v.ok){ await res.complete('fail'); return { ok:false, msg:'Google Play could not confirm the payment' }; }
      await res.complete('success');
      grant(sku, v.until);
      return { ok:true, msg:'Welcome to RAJGAR Premium! 👑' };
    } catch(e){
      try { await res.complete('success'); } catch(_){}
      grant(sku);                                          // paid; server unreachable – unlock now, launch re-check will acknowledge
      return { ok:true, msg:'Premium unlocked 👑 (confirmation will finish when online)' };
    }
  }
  /* On every launch: re-check purchases with Play + server (restores on a new phone, acknowledges pending ones, ends lapsed yearly plans). */
  async function restorePurchases(){
    const s = await billingService(); if (!s) return { ok:false, msg:'Open the Google Play version of the app to restore' };
    try {
      const list = await s.listPurchases();
      let found = false;
      for (const p of list){
        if (p.itemId !== PREMIUM.lifetime.sku && p.itemId !== PREMIUM.yearly.sku) continue;
        if (buyingOpen()){
          try { const v = await verify(p.itemId, p.purchaseToken); if (v.ok){ grant(p.itemId, v.until); found = true; } }
          catch(e){ grant(p.itemId); found = true; }       // offline: trust Play's local list for now
        } else { grant(p.itemId); found = true; }
      }
      if (!found && P.premium.kind === 'yearly'){ P.premium = { kind:'', until:0 }; save(); validateEquipped(); }
      return { ok:true, msg: paidPremium() ? 'Premium restored 👑' : 'No purchases found' };
    } catch(e){ return { ok:false, msg:'Could not reach Google Play' }; }
  }
  billingService().then(s => { if (s) restorePurchases(); });

  /* ---------- codes ---------- */
  function redeem(raw){
    const code = String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return { ok:false, msg:'Enter a code' };
    const hk = hash(code), r = CODES[hk];
    if (!r) return { ok:false, msg:'Invalid code' };
    if (P.codes.includes(hk)) return { ok:false, msg:'This code is already used on this phone' };
    P.codes.push(hk);
    if (r.coins) P.coins += r.coins;
    (r.items||[]).forEach(x => { if (!P.owned.includes(x)) P.owned.push(x); });
    if (r.all) for (const kind of ['dice','theme','avatar'])
      CATALOG[kind].forEach(it => { const x = k(kind, it.id); if (!P.owned.includes(x)) P.owned.push(x); });
    if (r.power) for (const id in r.power) P.power[id] = (P.power[id]||0) + r.power[id];
    save();
    return { ok:true, msg:r.label };
  }

  /* ---------- theme ---------- */
  function applyTheme(){
    document.documentElement.dataset.theme = P.equipped.theme;
    const m = document.querySelector('meta[name=theme-color]');
    if (m){ const c = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim(); if (c) m.content = c; }
  }

  /* ---------- sound & vibration ---------- */
  let ctx = null;
  const STYLES = { classic:'Classic', soft:'Soft', arcade:'Arcade' };
  function tone(freq, type, dur, delay=0, vol=.16){
    if (!P.sound || !(P.volume > 0)) return;
    const st = P.soundStyle;
    if (st === 'soft'){ type = 'sine'; vol *= .65; dur *= 1.2; }
    else if (st === 'arcade'){ type = 'square'; vol *= .55; freq *= 1.25; }
    vol *= P.volume * 1.4;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + dur);
    } catch(e){}
  }
  const sfx = {
    roll(){ tone(320,'square',.08); tone(260,'square',.08,.09); },
    land(){ tone(560,'sine',.14); },
    step(){ tone(700,'triangle',.05,0,.08); },
    open(){ tone(440,'sine',.1); tone(660,'sine',.12,.1); },
    capture(){ tone(500,'sawtooth',.12); tone(330,'sawtooth',.12,.12); tone(220,'sawtooth',.2,.24); },
    home(){ [523,659,784].forEach((f,i) => tone(f,'sine',.15,i*.1)); },
    win(){ [523,659,784,1047].forEach((f,i) => tone(f,'triangle',.25,i*.15)); },
    ladder(){ [392,494,587,698,784].forEach((f,i) => tone(f,'sine',.1,i*.07)); },
    snake(){ [600,500,400,300,220].forEach((f,i) => tone(f,'sawtooth',.1,i*.07,.1)); },
    hit(v=1){ tone(180 + 120*Math.min(1,v), 'triangle', .05, 0, .05 + .12*Math.min(1,v)); },
    pocket(){ tone(160,'sine',.18,0,.25); tone(110,'sine',.2,.05,.2); },
    coin(){ tone(988,'square',.08,0,.08); tone(1319,'square',.15,.08,.08); },
    error(){ tone(200,'square',.15,0,.1); },
  };
  /* Volume slider + sound style selector, mounted into any element */
  function mountSoundControls(el){
    if (!el) return;
    el.innerHTML = `
      <div class="label">Volume</div>
      <div class="vol-row"><span>🔈</span><input type="range" class="vol" min="0" max="100" aria-label="Volume"><span class="vol-v"></span></div>
      <div class="label">Sound style</div>
      <div class="seg snd-style" style="--n:3">${Object.entries(STYLES).map(([k,v]) => `<button data-s="${k}">${v}</button>`).join('')}</div>`;
    const vol = el.querySelector('.vol'), vv = el.querySelector('.vol-v');
    const paint = () => {
      vol.value = Math.round((P.sound ? P.volume : 0) * 100); vv.textContent = vol.value + '%';
      el.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === P.soundStyle));
    };
    vol.addEventListener('input', () => { P.volume = vol.value / 100; P.sound = P.volume > 0; vv.textContent = vol.value + '%'; save(); });
    vol.addEventListener('change', () => sfx.land());
    el.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => {
      P.soundStyle = b.dataset.s; if (!P.sound){ P.sound = true; if (!(P.volume > 0)) P.volume = .7; }
      save(); paint(); sfx.roll(); setTimeout(() => sfx.home(), 250);
    }));
    onChange(paint); paint();
  }
  function vibrate(ms){ if (!P.vibe) return; try { navigator.vibrate && navigator.vibrate(ms); } catch(e){} }

  /* ---------- wake lock (keep screen on while playing) ---------- */
  let wake = null, wantWake = false;
  async function keepAwake(on=true){
    wantWake = on;
    try {
      if (!on){ if (wake && !wake.released) await wake.release(); return; }
      if ('wakeLock' in navigator && document.visibilityState === 'visible' && (!wake || wake.released))
        wake = await navigator.wakeLock.request('screen');
    } catch(e){}
  }
  document.addEventListener('visibilitychange', () => { if (wantWake) keepAwake(true); });

  /* ---------- toast ---------- */
  let tEl = null, tTimer = null;
  function toast(msg, ms=1900){
    if (!tEl){ tEl = document.createElement('div'); tEl.className = 'toast'; tEl.setAttribute('role','status'); document.body.appendChild(tEl); }
    tEl.textContent = msg; tEl.classList.add('show');
    clearTimeout(tTimer); tTimer = setTimeout(() => tEl.classList.remove('show'), ms);
  }

  /* ---------- dice ---------- */
  const PIPS = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  const dieHTML = () => '<span class="p"></span>'.repeat(9) + '<span class="num"></span>';
  function setDie(el, v){
    const on = new Set(PIPS[v] || []);
    el.querySelectorAll('.p').forEach((sp,i) => sp.classList.toggle('on', on.has(i)));
    const n = el.querySelector('.num'); if (n) n.textContent = v || '';
  }
  function makeDie(el, skin){ el.innerHTML = dieHTML(); el.dataset.skin = skin || P.equipped.dice; setDie(el, 6); }
  function rand6(){
    try { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % 6) + 1; }
    catch(e){ return Math.floor(Math.random()*6) + 1; }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- header bindings (coins chip, sound button) ---------- */
  function bindHeader(){
    const paint = () => {
      document.querySelectorAll('[data-coins]').forEach(el => el.textContent = '🪙 ' + P.coins);
      document.querySelectorAll('[data-sound]').forEach(el => el.textContent = P.sound ? '🔊' : '🔇');
    };
    document.querySelectorAll('[data-sound]').forEach(el => el.addEventListener('click', () => { P.sound = !P.sound; save(); }));
    onChange(paint); paint();
  }

  /* ---------- PWA: service worker + install ---------- */
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferred = e;
    document.querySelectorAll('[data-install]').forEach(b => b.hidden = false);
  });
  window.addEventListener('appinstalled', () => {
    document.querySelectorAll('[data-install]').forEach(b => b.hidden = true);
    toast('Installed! Open RAJGAR Ludo from your home screen');
  });
  async function install(){
    if (!deferred){ toast('Use your browser menu → "Add to Home screen"'); return; }
    deferred.prompt(); try { await deferred.userChoice; } catch(e){}
    deferred = null; document.querySelectorAll('[data-install]').forEach(b => b.hidden = true);
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
    let had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (had) toast('App updated — the new version loads next time', 3500);
      had = true;
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  applyTheme();
  return {
    CATALOG, PREMIUM, get P(){ return P; }, save, onChange, item, has, buy, equip, addCoins, winCoins, usePower, recordGame,
    setName, setPref, dailyAvailable, claimDaily, redeem, applyTheme, tone, sfx, vibrate, keepAwake,
    toast, setDie, makeDie, rand6, sleep, bindHeader, install, speed, mountSoundControls,
    isPremium, paidPremium, trialLeft, billingAvailable, premiumPrices, buyPremium, restorePurchases,
  };
})();
