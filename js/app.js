/* English Skills Practice – vanilla SPA. No build step, no backend.
   Data comes from window.CSA_DATA (js/data-bundle.js) or, as a fallback, data/*.json via fetch. */
(function () {
  'use strict';

  // ---------- constants ----------
  const SKILLS = ['listening', 'speaking', 'reading', 'writing', 'idiom', 'collocation', 'phrasalVerb'];
  const SKILL_ICON = { listening: '🎧', speaking: '🗣️', reading: '📖', writing: '✍️', idiom: '💡', collocation: '🔗', phrasalVerb: '🧩' };
  const LABELS = {
    meaning: { vi: 'Nghĩa', en: 'Meaning' }, gap: { vi: 'Điền khuyết', en: 'Gap-fill' },
    mcq: { vi: 'Trắc nghiệm', en: 'Multiple choice' }, fill: { vi: 'Điền từ', en: 'Fill in' },
    listening: { vi: 'Nghe hiểu', en: 'Listening' }, order: { vi: 'Sắp xếp câu', en: 'Word order' },
    fix: { vi: 'Sửa lỗi', en: 'Error correction' }, guided: { vi: 'Viết theo gợi ý', en: 'Guided writing' },
    interview: { vi: 'Trả lời câu hỏi', en: 'Interview' }, describe: { vi: 'Miêu tả', en: 'Describe' },
    roleplay: { vi: 'Nhập vai', en: 'Role-play' }, discussion: { vi: 'Thảo luận', en: 'Discussion' }
  };
  const STORE_KEY = 'csa.v1';

  // ---------- tiny helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function shuffle(arr, rnd = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function seeded(str) { let x = 2166136261; for (const ch of str) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; }
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2600); }
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  // ---------- storage ----------
  const Store = {
    d: {},
    load() {
      try { this.d = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { this.d = {}; }
      for (const k of ['progress', 'pos', 'quiz', 'drafts']) this.d[k] = this.d[k] || {};
      this.d.history = this.d.history || [];
    },
    save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(this.d)); } catch (e) { /* storage full / private mode */ } }
  };
  const rec = id => Store.d.progress[id];
  function setRec(id, s, a) {
    const old = Store.d.progress[id] || {};
    Store.d.progress[id] = { s, a, n: (old.n || 0) + 1, at: Date.now() };
    Store.save();
  }

  // ---------- i18n ----------
  let lang = 'vi';
  const t = (k, vars) => { let s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace('{' + a + '}', b); return s; };
  const L = o => (o ? o[lang] || o.en || '' : '');
  const I18N = window.CSA_I18N;

  // ---------- data ----------
  const Data = {
    manifest: null, levels: {}, byId: {},
    async init() {
      if (window.CSA_DATA) { this.manifest = window.CSA_DATA.manifest; this.levels = window.CSA_DATA.levels; }
      else {
        this.manifest = await (await fetch('data/manifest.json')).json();
        for (const lv of this.manifest.levels) {
          this.levels[lv.id] = {};
          await Promise.all(SKILLS.map(async sk => {
            try { this.levels[lv.id][sk] = await (await fetch(`data/${lv.id}/${sk}.json`)).json(); } catch (e) { this.levels[lv.id][sk] = { items: [] }; }
          }));
        }
      }
      for (const lv of Object.keys(this.levels)) for (const sk of SKILLS) for (const it of this.items(lv, sk)) { it.skill = it.skill || sk; it.level = it.level || lv; this.byId[it.id] = it; }
    },
    items(level, skill) { return (this.levels[level] && this.levels[level][skill] && this.levels[level][skill].items) || []; },
    level(id) { return this.manifest.levels.find(l => l.id === id); },
    skillTitle(sk) { const s = this.manifest.skills.find(x => x.id === sk); return s ? L(s.title) : sk; }
  };
  function skillStats(level, skill) {
    const items = Data.items(level, skill); let done = 0, ok = 0, wrong = 0;
    for (const it of items) { const r = rec(it.id); if (r) { done++; if (r.s === 'c') ok++; else if (r.s === 'w') wrong++; } }
    return { total: items.length, done, ok, wrong };
  }
  function levelStats(level) {
    const s = { total: 0, done: 0, ok: 0, wrong: 0 };
    for (const sk of SKILLS) { const x = skillStats(level, sk); for (const k in s) s[k] += x[k]; }
    return s;
  }

  // ---------- text normalisation ----------
  const CONTR = { "i'm": 'i am', "i've": 'i have', "i'd": 'i would', "i'll": 'i will', "it's": 'it is', "he's": 'he is', "she's": 'she is', "that's": 'that is', "there's": 'there is', "we're": 'we are', "they're": 'they are', "you're": 'you are', "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'cannot', "won't": 'will not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not', "let's": 'let us', "haven't": 'have not', "hasn't": 'has not', "we've": 'we have', "you've": 'you have', "they've": 'they have' };
  function norm(s) {
    s = String(s || '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
    s = s.replace(/[.!?]+$/, '').replace(/\s*,\s*/g, ', ').trim();
    return s.split(' ').map(w => CONTR[w] || w).join(' ');
  }
  function normLoose(s) { return norm(String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ')).replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  const isAccepted = (val, list) => list.some(a => norm(a) === norm(val));
  const wordCount = s => (String(s || '').trim().match(/[A-Za-zÀ-ỹ0-9'’-]+/g) || []).length;

  // ---------- native bridge (Capacitor iOS/Android shell; null in normal browsers) ----------
  const NATIVE = (() => { try { const C = window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() ? C : null; } catch (e) { return null; } })();
  function nativePlugin(name) {
    try {
      if (!NATIVE || (NATIVE.isPluginAvailable && !NATIVE.isPluginAvailable(name))) return null;
      const reg = NATIVE.registerPlugin || (window.capacitorExports && window.capacitorExports.registerPlugin);
      return reg ? reg(name) : null;
    } catch (e) { return null; }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // ---------- shared leaderboard API (optional; everything else stays offline in localStorage) ----------
  // Web/PWA: relative "api/" (→ /cambridge/api/ on the shared domain). Capacitor apps: absolute URL of the shared server.
  // Override for testing: localStorage['csa.apiBase'] = 'http://localhost:8098/cambridge/api/'
  const REMOTE_BASE = 'https://cradling-had-batboy.ngrok-free.dev/cambridge/';
  const API_BASE = (() => {
    try { const o = localStorage.getItem('csa.apiBase'); if (o) return o.replace(/\/?$/, '/'); } catch (e) { }
    if (NATIVE) return REMOTE_BASE + 'api/';
    if (/\.github\.io$/.test(location.hostname)) return null; // GitHub Pages: static, no server
    return /^https?:$/.test(location.protocol) ? 'api/' : null; // file:// → no server, leaderboard hidden as offline
  })();
  async function apiFetch(path, opts = {}) {
    if (!API_BASE) throw new Error('offline');
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const timer = ctl && setTimeout(() => ctl.abort(), opts.timeout || 8000);
    try {
      const res = await fetch(API_BASE + path, { method: opts.method || 'GET', headers: Object.assign({ 'ngrok-skip-browser-warning': '1' }, opts.body ? { 'Content-Type': 'application/json' } : {}), body: opts.body ? JSON.stringify(opts.body) : undefined, signal: ctl ? ctl.signal : undefined, cache: 'no-store' });
      const ct = res.headers.get('content-type') || ''; const data = /json/.test(ct) ? await res.json() : null;
      if (!data) throw new Error('offline'); // e.g. a proxy/ngrok HTML page instead of the API
      if (!res.ok || !data.ok) throw Object.assign(new Error(data.error || ('HTTP ' + res.status)), { status: res.status });
      return data;
    } finally { if (timer) clearTimeout(timer); }
  }
  const Leaderboard = {
    get: level => apiFetch('leaderboard?level=' + encodeURIComponent(level) + '&limit=10'),
    submit: (entry) => apiFetch('score', { method: 'POST', body: entry })
  };
  function rankVoices(all) { // shared by web + native TTS: prefer en-GB, then en-US; try to get one female + one male voice first
    const score = v => (/en[-_]GB/i.test(v.lang) ? 0 : /en[-_]US/i.test(v.lang) ? 1 : 2) + (v.localService ? 0 : 0.5);
    all = all.slice().sort((a, b) => score(a) - score(b));
    const fem = all.filter(v => /female|samantha|karen|serena|libby|sonia|jenny|aria|zira|susan|kate|hazel|moira|tessa|victoria|fiona/i.test(v.name));
    const male = all.filter(v => /\bmale|daniel|ryan|guy|david|mark|alex|fred|george|james|oliver|arthur|thomas/i.test(v.name) && !fem.includes(v));
    const rest = all.filter(v => !fem.includes(v) && !male.includes(v));
    const out = []; if (fem[0]) out.push(fem[0]); if (male[0]) out.push(male[0]);
    for (const v of [...rest, ...fem.slice(1), ...male.slice(1)]) if (!out.includes(v)) out.push(v);
    return out;
  }

  // ---------- speech: TTS ----------
  const WebTTS = {
    ok: 'speechSynthesis' in window, voices: [], token: null,
    init() {
      if (!this.ok) return;
      const load = () => { this.voices = rankVoices(speechSynthesis.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang))); };
      load(); speechSynthesis.onvoiceschanged = load;
    },
    speak(lines, { rate = 0.95, onend } = {}) {
      this.stop(); if (!this.ok) return;
      const speakers = [...new Set(lines.map(l => l.speaker))];
      const token = {}; this.token = token; let i = 0;
      const next = () => {
        if (this.token !== token) return;
        if (i >= lines.length) { this.token = null; onend && onend(); return; }
        const l = lines[i++]; const si = Math.max(0, speakers.indexOf(l.speaker));
        const u = new SpeechSynthesisUtterance(l.text);
        if (this.voices.length) { u.voice = this.voices[si % this.voices.length]; u.lang = u.voice.lang; } else u.lang = 'en-GB';
        u.rate = rate; u.pitch = this.voices.length > 1 && speakers.length <= this.voices.length ? 1 : [1, 0.82, 1.18][si % 3];
        u.onend = () => setTimeout(next, 280); u.onerror = () => setTimeout(next, 50);
        speechSynthesis.speak(u);
      };
      speechSynthesis.cancel(); setTimeout(next, 60);
    },
    stop() { this.token = null; if (this.ok) speechSynthesis.cancel(); }
  };
  // Android System WebView has no speechSynthesis, so the mobile app uses the native engine via @capacitor-community/text-to-speech.
  const NativeTTS = (() => {
    const P = nativePlugin('TextToSpeech'); if (!P) return null;
    return {
      ok: true, voices: [], token: null,
      init() {
        P.getSupportedVoices().then(r => {
          const all = (r && r.voices || []).map((v, index) => ({ name: v.name || '', lang: v.lang || '', localService: v.localService !== false, index }));
          this.voices = rankVoices(all.filter(v => /^en([-_]|$)/i.test(v.lang))).slice(0, 4);
        }).catch(() => { });
      },
      speak(lines, { rate = 0.95, onend } = {}) {
        this.stop();
        const speakers = [...new Set(lines.map(l => l.speaker))];
        const token = {}; this.token = token;
        (async () => {
          await sleep(60);
          for (const l of lines) {
            if (this.token !== token) return;
            const si = Math.max(0, speakers.indexOf(l.speaker)); const v = this.voices.length ? this.voices[si % this.voices.length] : null;
            const opts = { text: l.text, lang: v ? v.lang.replace('_', '-') : 'en-GB', rate, pitch: this.voices.length > 1 && speakers.length <= this.voices.length ? 1 : [1, 0.82, 1.18][si % 3], volume: 1, category: 'playback', queueStrategy: 0 };
            if (v) opts.voice = v.index;
            try { await P.speak(opts); } catch (e) { if (this.token !== token) return; try { delete opts.voice; await P.speak(opts); } catch (e2) { /* skip line */ } }
            if (this.token !== token) return;
            await sleep(280);
          }
          if (this.token === token) { this.token = null; onend && onend(); }
        })();
      },
      stop() { this.token = null; P.stop().catch(() => { }); }
    };
  })();
  const TTS = NativeTTS || WebTTS;

  // ---------- speech: recognition ----------
  // Native: @capacitor-community/speech-recognition (Android SpeechRecognizer / iOS SFSpeechRecognizer); same interface as the web version.
  const NativeSR = (() => {
    const P = nativePlugin('SpeechRecognition'); if (!P) return null;
    const S = {
      ok: true, active: null,
      init() { P.available().then(r => { if (r && r.available === false) this.ok = false; }).catch(() => { }); },
      async start({ onText, onEnd, onError }) {
        this.stop();
        const run = { last: '', done: false, subs: [] }; this.active = run;
        const finish = err => {
          if (run.done) return; run.done = true; if (this.active === run) this.active = null;
          run.subs.forEach(h => h && h.remove && h.remove());
          if (err) onError && onError(err); else onEnd && onEnd(run.last.trim());
        };
        run.finish = finish;
        try {
          let perm = await P.checkPermissions();
          if (perm.speechRecognition !== 'granted') perm = await P.requestPermissions();
          if (perm.speechRecognition !== 'granted') return finish('not-allowed');
          if (run.done) return;
          run.subs.push(await P.addListener('partialResults', d => { const m = d && d.matches && d.matches[0]; if (m && !run.done) { run.last = m; onText(m.trim()); } }));
          run.subs.push(await P.addListener('listeningState', d => { if (d && d.status === 'stopped') finish(); }));
          const r = await P.start({ language: 'en-US', maxResults: 1, partialResults: true, popup: false });
          const m = r && r.matches && r.matches[0]; if (m && !run.done) { run.last = m; onText(m.trim()); }
        } catch (e) {
          const msg = String(e && e.message || e || '');
          finish(/no match|didn't understand|no speech/i.test(msg) ? 'no-speech' : msg || 'error');
        }
      },
      stop() { const run = this.active; if (!run) return; P.stop().catch(() => { }); setTimeout(() => run.finish && run.finish(), 400); }
    };
    return S;
  })();
  const WebSR = {
    Ctor: window.SpeechRecognition || window.webkitSpeechRecognition, r: null,
    get ok() { return !!this.Ctor; },
    start({ onText, onEnd, onError }) {
      this.stop(); const r = new this.Ctor(); r.lang = 'en-US'; r.interimResults = true; r.continuous = true; let fin = '';
      r.onresult = e => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const tr = e.results[i][0].transcript; if (e.results[i].isFinal) fin += tr + ' '; else interim += tr; } onText((fin + interim).trim()); };
      r.onerror = e => onError && onError(e.error);
      r.onend = () => { if (this.r === r) this.r = null; onEnd && onEnd(fin.trim()); };
      try { r.start(); this.r = r; } catch (e) { onError && onError(e.message); }
    },
    stop() { if (this.r) { try { this.r.stop(); } catch (e) { } this.r = null; } }
  };
  const SR = NativeSR || WebSR;

  // ---------- keyboard ----------
  let keyCtx = null;
  document.addEventListener('keydown', e => {
    if (!keyCtx) return;
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (e.key === 'Enter' && tag !== 'textarea' && tag !== 'button') { if (keyCtx.enter) { e.preventDefault(); keyCtx.enter(); } return; }
    if (typing) return;
    if (/^[1-4]$/.test(e.key) && keyCtx.num) keyCtx.num(+e.key - 1);
    else if (e.key === 'ArrowRight' && keyCtx.next) keyCtx.next();
    else if (e.key === 'ArrowLeft' && keyCtx.prev) keyCtx.prev();
  });

  // ---------- shared UI pieces ----------
  function formatGap(text) {
    const parts = String(text).split('___'); const frag = document.createDocumentFragment();
    parts.forEach((p, i) => { frag.append(p); if (i < parts.length - 1) frag.append(h('span', { class: 'gap' }, '\u00a0')); });
    return frag;
  }
  const IRREG = { get: 'g[eo]t\\w*', go: '(?:go\\w*|went)', have: 'ha(?:ve|s|d|ving)', make: 'ma(?:de|k\\w*)', feel: 'fe(?:el\\w*|lt)', break: 'br(?:eak\\w*|oke\\w*)', fall: 'f(?:all\\w*|ell)', run: 'r[au]n\\w*', give: 'g[ai]v\\w*', come: 'c[oa]m\\w*', grow: 'gr[eo]w\\w*', wake: 'w[ao]k\\w*', throw: 'thr[eo]w\\w*', take: 't(?:ak\\w*|ook)', sit: 's[ai]t\\w*', lie: 'l(?:ie\\w*|ying|ay)', hang: 'h[au]ng\\w*', eat: '(?:eat\\w*|ate)', find: 'f(?:ind\\w*|ound)', keep: 'k(?:eep\\w*|ept)', see: 's(?:ee\\w*|aw)', lend: 'len[dt]\\w*', sleep: 'sl(?:eep\\w*|ept)', ring: 'r[iau]ng\\w*', write: 'wr[io]t\\w*', drop: 'drop\\w*', pick: 'pick\\w*', look: 'look\\w*', put: 'put\\w*', bite: 'bit\\w*', bring: 'br(?:ing\\w*|ought)', catch: 'ca(?:tch\\w*|ught)', think: 'th(?:ink\\w*|ought)', wear: 'w(?:ear\\w*|ore|orn)', hold: 'h(?:old\\w*|eld)', stand: 'st(?:and\\w*|ood)', bend: 'ben[dt]\\w*', spill: 'spil[lt]\\w*', try: 'tr(?:y\\w*|ie\\w*)', carry: 'carr(?:y\\w*|ie\\w*)', draw: 'dr[ae]w\\w*', sink: 's[iau]nk\\w*', lay: 'la(?:y\\w*|id)', steal: 'st(?:eal\\w*|ole\\w*)' };
  function contextEl(text, focus) {
    const box = h('div', { class: 'context' });
    try {
      const words = focus.split(' ');
      const pat = words.map((w, i) => {
        if (w === "someone's") return "(?:\\w+'s|your|my|his|her|our|their)";
        if (w === 'your') return '(?:your|my|his|her|our|their)';
        if (w === 'someone' || w === 'something') return "[\\w']+(?:\\s+[\\w']+){0,2}";
        const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (i > 0) return esc;
        if (IRREG[w.toLowerCase()]) return IRREG[w.toLowerCase()];
        return /^(a|an|the|as|in|on|at|by|all|not)$/i.test(w) ? esc : esc + '\\w*';
      }).join("\\s+(?:[\\w']+\\s+)?");
      const m = new RegExp('\\b' + pat + '\\b', 'i').exec(text);
      if (m) { box.append(text.slice(0, m.index), h('mark', null, m[0]), text.slice(m.index + m[0].length)); return box; }
    } catch (e) { }
    box.textContent = text; return box;
  }
  function passageEl(p) { return h('div', { class: 'passage' }, h('h4', null, '📄 ', p.title), h('p', null, p.text)); }
  function transcriptEl(script) { return h('div', { class: 'transcript' }, script.map(l => h('p', null, h('b', null, l.speaker + ': '), l.text))); }
  function metaEl(item, ctx) {
    const sub = item.subtype || item.task || item.type;
    return h('div', { class: 'item-meta' },
      ctx.showSkill ? h('span', { class: 'badge brand' }, SKILL_ICON[item.skill], ' ', Data.skillTitle(item.skill)) : null,
      h('span', { class: 'badge' }, '#' + item.id.split('-').pop()),
      LABELS[sub] ? h('span', { class: 'badge' }, L(LABELS[sub])) : null,
      item.topic ? h('span', { class: 'badge' }, item.topic) : null);
  }
  function feedbackEl(item, ok, { correctText, extra, onRetry } = {}) {
    return h('div', { class: 'feedback ' + (ok ? 'ok' : 'bad') },
      h('h4', null, ok ? '✅ ' + t('correct') : '❌ ' + t('incorrect')),
      !ok && correctText ? h('p', null, h('b', null, t('correctAnswer') + ': '), correctText) : null,
      item.explanation ? h('p', null, h('b', null, t('explanation') + ': '), item.explanation) : null,
      item.meaningVi ? h('p', { class: 'vi' }, '🇻🇳 ', h('b', null, (item.focus || '') + ' – '), item.meaningVi) : null,
      extra || null,
      onRetry ? h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn small', type: 'button', onclick: onRetry }, '↻ ' + t('retry'))) : null);
  }
  function rateButtons(current, onRate) {
    const labels = [['rateAgain', '😕'], ['rateOk', '🙂'], ['rateGood', '🤩']];
    const wrap = h('div', { class: 'rate' });
    labels.forEach(([k, e], i) => wrap.append(h('button', { class: 'btn small' + (current === i + 1 ? ' active' : ''), type: 'button', onclick: () => { onRate(i + 1); [...wrap.children].forEach((b, j) => b.classList.toggle('active', j === i)); } }, e + ' ' + t(k))));
    return wrap;
  }

  // ---------- item renderers ----------
  // ctx: { mode: 'practice'|'quiz', showSkill, quizAnswer, onQuizAnswer(ans|null), onRecorded() }
  function renderItem(item, ctx) {
    const card = h('div', { class: 'card item-card' });
    card.append(metaEl(item, ctx));
    const R = { mcq: renderChoice, listening: renderChoice, fill: renderFill, speaking: renderSpeaking, order: renderOrder, fix: renderFix, guided: renderGuided }[item.type];
    const body = R ? R(item, ctx) : h('p', null, 'Unsupported item type: ' + item.type);
    card.append(body); card._keys = body._keys || {}; card._answered = body._answered;
    return card;
  }

  function listeningPlayer(item, ctx) {
    const wrap = h('div');
    if (!TTS.ok) { wrap.append(h('div', { class: 'panel' }, h('p', null, '⚠️ ' + t('ttsMissing'))), transcriptEl(item.script)); return wrap; }
    const status = h('span', { class: 'muted', style: 'font-size:13px' }, t('ttsHint'));
    const playBtn = h('button', { class: 'play-btn', type: 'button', 'aria-label': t('listen') }, '▶');
    const done = () => { playBtn.classList.remove('playing'); playBtn.textContent = '▶'; };
    const play = rate => { if (playBtn.classList.contains('playing')) { TTS.stop(); done(); return; } playBtn.classList.add('playing'); playBtn.textContent = '■'; TTS.speak(item.script, { rate, onend: done }); };
    playBtn.onclick = () => play(0.95);
    const slow = h('button', { class: 'btn small', type: 'button', onclick: () => play(0.7) }, '🐢 ' + t('listenSlow'));
    const tBox = h('div');
    const tBtn = ctx.mode === 'practice' ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => { tBox.childNodes.length ? tBox.replaceChildren() : tBox.replaceChildren(h('div', { class: 'panel' }, h('h4', null, t('transcript')), transcriptEl(item.script))); } }, '📝 ' + t('showTranscript')) : null;
    wrap.append(h('div', { class: 'player' }, playBtn, h('div', { style: 'flex:1;min-width:160px' }, h('div', { style: 'font-weight:700' }, '🎧 ' + t('listen')), status), slow, tBtn), tBox);
    return wrap;
  }

  function renderChoice(item, ctx) {
    const wrap = h('div');
    if (item.passage) wrap.append(passageEl(item.passage));
    if (item.type === 'listening') wrap.append(listeningPlayer(item, ctx));
    if (item.context) wrap.append(contextEl(item.context, item.focus));
    wrap.append(h('div', { class: 'question' }, formatGap(item.question)));
    const opts = h('div', { class: 'options' }); const fb = h('div');
    const btns = item.options.map((o, i) => h('button', { class: 'opt', type: 'button', onclick: () => choose(i) }, h('span', { class: 'key' }, 'ABCD'[i]), h('span', null, o)));
    opts.append(...btns); wrap.append(opts, fb);
    let answered = false;
    const show = chosen => {
      answered = true;
      btns.forEach((b, i) => { b.disabled = true; b.classList.toggle('correct', i === item.answer); b.classList.toggle('wrong', i === chosen && i !== item.answer); });
      const extra = item.type === 'listening' ? h('div', { class: 'panel' }, h('h4', null, t('transcript')), transcriptEl(item.script)) : null;
      fb.replaceChildren(feedbackEl(item, chosen === item.answer, { correctText: item.options[item.answer], extra, onRetry: reset }));
    };
    const reset = () => { answered = false; btns.forEach(b => { b.disabled = false; b.className = 'opt'; }); fb.replaceChildren(); };
    let choose;
    if (ctx.mode === 'quiz') {
      choose = i => { btns.forEach((b, j) => b.classList.toggle('selected', j === i)); ctx.onQuizAnswer({ value: i, correct: i === item.answer }); };
      if (ctx.quizAnswer) btns[ctx.quizAnswer.value] && btns[ctx.quizAnswer.value].classList.add('selected');
    } else {
      choose = i => { if (answered) return; setRec(item.id, i === item.answer ? 'c' : 'w', i); show(i); ctx.onRecorded && ctx.onRecorded(); };
      const r = !ctx.fresh && rec(item.id); if (r && typeof r.a === 'number') show(r.a);
    }
    wrap._keys = { num: i => i < btns.length && choose(i) }; wrap._answered = () => answered;
    return wrap;
  }

  function textAnswer(item, ctx, { initial = '', unchangedIsEmpty = false, accepted, correctText, before }) {
    const wrap = h('div'); if (before) wrap.append(...[].concat(before));
    const input = h('input', { class: 'input', type: 'text', placeholder: t('typeAnswer'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value: initial });
    const fb = h('div'); let answered = false;
    const checkBtn = h('button', { class: 'btn primary', type: 'button' }, t('check'));
    const show = val => { answered = true; input.value = val; input.disabled = true; checkBtn.disabled = true; const ok = isAccepted(val, accepted); fb.replaceChildren(feedbackEl(item, ok, { correctText, extra: !ok ? h('p', null, h('b', null, t('yourAnswer') + ': '), val || t('noAnswer')) : null, onRetry: reset })); };
    const reset = () => { answered = false; input.disabled = false; checkBtn.disabled = false; input.value = initial; fb.replaceChildren(); input.focus(); };
    const check = () => { if (answered) return; const v = input.value.trim(); if (!v) { input.focus(); return; } setRec(item.id, isAccepted(v, accepted) ? 'c' : 'w', v); show(v); ctx.onRecorded && ctx.onRecorded(); };
    if (ctx.mode === 'quiz') {
      if (ctx.quizAnswer) input.value = ctx.quizAnswer.value;
      input.addEventListener('input', () => { const v = input.value.trim(); ctx.onQuizAnswer(!v || (unchangedIsEmpty && norm(v) === norm(initial)) ? null : { value: v, correct: isAccepted(v, accepted) }); });
      wrap.append(input);
    } else {
      checkBtn.onclick = check;
      wrap.append(h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:200px' }, input), checkBtn), fb);
      const r = !ctx.fresh && rec(item.id); if (r && typeof r.a === 'string') show(r.a);
    }
    wrap._keys = { enter: ctx.mode === 'practice' ? () => (answered ? null : check()) : null }; wrap._answered = () => answered;
    return wrap;
  }

  function renderFill(item, ctx) {
    return textAnswer(item, ctx, { accepted: item.answers, correctText: item.answers[0],
      before: [item.passage ? passageEl(item.passage) : null, h('div', { class: 'question' }, formatGap(item.question))].filter(Boolean) });
  }
  function renderFix(item, ctx) {
    return textAnswer(item, ctx, { initial: item.wrong, unchangedIsEmpty: true, accepted: item.answers, correctText: item.answers[0],
      before: [h('div', { class: 'question' }, t('fixPrompt')), h('div', { class: 'wrong-sentence' }, item.wrong)] });
  }

  function renderOrder(item, ctx) {
    const wrap = h('div');
    const tokens = item.sentence.split(' ');
    let perm = shuffle(tokens.map((_, i) => i), seeded(item.id));
    if (perm.every((v, i) => v === i)) perm = perm.reverse();
    let picked = []; let answered = false;
    const line = h('div', { class: 'answer-line' }); const pool = h('div', { class: 'chips' }); const fb = h('div');
    const checkBtn = h('button', { class: 'btn primary', type: 'button' }, t('check'));
    const resetBtn = h('button', { class: 'btn', type: 'button' }, '↺ ' + t('reset'));
    const built = () => picked.map(p => tokens[perm[p]]).join(' ');
    const draw = () => {
      line.replaceChildren(...(picked.length ? picked.map((p, k) => h('button', { class: 'chip', type: 'button', disabled: answered, onclick: () => { picked.splice(k, 1); changed(); } }, tokens[perm[p]])) : [h('span', { class: 'placeholder' }, t('tapWords'))]));
      pool.replaceChildren(...perm.map((ti, p) => h('button', { class: 'chip', type: 'button', disabled: answered || picked.includes(p), onclick: () => { picked.push(p); changed(); } }, tokens[ti])));
      checkBtn.disabled = answered || picked.length !== tokens.length; resetBtn.disabled = answered;
    };
    const changed = () => {
      draw();
      if (ctx.mode === 'quiz') ctx.onQuizAnswer(picked.length === tokens.length ? { value: built(), picked: picked.slice(), correct: norm(built()) === norm(item.sentence) } : null);
    };
    const show = () => { answered = true; draw(); const ok = norm(built()) === norm(item.sentence); fb.replaceChildren(feedbackEl(item, ok, { correctText: item.sentence, onRetry: () => { answered = false; picked = []; fb.replaceChildren(); draw(); } })); };
    const check = () => { if (answered || picked.length !== tokens.length) return; setRec(item.id, norm(built()) === norm(item.sentence) ? 'c' : 'w', { built: built(), picked: picked.slice() }); show(); ctx.onRecorded && ctx.onRecorded(); };
    checkBtn.onclick = check; resetBtn.onclick = () => { picked = []; changed(); };
    wrap.append(h('div', { class: 'question' }, t('orderPrompt')), line, pool, h('div', { class: 'row', style: 'margin-top:12px' }, resetBtn, ctx.mode === 'practice' ? checkBtn : null), fb);
    if (ctx.mode === 'quiz' && ctx.quizAnswer && ctx.quizAnswer.picked) picked = ctx.quizAnswer.picked.slice();
    if (ctx.mode === 'practice' && !ctx.fresh) { const r = rec(item.id); if (r && r.a && r.a.picked) { picked = r.a.picked.slice(); show(); } }
    draw();
    wrap._keys = { enter: ctx.mode === 'practice' ? check : null }; wrap._answered = () => answered;
    return wrap;
  }

  function renderSpeaking(item, ctx) {
    const wrap = h('div');
    const r = ctx.mode === 'quiz' ? ctx.quizAnswer : rec(item.id);
    const prev = r && r.a ? r.a : (r && r.value) || null;
    wrap.append(h('div', { class: 'question' }, '🗣️ ', item.prompt),
      lang === 'vi' && item.promptVi ? h('p', { class: 'muted', style: 'margin-top:-8px' }, item.promptVi) : null,
      h('div', { class: 'row' },
        TTS.ok ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => TTS.speak([{ speaker: 'Q', text: item.prompt }]) }, '🔊 ' + t('listen')) : null),
      h('div', { class: 'panel' }, h('h4', null, '💡 ' + t('tip')), h('p', null, L(item.tip))));
    const kwBox = h('div');
    const drawKw = said => { const n = ' ' + normLoose(said || '') + ' '; let hit = 0; kwBox.replaceChildren(h('div', { class: 'muted', style: 'font-size:13px;margin-top:10px' }, t('keywordsHit') + ':'), ...item.keywords.map(k => { const ok = said && n.includes(' ' + normLoose(k) + ' '); if (ok) hit++; return h('span', { class: 'kw' + (ok ? ' hit' : '') }, (ok ? '✓ ' : '') + k); })); return hit; };
    drawKw(prev && prev.transcript);
    const said = h('div');
    const showSaid = text => said.replaceChildren(text ? h('div', { class: 'panel' }, h('h4', null, t('youSaid')), h('p', null, '“' + text + '”')) : '');
    if (prev && prev.transcript) showSaid(prev.transcript);
    let transcript = prev && prev.transcript || '';
    if (SR.ok) {
      const mic = h('button', { class: 'btn mic-btn', type: 'button' }, '🎤 ' + t('record'));
      let on = false;
      mic.onclick = () => {
        if (on) { SR.stop(); return; }
        on = true; mic.classList.add('rec'); mic.textContent = '⏺ ' + t('recording');
        SR.start({ onText: tx => { transcript = tx; showSaid(tx); drawKw(tx); },
          onEnd: () => { on = false; mic.classList.remove('rec'); mic.textContent = '🎤 ' + t('record'); },
          onError: err => { on = false; mic.classList.remove('rec'); mic.textContent = '🎤 ' + t('record'); if (err && err !== 'no-speech' && err !== 'aborted') toast('Mic: ' + err); } });
      };
      wrap.append(h('div', { class: 'row', style: 'margin-top:12px' }, mic));
    } else wrap.append(h('p', { class: 'muted', style: 'font-size:14px;margin-top:12px' }, '🎙️ ' + t('srMissing')));
    wrap.append(said, kwBox);
    const modelBox = h('div');
    const modelBtn = h('button', { class: 'btn small', type: 'button' }, '👀 ' + t('showModel'));
    modelBtn.onclick = () => {
      if (modelBox.childNodes.length) { modelBox.replaceChildren(); modelBtn.textContent = '👀 ' + t('showModel'); return; }
      modelBtn.textContent = '🙈 ' + t('hideModel');
      modelBox.replaceChildren(h('div', { class: 'panel' }, h('h4', null, t('modelAnswer')), h('p', null, item.modelAnswer),
        TTS.ok ? h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn small ghost', type: 'button', onclick: () => TTS.speak([{ speaker: 'M', text: item.modelAnswer }], { rate: 0.9 }) }, '🔊 ' + t('playModel'))) : null));
    };
    wrap.append(h('div', { class: 'row', style: 'margin-top:12px' }, modelBtn), modelBox);
    const cur = prev && prev.rating;
    wrap.append(h('div', { style: 'margin-top:14px;font-weight:600' }, t('selfRate') + ':'), rateButtons(cur, rating => {
      const a = { rating, transcript };
      if (ctx.mode === 'quiz') ctx.onQuizAnswer({ value: a, correct: rating >= 2, selfRated: true });
      else { setRec(item.id, rating >= 2 ? 'c' : 'w', a); ctx.onRecorded && ctx.onRecorded(); toast('✓ ' + t('done')); }
    }));
    return wrap;
  }

  function renderGuided(item, ctx) {
    const wrap = h('div');
    const draft = Store.d.drafts[item.id] || { text: '', checks: [] };
    wrap.append(h('div', { class: 'question' }, '✍️ ', item.prompt),
      lang === 'vi' && item.promptVi ? h('p', { class: 'muted', style: 'margin-top:-8px' }, item.promptVi) : null,
      h('div', { style: 'font-weight:600' }, t('include') + ':'),
      h('ul', { class: 'points' }, item.points.map(p => h('li', null, p))));
    const ta = h('textarea', { class: 'input', placeholder: t('writeHere'), spellcheck: 'true' }); ta.value = draft.text || '';
    const wc = h('div', { class: 'wc' });
    const drawWc = () => { const n = wordCount(ta.value); wc.replaceChildren(h('span', { class: n >= item.minWords ? 'ok' : '' }, n + ' ' + t('words') + ' · ' + t('minWords') + ' ' + item.minWords), h('span', null, '💾 ' + t('savedDraft'))); };
    let tm; ta.addEventListener('input', () => { drawWc(); clearTimeout(tm); tm = setTimeout(() => { draft.text = ta.value; Store.d.drafts[item.id] = draft; Store.save(); }, 400); });
    drawWc(); wrap.append(ta, wc);
    const cl = h('div', { class: 'panel checklist' }, h('h4', null, '☑️ ' + t('checklist')), item.checklist.map((c, i) => {
      const cb = h('input', { type: 'checkbox' }); cb.checked = !!(draft.checks || [])[i];
      cb.onchange = () => { draft.checks = draft.checks || []; draft.checks[i] = cb.checked; Store.d.drafts[item.id] = draft; Store.save(); };
      return h('label', null, cb, h('span', null, L(c)));
    }));
    wrap.append(cl);
    const sBox = h('div'); const sBtn = h('button', { class: 'btn small', type: 'button' }, '👀 ' + t('showSample'));
    sBtn.onclick = () => { if (sBox.childNodes.length) { sBox.replaceChildren(); sBtn.textContent = '👀 ' + t('showSample'); return; } sBtn.textContent = '🙈 ' + t('hideSample'); sBox.replaceChildren(h('div', { class: 'panel' }, h('h4', null, t('sample') + ' (' + wordCount(item.sampleAnswer) + ' ' + t('words') + ')'), h('p', null, item.sampleAnswer))); };
    wrap.append(h('div', { class: 'row', style: 'margin-top:12px' }, sBtn), sBox);
    const r = rec(item.id);
    wrap.append(h('div', { style: 'margin-top:14px;font-weight:600' }, t('selfRate') + ':'), rateButtons(r && r.a && r.a.rating, rating => {
      draft.text = ta.value; Store.d.drafts[item.id] = draft;
      setRec(item.id, rating >= 2 ? 'c' : 'w', { rating, words: wordCount(ta.value) }); ctx.onRecorded && ctx.onRecorded(); toast('✓ ' + t('done'));
    }));
    return wrap;
  }

  // ---------- views ----------
  function backBtn(href) { return h('a', { class: 'btn small ghost', href }, '← ' + t('back')); }

  function viewHome(app) {
    const levels = Data.manifest.levels;
    let done = 0, ok = 0; for (const lv of levels) { const s = levelStats(lv.id); done += s.done; ok += s.ok; }
    app.append(
      h('section', { class: 'hero' }, h('h1', null, t('heroTitle')), h('p', null, t('heroSub')),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('b', null, done), h('span', null, t('answered'))),
          h('div', { class: 'stat' }, h('b', null, pct(ok, done) + '%'), h('span', null, t('accuracy'))),
          h('div', { class: 'stat' }, h('b', null, Store.d.history.length), h('span', null, t('history'))))),
      h('div', { class: 'section-title' }, t('chooseLevel')),
      h('div', { class: 'levels' }, levels.map(lv => {
        const s = levelStats(lv.id); const avail = lv.total > 0;
        return h('button', { class: 'level-card' + (avail ? '' : ' locked'), type: 'button', onclick: () => avail ? (location.hash = '#/level/' + lv.id) : toast(t('comingSoonMsg')) },
          h('div', { class: 'row' }, h('span', { class: 'badge' }, t('book') + ' ' + lv.book), h('span', { class: 'spacer' }), h('span', { class: 'badge ' + (avail ? 'ok' : '') }, avail ? t('available') : t('comingSoon'))),
          h('div', { class: 'cefr' }, lv.cefr), h('h3', null, L(lv.name)),
          h('div', { class: 'meta' }, avail ? `${lv.total} ${t('items')} · 7 ${t('skills').toLowerCase()}` : '7 × 100 ' + t('items')),
          h('div', { class: 'bar' }, h('span', { style: `width:${pct(s.done, s.total)}%` })));
      })),
      h('p', { class: 'hint' }, t('streakNote')));
  }

  function viewLevel(app, level) {
    const lv = Data.level(level);
    if (!lv) return notFound(app);
    if (!lv.total) { app.append(backBtn('#/'), h('div', { class: 'card empty', style: 'margin-top:14px' }, h('h2', null, lv.cefr + ' · ' + L(lv.name)), h('p', null, t('comingSoonMsg')))); return; }
    const s = levelStats(level);
    const wrongCount = s.wrong;
    const q = Store.d.quiz[level]; const inProgress = q && !q.submitted;
    const best = Store.d.history.filter(x => x.level === level).reduce((m, x) => Math.max(m, x.score), -1);
    app.append(
      h('div', { class: 'page-head' }, backBtn('#/'), h('span', { class: 'badge brand' }, t('book') + ' ' + lv.book), h('h1', { style: 'margin:0' }, lv.cefr + ' · ' + L(lv.name))),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', null, `${s.done}/${s.total}`), h('span', null, t('answered'))),
        h('div', { class: 'stat' }, h('b', null, pct(s.ok, s.done) + '%'), h('span', null, t('accuracy'))),
        h('div', { class: 'stat' }, h('b', null, best >= 0 ? best + '/20' : '–'), h('span', null, t('randomQuiz')))),
      h('div', { class: 'big-actions', style: 'margin-top:14px' },
        h('div', { class: 'action-card quiz' }, h('div', { class: 'emoji' }, '🎲'), h('h3', null, t('randomQuiz')), h('p', null, t('randomQuizSub')),
          h('div', { class: 'row' },
            inProgress ? h('a', { class: 'btn primary', href: `#/quiz/${level}` }, '▶ ' + t('resumeQuiz')) : null,
            h('a', { class: 'btn ' + (inProgress ? '' : 'primary'), href: `#/quiz/${level}?new=1` }, inProgress ? '🔀 ' + t('newQuiz') : '▶ ' + t('startQuiz')))),
        h('div', { class: 'action-card' }, h('div', { class: 'emoji' }, '🔁'), h('h3', null, t('review'), ' ', h('span', { class: 'badge ' + (wrongCount ? 'bad' : 'ok') }, wrongCount)), h('p', null, wrongCount ? t('reviewSub') : t('noWrong')),
          h('a', { class: 'btn', href: `#/review/${level}`, style: wrongCount ? '' : 'pointer-events:none;opacity:.5' }, t('start')))),
      h('div', { class: 'section-title' }, t('skills')),
      h('div', { class: 'skills' }, SKILLS.map(sk => {
        const x = skillStats(level, sk);
        return h('a', { class: 'skill-card', href: `#/practice/${level}/${sk}` },
          h('div', { class: 'skill-top' }, h('div', { class: 'skill-icon' }, SKILL_ICON[sk]),
            h('div', null, h('h3', null, Data.skillTitle(sk)), h('small', null, lang === 'vi' ? Data.manifest.skills.find(z => z.id === sk).title.en : Data.manifest.skills.find(z => z.id === sk).title.vi))),
          h('div', { class: 'bar' }, h('span', { style: `width:${pct(x.done, x.total)}%` })),
          h('div', { class: 'skill-foot' }, h('span', null, `${x.done}/${x.total} ${t('items')}`), h('span', null, x.done ? `${t('accuracy')} ${pct(x.ok, x.done)}%` : t('start') + ' →')));
      })),
      h('div', { class: 'row', style: 'margin-top:22px;justify-content:center' },
        h('button', { class: 'btn small ghost danger', type: 'button', onclick: () => {
          if (!confirm(t('resetConfirm'))) return;
          for (const sk of SKILLS) for (const it of Data.items(level, sk)) { delete Store.d.progress[it.id]; delete Store.d.drafts[it.id]; }
          for (const k of Object.keys(Store.d.pos)) if (k.startsWith(level + '/')) delete Store.d.pos[k];
          delete Store.d.quiz[level]; Store.d.history = Store.d.history.filter(x => x.level !== level); Store.save(); route();
        } }, '🗑 ' + t('resetLevel'))));
  }

  // Generic sequential practice session (used for skill practice and review)
  function practiceSession(app, { title, icon, backHref, posKey, all, filters, showSkill, fresh }) {
    let filter = (filters && Store.d.pos[posKey + ':f']) || 'all';
    let list = [];
    const head = h('div', { class: 'practice-head' });
    const bar = h('div', { class: 'bar' }, h('span'));
    const counter = h('span', { class: 'counter' });
    const host = h('div');
    const prevBtn = h('button', { class: 'btn', type: 'button' }, '← ', h('span', { class: 'lbl' }, t('prev')));
    const nextBtn = h('button', { class: 'btn primary', type: 'button' }, h('span', { class: 'lbl' }, t('next')), ' →');
    const jump = h('input', { class: 'input', type: 'number', min: 1, style: 'width:84px;text-align:center', 'aria-label': t('jumpTo') });
    let idx = 0;
    const applyFilter = () => {
      const f = filters ? filters.find(x => x.value === filter) : null;
      list = f ? all.filter(f.fn) : all.slice();
      const savedId = Store.d.pos[posKey]; const i = list.findIndex(x => x.id === savedId);
      idx = i >= 0 ? i : 0;
    };
    const updateBar = () => { const done = all.filter(x => rec(x.id)).length; bar.firstChild.style.width = pct(done, all.length) + '%'; };
    const render = () => {
      TTS.stop(); SR.stop(); updateBar();
      if (!list.length) { host.replaceChildren(h('div', { class: 'card empty' }, filter === 'all' ? t('noWrong') : t('emptyFilter'))); counter.textContent = '0/0'; prevBtn.disabled = nextBtn.disabled = true; keyCtx = null; return; }
      idx = clamp(idx, 0, list.length - 1);
      const item = list[idx]; Store.d.pos[posKey] = item.id; Store.save();
      counter.textContent = `${idx + 1}${t('of')}${list.length}`; jump.value = idx + 1; jump.max = list.length;
      prevBtn.disabled = idx === 0; nextBtn.disabled = idx === list.length - 1;
      const card = renderItem(item, { mode: 'practice', showSkill, fresh, onRecorded: updateBar });
      host.replaceChildren(card);
      keyCtx = { ...card._keys, prev: () => go(-1), next: () => go(1) };
      const innerEnter = card._keys.enter;
      keyCtx.enter = () => { if (card._answered && card._answered()) go(1); else if (innerEnter) innerEnter(); };
    };
    const go = d => { const n = clamp(idx + d, 0, list.length - 1); if (n !== idx) { idx = n; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
    prevBtn.onclick = () => go(-1); nextBtn.onclick = () => go(1);
    jump.onchange = () => { idx = clamp((+jump.value || 1) - 1, 0, list.length - 1); render(); };
    head.append(backBtn(backHref), h('h2', null, icon + ' ' + title), h('span', { class: 'spacer' }));
    if (filters) {
      const sel = h('select', { class: 'select', 'aria-label': 'filter' }, filters.map(f => h('option', { value: f.value }, f.label)));
      sel.value = filter; sel.onchange = () => { filter = sel.value; Store.d.pos[posKey + ':f'] = filter; Store.save(); applyFilter(); render(); };
      head.append(sel);
    }
    head.append(counter);
    app.append(head, bar, host, h('div', { class: 'nav' }, prevBtn, jump, nextBtn), h('p', { class: 'hint' }, t('shortcuts')));
    applyFilter(); render();
  }

  function viewPractice(app, level, skill) {
    const lv = Data.level(level); if (!lv || !SKILLS.includes(skill)) return notFound(app);
    const all = Data.items(level, skill);
    if (!all.length) { app.append(backBtn('#/level/' + level), h('div', { class: 'card empty', style: 'margin-top:14px' }, t('comingSoonMsg'))); return; }
    practiceSession(app, {
      title: `${Data.skillTitle(skill)} · ${lv.cefr}`, icon: SKILL_ICON[skill], backHref: '#/level/' + level, posKey: `${level}/${skill}`, all,
      filters: [{ value: 'all', label: t('filterAll'), fn: () => true }, { value: 'todo', label: t('filterTodo'), fn: x => !rec(x.id) }, { value: 'wrong', label: t('filterWrong'), fn: x => rec(x.id) && rec(x.id).s === 'w' }]
    });
  }

  function viewReview(app, level) {
    const lv = Data.level(level); if (!lv) return notFound(app);
    const all = []; for (const sk of SKILLS) for (const it of Data.items(level, sk)) { const r = rec(it.id); if (r && r.s === 'w') all.push(it); }
    practiceSession(app, {
      title: `${t('review')} · ${lv.cefr}`, icon: '🔁', backHref: '#/level/' + level, posKey: `${level}/review`, all, showSkill: true, fresh: true,
      filters: [{ value: 'all', label: t('filterAll'), fn: () => true }, ...SKILLS.filter(sk => all.some(x => x.skill === sk)).map(sk => ({ value: sk, label: SKILL_ICON[sk] + ' ' + Data.skillTitle(sk), fn: x => x.skill === sk }))]
    });
  }

  // ---------- quiz ----------
  function buildQuiz(level) {
    const cfg = Data.manifest.quiz; const ids = [];
    for (const [sk, n] of Object.entries(cfg.distribution)) {
      let pool = Data.items(level, sk);
      if (sk === 'writing') pool = pool.filter(i => cfg.writingTypes.includes(i.type));
      const seenGroup = new Set(); let got = 0;
      for (const it of shuffle(pool)) {
        const g = (it.passage && it.passage.id) || it.scriptId || it.focus || it.id;
        if (seenGroup.has(g)) continue; seenGroup.add(g); ids.push(it.id); if (++got >= n) break;
      }
    }
    return { level, ids: shuffle(ids), answers: {}, index: 0, submitted: false, createdAt: Date.now() };
  }

  function viewQuiz(app, level, params) {
    const lv = Data.level(level); if (!lv || !lv.total) return notFound(app);
    if (params.get('new') === '1' || !Store.d.quiz[level]) {
      Store.d.quiz[level] = buildQuiz(level); Store.save();
      if (params.get('new') === '1') { history.replaceState(null, '', `#/quiz/${level}`); }
    }
    const q = Store.d.quiz[level];
    if (q.submitted) return quizResult(app, level, q);
    const items = q.ids.map(id => Data.byId[id]).filter(Boolean);
    const host = h('div'); const dots = h('div', { class: 'dots' }); const counter = h('span', { class: 'counter' });
    const prevBtn = h('button', { class: 'btn', type: 'button' }, '← ', h('span', { class: 'lbl' }, t('prev')));
    const nextBtn = h('button', { class: 'btn primary', type: 'button' });
    const submitBtn = h('button', { class: 'btn', type: 'button', style: 'width:100%;margin-top:12px' }, '📤 ' + t('submit'));
    const drawDots = () => dots.replaceChildren(...items.map((it, i) => h('button', { class: 'dot' + (q.answers[it.id] ? ' answered' : '') + (i === q.index ? ' current' : ''), type: 'button', onclick: () => { q.index = i; render(); } }, i + 1)));
    const render = () => {
      TTS.stop(); SR.stop(); q.index = clamp(q.index, 0, items.length - 1); Store.save();
      const item = items[q.index];
      counter.textContent = `${t('question')} ${q.index + 1}${t('of')}${items.length}`;
      prevBtn.disabled = q.index === 0;
      const last = q.index === items.length - 1;
      nextBtn.replaceChildren(last ? '📤 ' + t('submit') : h('span', { class: 'lbl' }, t('next')), last ? '' : ' →');
      const card = renderItem(item, { mode: 'quiz', showSkill: true, quizAnswer: q.answers[item.id], onQuizAnswer: ans => { if (ans) q.answers[item.id] = ans; else delete q.answers[item.id]; Store.save(); drawDots(); } });
      host.replaceChildren(card); drawDots();
      keyCtx = { num: card._keys.num, prev: () => go(-1), next: () => go(1), enter: () => go(1) };
    };
    const go = d => { if (d > 0 && q.index === items.length - 1) return submit(); q.index = clamp(q.index + d, 0, items.length - 1); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const submit = () => {
      const unanswered = items.filter(it => !q.answers[it.id]).length;
      if (unanswered && !confirm(t('submitConfirm', { n: unanswered }))) return;
      let score = 0;
      for (const it of items) {
        const a = q.answers[it.id]; if (a && a.correct) score++;
        let stored = a ? a.value : null; if (it.type === 'order' && a) stored = { built: a.value, picked: a.picked };
        if (a || it.type !== 'speaking') setRec(it.id, a && a.correct ? 'c' : 'w', stored);
      }
      q.submitted = true; q.score = score; q.submittedAt = Date.now();
      Store.d.history.unshift({ level, score, total: items.length, at: q.submittedAt }); Store.d.history = Store.d.history.slice(0, 50);
      Store.save(); route();
    };
    prevBtn.onclick = () => go(-1); nextBtn.onclick = () => go(1); submitBtn.onclick = submit;
    app.append(h('div', { class: 'practice-head' }, h('a', { class: 'btn small ghost', href: '#/level/' + level }, '← ' + t('back')), h('h2', null, '🎲 ' + t('quizTitle') + ' · ' + lv.cefr), h('span', { class: 'spacer' }), counter),
      h('p', { class: 'muted', style: 'margin:0;font-size:14px' }, t('quizHint')), dots, host, h('div', { class: 'nav' }, prevBtn, nextBtn), submitBtn);
    render();
  }

  function answerText(it, a) {
    if (!a) return t('noAnswer');
    if (it.type === 'mcq' || it.type === 'listening') return it.options[a.value];
    if (it.type === 'speaking') return t('selfAssessed') + ': ' + [t('rateAgain'), t('rateOk'), t('rateGood')][(a.value.rating || 1) - 1];
    return String(a.value);
  }
  function correctText(it) {
    if (it.type === 'mcq' || it.type === 'listening') return it.options[it.answer];
    if (it.type === 'fill' || it.type === 'fix') return it.answers[0];
    if (it.type === 'order') return it.sentence;
    if (it.type === 'speaking') return it.modelAnswer;
    return '';
  }
  function questionText(it) {
    if (it.type === 'speaking') return it.prompt;
    if (it.type === 'order') return t('orderPrompt');
    if (it.type === 'fix') return it.wrong;
    return it.question.replace(/^.*\n/, '').replace('___', '_____');
  }

  function quizResult(app, level, q) {
    const lv = Data.level(level); const items = q.ids.map(id => Data.byId[id]).filter(Boolean);
    const p = pct(q.score, items.length);
    const per = {}; for (const it of items) { per[it.skill] = per[it.skill] || { ok: 0, n: 0 }; per[it.skill].n++; if (q.answers[it.id] && q.answers[it.id].correct) per[it.skill].ok++; }
    const hist = Store.d.history.filter(x => x.level === level).slice(0, 6);
    app.append(h('div', { class: 'practice-head' }, h('a', { class: 'btn small ghost', href: '#/level/' + level }, '← ' + t('back')), h('h2', null, '🏁 ' + t('result') + ' · ' + lv.cefr)),
      h('div', { class: 'card', style: 'text-align:center' },
        h('div', { class: 'score-ring', style: `--p:${p}` }, h('div', null, h('div', null, h('b', null, q.score + '/' + items.length), h('div', { class: 'muted' }, p + '%')))),
        h('h2', null, p >= 85 ? '🏆 ' + t('great') : p >= 60 ? '👏 ' + t('good') : '💪 ' + t('keepGoing')),
        h('div', { class: 'row', style: 'justify-content:center;margin-top:10px' },
          h('a', { class: 'btn primary', href: `#/quiz/${level}?new=1` }, '🔀 ' + t('newQuiz')), h('a', { class: 'btn', href: '#/level/' + level }, t('toLevel')))),
      h('div', { class: 'section-title' }, t('bySkill')),
      h('div', { class: 'card skill-break' }, Object.entries(per).map(([sk, v]) => h('div', { class: 'r' }, h('span', null, SKILL_ICON[sk] + ' ' + Data.skillTitle(sk)), h('div', { class: 'bar' }, h('span', { style: `width:${pct(v.ok, v.n)}%` })), h('b', null, `${v.ok}/${v.n}`)))),
      h('div', { class: 'section-title' }, t('reviewAnswers')),
      h('div', { class: 'card' }, items.map((it, i) => {
        const a = q.answers[it.id]; const ok = a && a.correct;
        return h('div', { class: 'review-item' },
          h('div', { class: 'row' }, h('span', { class: 'badge ' + (ok ? 'ok' : 'bad') }, (ok ? '✓ ' : '✗ ') + (i + 1)), h('span', { class: 'badge' }, SKILL_ICON[it.skill] + ' ' + Data.skillTitle(it.skill))),
          it.passage ? h('p', { class: 'muted' }, '📄 ' + it.passage.title) : null,
          h('p', { class: 'q' }, questionText(it)),
          h('p', null, h('b', null, t('yourAnswer') + ': '), answerText(it, a)),
          !ok || it.type === 'speaking' ? h('p', null, h('b', null, (it.type === 'speaking' ? t('modelAnswer') : t('correctAnswer')) + ': '), correctText(it)) : null,
          it.explanation ? h('p', { class: 'muted' }, '💡 ' + it.explanation) : null,
          it.meaningVi ? h('p', { class: 'muted' }, '🇻🇳 ' + (it.focus || '') + ' – ' + it.meaningVi) : null);
      })),
      leaderboardPanel(level, q, items.length),
      hist.length ? h('div', null, h('div', { class: 'section-title' }, t('history')), h('div', { class: 'card' }, h('ul', { class: 'history' }, hist.map(x => h('li', null, new Date(x.at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB'), ' — ', h('b', null, `${x.score}/${x.total}`)))))) : null);
    keyCtx = null;
  }

  function leaderboardPanel(level, q, total) {
    const box = h('div', { class: 'card lb' });
    const listEl = h('div', { class: 'lb-list' }, h('p', { class: 'muted' }, t('lbLoading')));
    const msg = h('p', { class: 'muted lb-msg', role: 'status' });
    const showList = (top, mine) => {
      if (!box.isConnected && !document.body.contains(box)) return;
      listEl.replaceChildren(top && top.length
        ? h('ol', { class: 'lb-top' }, top.map(e => h('li', { class: mine && e.name.toLowerCase() === mine.toLowerCase() ? 'me' : '' },
            h('span', { class: 'lb-rank' }, e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : '#' + e.rank), h('span', { class: 'lb-name' }, e.name),
            h('b', null, `${e.score}/${e.total}`), h('span', { class: 'muted' }, e.pct + '%'))))
        : h('p', { class: 'muted' }, t('lbEmpty')));
    };
    const offline = () => { listEl.replaceChildren(h('p', { class: 'muted' }, '📴 ' + t('lbOffline'))); form.hidden = true; };
    const input = h('input', { class: 'input', type: 'text', maxlength: '20', placeholder: t('lbNick'), value: Store.d.nick || '', 'aria-label': t('lbNick') });
    const btn = h('button', { class: 'btn primary', type: 'button' }, '📤 ' + t('lbSubmit'));
    const form = h('div', { class: 'row lb-form' }, input, btn);
    const lock = () => { input.disabled = true; btn.disabled = true; btn.textContent = '✓ ' + t('lbSent'); };
    if (q.lbSent) lock();
    btn.onclick = async () => {
      const name = input.value.replace(/\s+/g, ' ').trim().slice(0, 20);
      if (!name) { input.focus(); msg.textContent = t('lbNickNeeded'); return; }
      Store.d.nick = name; Store.save(); btn.disabled = true; msg.textContent = t('lbSending');
      try {
        const r = await Leaderboard.submit({ name, level, score: q.score, total });
        q.lbSent = true; Store.save(); lock();
        msg.textContent = r.rank ? t('lbRanked', { rank: r.rank }) : t('lbThanks');
        showList(r.top, name);
      } catch (e) {
        btn.disabled = false;
        msg.textContent = e.status === 429 ? t('lbSlowDown') : e.status ? '⚠️ ' + e.message : '📴 ' + t('lbOffline');
      }
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } });
    box.append(h('p', { class: 'muted', style: 'margin-top:0;font-size:14px' }, t('lbHint')), form, msg, listEl);
    if (!API_BASE) offline();
    else Leaderboard.get(level).then(r => showList(r.top, q.lbSent ? Store.d.nick : null)).catch(offline);
    return h('div', null, h('div', { class: 'section-title' }, '🏆 ' + t('lbTitle')), box);
  }

  function notFound(app) { app.append(h('div', { class: 'card empty' }, h('p', null, t('notFound')), h('a', { class: 'btn', href: '#/' }, t('home')))); }

  // ---------- router ----------
  function route() {
    TTS.stop(); SR.stop(); keyCtx = null;
    const raw = location.hash.replace(/^#\/?/, ''); const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean); const params = new URLSearchParams(qs || '');
    const app = $('#app'); app.replaceChildren();
    try {
      if (!parts.length) viewHome(app);
      else if (parts[0] === 'level') viewLevel(app, parts[1]);
      else if (parts[0] === 'practice') viewPractice(app, parts[1], parts[2]);
      else if (parts[0] === 'quiz') viewQuiz(app, parts[1], params);
      else if (parts[0] === 'review') viewReview(app, parts[1]);
      else notFound(app);
    } catch (e) { console.error(e); app.append(h('div', { class: 'card empty' }, 'Error: ' + e.message)); }
    window.scrollTo(0, 0);
  }

  function applyChrome() {
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = Store.d.theme || 'dark';
    $('#langBtn').textContent = lang === 'vi' ? 'VI' : 'EN';
    $('#themeBtn').textContent = (Store.d.theme || 'dark') === 'dark' ? '🌙' : '☀️';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });

    syncStatusBar();
  }
  function syncStatusBar() { // native app only: match the status bar to the current theme
    const SB = syncStatusBar.p === undefined ? (syncStatusBar.p = nativePlugin('StatusBar')) : syncStatusBar.p; if (!SB) return;
    const dark = (Store.d.theme || 'dark') === 'dark';
    SB.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => { });
    if (NATIVE.getPlatform() === 'android') SB.setBackgroundColor({ color: dark ? '#0f172a' : '#f4f7fd' }).catch(() => { });
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = dark ? '#0f172a' : '#f4f7fd';
  }

  async function boot() {
    Store.load(); lang = Store.d.lang || 'vi';
    $('#langBtn').onclick = () => { lang = lang === 'vi' ? 'en' : 'vi'; Store.d.lang = lang; Store.save(); applyChrome(); route(); };
    $('#themeBtn').onclick = () => { Store.d.theme = (Store.d.theme || 'dark') === 'dark' ? 'light' : 'dark'; Store.save(); applyChrome(); };
    if (NATIVE) document.documentElement.classList.add('native', 'native-' + (NATIVE.getPlatform ? NATIVE.getPlatform() : 'app'));
    applyChrome(); TTS.init(); if (SR.init) SR.init();
    const AppP = nativePlugin('App'); // Android hardware/gesture back: previous page; on the home page, close the app
    if (AppP) AppP.addListener('backButton', ({ canGoBack }) => {
      const atHome = !location.hash.replace(/^#\/?/, '');
      if (atHome) AppP.exitApp(); else if (canGoBack) history.back(); else location.hash = '#/';
    }).catch(() => { });
    if (!NATIVE && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { }));
    try { await Data.init(); } catch (e) { $('#app').replaceChildren(h('div', { class: 'card empty' }, 'Could not load data. Run a local server (see README). ' + e.message)); return; }
    window.addEventListener('hashchange', route); route();
  }
  boot();
})();
