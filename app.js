/* 두리번수학 앱 로직 — 개발자 구역. 판정: judgeWithAI() / judgeWithGemini() → 서버 판정 API로 교체 예정 */
/* ============ 상태 ============ */
const defaultState = () => ({
  child: null, level: '중', levelNotes: [], stars: 0, streak: 0,
  buildings: Object.fromEntries(BUILDINGS.map(b => [b.id, { done: false }])),
  areas: { shape: 0, color: 0, number: 0 },
  log: [],
});
let S = load();
function load() {
  try { const raw = localStorage.getItem(LS_KEY) || localStorage.getItem(OLD_LS_KEY); if (raw) { const s = JSON.parse(raw); return Object.assign(defaultState(), s); } } catch (e) {}
  return defaultState();
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }

/* ============ 유틸 ============ */
const $ = (id) => document.getElementById(id);
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  $(id).classList.add('on');
  window.scrollTo(0, 0);
}
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
/* ---- 음성 ---- */
let KO_VOICES = [];
function scoreVoice(v) {
  const n = (v.name || '').toLowerCase(); let sc = 0;
  if (/natural|neural|online|enhanced|premium|향상|고품질/.test(n)) sc += 50;
  if (/yuna|유나|sunhi|선히|injoon|google|한국의|heami|sora|jimin/.test(n)) sc += 20;
  if (!v.localService) sc += 5;
  if (/compact|저품질/.test(n)) sc -= 30;
  return sc;
}
function loadVoices() {
  try {
    KO_VOICES = speechSynthesis.getVoices().filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith('ko'))
      .sort((a, b) => scoreVoice(b) - scoreVoice(a));
    renderVoicePicker();
  } catch (e) {}
}
try { if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; } } catch (e) {}
function pickVoice() {
  if (!KO_VOICES.length) return null;
  if (S && S.voiceName) { const v = KO_VOICES.find(v => v.name === S.voiceName); if (v) return v; }
  return KO_VOICES[0];
}
function voiceTune() {
  const t = (S && S.voiceTone) || 'friend';
  return t === 'calm' ? { rate: 0.92, pitch: 1.0 } : t === 'bright' ? { rate: 1.0, pitch: 1.12 } : { rate: 0.96, pitch: 1.05 };
}
function speak(text) {
  try {
    if (!('speechSynthesis' in window) || !text) return;
    if (S && S.voiceOff) return;
    speechSynthesis.cancel();
    // 문장 단위로 끊어 읽어서 자연스러운 쉼을 만듦
    const parts = String(text).replace(/\s+/g, ' ').split(/(?<=[!?.…])\s+|,\s+(?=\S{6,})/).map(x => x.trim()).filter(Boolean);
    const v = pickVoice(), tune = voiceTune();
    parts.forEach(t => {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'ko-KR'; u.rate = tune.rate; u.pitch = tune.pitch;
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    });
  } catch (e) {}
}
function renderVoicePicker() {
  const sel = document.getElementById('sel-voice'); if (!sel) return;
  if (!KO_VOICES.length) { sel.innerHTML = '<option>이 기기에 한국어 음성이 없어요</option>'; sel.disabled = true; return; }
  sel.disabled = false;
  const curName = (pickVoice() || {}).name;
  sel.innerHTML = KO_VOICES.map(v => `<option value="${v.name.replace(/"/g, '&quot;')}" ${v.name === curName ? 'selected' : ''}>${v.name}${scoreVoice(v) >= 50 ? ' ⭐' : ''}</option>`).join('');
}
function penguSVG(mood) {
  const eye = mood === 'think' ? '<circle cx="36" cy="34" r="3" fill="#26324F"/><circle cx="50" cy="34" r="3" fill="#26324F"/><path d="M30 26q6-5 12-1" stroke="#26324F" stroke-width="2" fill="none"/>'
    : mood === 'happy' ? '<path d="M31 35q5-6 10 0" stroke="#26324F" stroke-width="3" fill="none"/><path d="M45 35q5-6 10 0" stroke="#26324F" stroke-width="3" fill="none"/>'
    : '<circle cx="36" cy="34" r="3.5" fill="#26324F"/><circle cx="50" cy="34" r="3.5" fill="#26324F"/><circle cx="37" cy="33" r="1.2" fill="#fff"/><circle cx="51" cy="33" r="1.2" fill="#fff"/>';
  return `<svg viewBox="0 0 86 86" width="84" height="84" aria-hidden="true">
    <ellipse cx="43" cy="80" rx="26" ry="4" fill="rgba(38,50,79,.12)"/>
    <path d="M43 12c-18 0-26 14-26 32 0 16 10 30 26 30s26-14 26-30c0-18-8-32-26-32z" fill="#3A4A7A"/>
    <path d="M43 26c-10 0-16 9-16 22 0 10 6 20 16 20s16-10 16-20c0-13-6-22-16-22z" fill="#fff"/>
    <path d="M18 54q-10 6-6 14 8 0 12-8z" fill="#3A4A7A"/><path d="M68 54q10 6 6 14-8 0-12-8z" fill="#3A4A7A"/>
    <path d="M36 70h-8q-4 6 2 8h6zM50 70h8q4 6-2 8h-6z" fill="#FFB347"/>
    ${eye}
    <path d="M38 42h10l-5 6z" fill="#FFB347"/>
    <circle cx="28" cy="44" r="3" fill="#FFB0A5" opacity=".7"/><circle cx="58" cy="44" r="3" fill="#FFB0A5" opacity=".7"/>
  </svg>`;
}
function buildingSVG(id) {
  const stroke = 'stroke="#26324F" stroke-width="2" stroke-linejoin="round"';
  switch (id) {
    case 'house': return `<rect x="-26" y="-34" width="52" height="34" rx="2" fill="#FFF3D6" ${stroke}/><polygon points="-32,-34 0,-62 32,-34" fill="#FF7B6B" ${stroke}/><rect x="-7" y="-18" width="14" height="18" fill="#7FB8FF" ${stroke}/><rect x="10" y="-28" width="11" height="9" fill="#C9E9FF" ${stroke}/><circle cx="20" cy="-52" r="4" fill="#fff"/>`;
    case 'tree': return `<rect x="-6" y="-28" width="12" height="28" rx="3" fill="#A8734A" ${stroke}/><circle cx="-14" cy="-34" r="15" fill="#8FD37E" ${stroke}/><circle cx="14" cy="-34" r="15" fill="#8FD37E" ${stroke}/><circle cx="0" cy="-48" r="18" fill="#9BDB7C" ${stroke}/><circle cx="8" cy="-52" r="3" fill="#FF7B6B"/><circle cx="-10" cy="-38" r="3" fill="#FFD24A"/>`;
    case 'shop': return `<rect x="-28" y="-30" width="56" height="30" rx="2" fill="#FFE7A3" ${stroke}/><rect x="-32" y="-40" width="64" height="12" rx="3" fill="#FF7B6B" ${stroke}/><path d="M-32 -28h64" stroke="#fff" stroke-width="3" stroke-dasharray="8 8"/><rect x="-8" y="-18" width="16" height="18" fill="#7FB8FF" ${stroke}/><rect x="12" y="-24" width="10" height="8" fill="#C9E9FF" ${stroke}/>`;
    case 'pond': return `<ellipse cx="0" cy="-6" rx="34" ry="15" fill="#7FC3FF" ${stroke}/><ellipse cx="-8" cy="-8" rx="14" ry="5" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/><circle cx="14" cy="-4" r="6" fill="#6DBF67" ${stroke}/><circle cx="16" cy="-6" r="2" fill="#FF7B6B"/>`;
    case 'play': return `<polygon points="-26,0 -26,-32 -16,-32 12,0" fill="#FFD24A" ${stroke}/><rect x="-30" y="-32" width="4" height="32" fill="#26324F"/><path d="M-30 -8h6M-30 -16h6M-30 -24h6" stroke="#26324F" stroke-width="2"/><path d="M18 -34h16M20 -34v26M32 -34v26" stroke="#26324F" stroke-width="2.5"/><rect x="18" y="-10" width="16" height="4" rx="1" fill="#FF7B6B" ${stroke}/>`;
    case 'bridge': return `<path d="M-36 0q36-34 72 0" fill="none" stroke="#26324F" stroke-width="2"/><rect x="-36" y="-8" width="72" height="9" rx="2" fill="#D8A56A" ${stroke}/><path d="M-30 -8v-14M-10 -8v-18M10 -8v-18M30 -8v-14" stroke="#26324F" stroke-width="2.5"/><path d="M-30 -20q30-14 60 0" fill="none" stroke="#A8734A" stroke-width="2"/>`;
  }
  return '';
}
function villageSVG() {
  const plots = BUILDINGS.map(b => {
    const locked = !S.buildings[b.id].done;
    return `<g class="plot ${locked ? 'is-locked' : ''}" data-id="${b.id}" transform="translate(${b.x},${b.y})" tabindex="0" role="button" aria-label="${b.name}">
      <g class="locked">
        <ellipse cx="0" cy="-2" rx="36" ry="14" fill="#B9E69E" stroke="#6FBF5A" stroke-width="2" stroke-dasharray="6 5"/>
        <rect x="-14" y="-40" width="28" height="22" rx="6" fill="#FFF3D6" stroke="#26324F" stroke-width="2"/>
        <rect x="-2" y="-18" width="4" height="16" fill="#A8734A"/>
        <text x="0" y="-23" text-anchor="middle" font-size="22" font-family="Jua,sans-serif" fill="#26324F">${b.emoji}</text>
      </g>
      <g class="built">${buildingSVG(b.id)}</g>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 380 320" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="60" cy="52" rx="34" ry="12" fill="#fff" opacity=".9"/><ellipse cx="82" cy="46" rx="26" ry="14" fill="#fff" opacity=".9"/>
    <ellipse cx="300" cy="36" rx="30" ry="11" fill="#fff" opacity=".9"/><ellipse cx="322" cy="30" rx="22" ry="13" fill="#fff" opacity=".9"/>
    <circle cx="330" cy="70" r="20" fill="#FFD24A" opacity=".95"/>
    <ellipse cx="190" cy="330" rx="300" ry="210" fill="#9BDB7C"/>
    <ellipse cx="60" cy="150" rx="120" ry="26" fill="#A9E28D"/>
    <ellipse cx="320" cy="140" rx="110" ry="24" fill="#A9E28D"/>
    <path d="M-10 300 C 80 280, 120 240, 190 236 S 300 240, 400 210" fill="none" stroke="#F3E2B3" stroke-width="18" stroke-linecap="round"/>
    <path d="M-10 300 C 80 280, 120 240, 190 236 S 300 240, 400 210" fill="none" stroke="#E7D09A" stroke-width="2" stroke-dasharray="4 10"/>
    ${plots}
  </svg>`;
}

/* ============ AI 연결 ============ */
let sampleFn = null, canImages = false, aiStatus = '확인 중…';
(async () => {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      sampleFn = await window.claude.use('sample');
      if (sampleFn) {
        const lim = await sampleFn.limits().catch(() => null);
        canImages = !!(lim && lim.images);
        aiStatus = canImages ? '연결됨 — 사진을 AI가 판정해요' : '연결됨 — 이 기기에서는 사진 판정이 안 돼 부모님이 판정해요';
      } else aiStatus = '연결 안 됨 — 부모님이 판정해요';
    } else aiStatus = '연결 안 됨 — 부모님이 판정해요';
  } catch (e) { sampleFn = null; aiStatus = '연결 안 됨 — 부모님이 판정해요'; }
  const el = $('pa-ai'); if (el) el.textContent = aiStatusText();
})();

function judgePrompt(c, kind) {
  if (kind === 'build' || kind === 'place') {
    return `아이(만 3~5세)가 집에서 물건을 놓고 찍은 사진이야. 사진이 "${c.attr}"에 해당하면 true, 아니면 false로 판정해.
규칙: 삐뚤거나 틀어져 있어도 그렇게 보이려고 한 게 느껴지면 true. 흔들림과 배경은 무시해. 애매하면 true.
seen에는 사진에서 보이는 주요 물건 이름을 한국어 한 단어(6글자 이내)로.
JSON만 출력: {"result": true, "seen": "책"}`;
  }
  if (kind === 'view') {
    return `아이(만 3~5세)가 물건을 특정 방향에서 찍은 사진이야. 사진이 "${c.attr}"에 해당하면 true, 아니면 false로 판정해.
규칙: 방향이 대충 맞으면 true. 흔들림과 배경은 무시해. 애매하면 true.
seen에는 물건 이름을 한국어 한 단어(6글자 이내)로.
JSON만 출력: {"result": true, "seen": "컵"}`;
  }
  return `아이(만 3~5세)가 집에서 찍은 사진이야. 사진의 주요 물체가 "${c.attr}"에 해당하면 true, 아니면 false로 판정해.
규칙: 흔들림, 복잡한 배경, 비스듬한 각도는 무시하고 물체 자체만 봐. 공·시계·접시처럼 사람들이 흔히 "${c.attr}"이라고 부르는 것이면 true. 애매하면 true.
seen에는 물체 이름을 한국어 한 단어(6글자 이내)로.
JSON만 출력: {"result": true, "seen": "시계"}`;
}

async function judgeWithAI(blob, m) {
  const one = () => sampleFn.json(judgePrompt(cur(), M.m.kind), { images: blob, modelTier: 'quick', cache: false });
  const r1 = await one();
  if (r1 && r1.result === true) return r1;
  const [r2, r3] = await Promise.all([one().catch(() => null), one().catch(() => null)]);
  const all = [r1, r2, r3].filter(Boolean);
  const yes = all.filter(r => r.result === true).length;
  if (yes >= 2) return all.find(r => r.result === true);
  return r1 || { result: false, seen: '' };
}


/* ============ Gemini 직접 호출 (임시) ============ */
const GEMINI_MODELS = ['server'];
function aiMode() { return (sampleFn && canImages) ? 'sample' : 'gemini'; }
function aiStatusText() {
  if (sampleFn && canImages) return 'Claude 연결됨 — 사진을 AI가 판정해요';
  if (S.geminiKey) return 'Gemini 키 연결됨 — 사진을 AI가 판정해요';
  return '연결 안 됨 — 부모님이 판정해요. 아래에 Gemini 키를 넣으면 AI가 판정해요.';
}
function blobToBase64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
}
async function geminiJSON(prompt, blob, schema) {
  const parts = [{ text: prompt }];
  if (blob) parts.push({ inline_data: { mime_type: blob.type || 'image/jpeg', data: await blobToBase64(blob) } });
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema } };
  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    try {
      const r = await fetch(`/api/gemini`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 404) { lastErr = new Error('model'); continue; }
      if (r.status === 400 || r.status === 403) { const e = new Error('key'); e.code = 'bad_key'; throw e; }
      if (r.status === 429) { const e = new Error('rate'); e.code = 'rate_limited'; throw e; }
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const txt = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts.map(p => p.text || '').join('');
      return JSON.parse(String(txt).replace(/```json|```/g, '').trim());
    } catch (e) { if (e.code) throw e; lastErr = e; }
  }
  throw lastErr || new Error('gemini');
}
async function verifyGeminiKey(key) {
  const prev = S.geminiKey; S.geminiKey = key;
  try { const r = await geminiJSON('JSON으로만 답해: {"ok": true}', null, { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] }); return !!(r && r.ok !== undefined); }
  catch (e) { S.geminiKey = prev; throw e; }
}
const JUDGE_SCHEMA = { type: 'OBJECT', properties: { result: { type: 'BOOLEAN' }, seen: { type: 'STRING' } }, required: ['result', 'seen'] };
async function judgeWithGemini(blob, m) {
  const one = () => geminiJSON(judgePrompt(cur(), M.m.kind), blob, JUDGE_SCHEMA);
  const r1 = await one();
  if (r1 && r1.result === true) return r1;
  const [r2, r3] = await Promise.all([one().catch(() => null), one().catch(() => null)]);
  const all = [r1, r2, r3].filter(Boolean);
  const yes = all.filter(r => r.result === true).length;
  if (yes >= 2) return all.find(r => r.result === true);
  return r1 || { result: false, seen: '' };
}

/* ============ 화면: 시작/누구 ============ */
$('splash-pengu').innerHTML = penguSVG();
$('v-pengu').innerHTML = penguSVG();
$('m-pengu').innerHTML = penguSVG();
$('j-pengu').innerHTML = penguSVG('think');
$('b-start').onclick = () => { speak('안녕! 나는 펭펭이야. 우리 같이 마을 만들자!'); show('s-who'); };
$('b-kid').onclick = () => { if (!S.child) { toast('처음이면 부모님이 먼저 설정해주세요'); openSetup(); } else openVillage(); };
$('b-parent').onclick = () => { if (!S.child) openSetup(); else openGate(); };

/* ============ 부모 설정 ============ */
let setupAns = {};
function openSetup() {
  setupAns = {};
  $('in-name').value = S.child ? S.child.name : '';
  $('age-chips').querySelectorAll('.chip').forEach(c => c.classList.toggle('sel', S.child && String(S.child.age) === c.dataset.v));
  $('questions').innerHTML = QUESTIONS.map(q => `<div class="q"><div class="qt">${q.t}</div><div class="chips" data-k="${q.k}">${q.o.map((o, i) => `<button class="chip" data-i="${i}">${o}</button>`).join('')}</div></div>`).join('');
  $('questions').querySelectorAll('.chips').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    g.querySelectorAll('.chip').forEach(c => c.classList.remove('sel')); b.classList.add('sel');
    setupAns[g.dataset.k] = { i: +b.dataset.i, text: b.textContent };
  }));
  $('setup-note').textContent = '';
  $('in-gkey-setup').value = ''; $('setup-ai-note').textContent = '';
  $('setup-ai').style.display = S.geminiKey ? 'none' : '';
  show('s-setup');
}
$('age-chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $('age-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('sel')); b.classList.add('sel');
});
function fallbackLevel(age, ans) {
  let score = 0, max = 0;
  QUESTIONS.forEach(q => { const a = ans[q.k]; max += q.o.length - 1; if (a) score += a.i; });
  const r = score / max;
  let lv = r < 0.34 ? '하' : r < 0.67 ? '중' : '상';
  if (age === 3 && lv === '상') lv = '중';
  return { level: lv, reason: `부모님 답을 바탕으로 정한 시작 레벨이에요. 미션을 하면서 자동으로 조정돼요.`, focus: ['모양 구별', '위치와 방향'] };
}
$('b-level').onclick = async () => {
  const name = $('in-name').value.trim() || '우리 아이';
  const ageBtn = $('age-chips').querySelector('.sel');
  if (!ageBtn) { toast('만 나이를 골라주세요'); return; }
  if (Object.keys(setupAns).length < QUESTIONS.length) { toast('질문에 모두 답해주세요'); return; }
  const age = +ageBtn.dataset.v;
  const btn = $('b-level'); btn.disabled = true;
  const k = $('in-gkey-setup').value.trim();
  if (k && k !== S.geminiKey) {
    $('setup-note').textContent = 'AI 연결을 확인하고 있어요…';
    try { await verifyGeminiKey(k); save(); $('setup-ai-note').textContent = '✅ AI 연결 확인됨'; }
    catch (e) { $('setup-ai-note').textContent = e && e.code === 'bad_key' ? '키가 맞지 않아요. 복사가 잘 됐는지 확인해주세요. (지금은 부모님 판정으로 진행해요)' : '연결을 확인하지 못했어요. 나중에 부모님 화면에서 다시 시도할 수 있어요.'; }
  }
  $('setup-note').textContent = 'AI가 레벨을 정하고 있어요…';
  let res = null;
  const lines = QUESTIONS.map(q => `- ${q.t} → ${setupAns[q.k].text}`).join('\n');
  const levelPrompt = `당신은 유아 수학 발달 전문가입니다. 만 ${age}세 아이에 대한 부모 응답을 보고, 사물 찾기 수학 앱의 시작 난이도를 정해주세요.
레벨 기준(2019 개정 누리과정 해설서 기준) — 하: 동그라미·세모·네모 찾기, 위/아래에 놓아보기. 중: 도형의 특성(뾰족한 데 개수)으로 찾기, 도형을 조합해 집·애벌레 모양 만들기. 상: 같은 물건을 위에서·옆에서 보며 모양 차이 알기, 같은 도형을 여러 물건에서 찾기.
부모 응답:
${lines}
JSON만 출력: {"level":"하|중|상","reason":"부모에게 보여줄 한 문장, 존댓말, 40자 이내","focus":["모양 구별","위치와 방향","세어 보기"] 중 강점이 아닌 1~2개}`;
  if (!sampleFn && S.geminiKey) {
    try {
      res = await geminiJSON(levelPrompt, null, { type: 'OBJECT', properties: { level: { type: 'STRING' }, reason: { type: 'STRING' }, focus: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['level', 'reason'] });
      if (!res || !['하', '중', '상'].includes(res.level)) res = null;
    } catch (e) { res = null; }
  }
  if (sampleFn) {
    try {
      res = await sampleFn.json(
        `당신은 유아 수학 발달 전문가입니다. 만 ${age}세 아이에 대한 부모 응답을 보고, 사물 찾기 수학 앱의 시작 난이도를 정해주세요.
레벨 기준(2019 개정 누리과정 해설서 기준) — 하: 동그라미·세모·네모 찾기, 위/아래에 놓아보기. 중: 도형의 특성(뾰족한 데 개수)으로 찾기, 도형을 조합해 집·애벌레 모양 만들기. 상: 같은 물건을 위에서·옆에서 보며 모양 차이 알기, 같은 도형을 여러 물건에서 찾기.
부모 응답:
${lines}
JSON만 출력: {"level":"하|중|상","reason":"부모에게 보여줄 한 문장, 존댓말, 40자 이내","focus":["모양 구별","위치와 방향","세어 보기"] 중 강점이 아닌 1~2개}`,
        { modelTier: 'quick' });
      if (!res || !['하', '중', '상'].includes(res.level)) res = null;
    } catch (e) { res = null; if (e && e.code === 'not_granted') $('setup-note').textContent = 'AI 사용을 허용하지 않아 기본 판정으로 정했어요.'; }
  }
  if (!res) res = fallbackLevel(age, setupAns);
  S.child = { name, age }; S.level = res.level; S.levelNotes = [{ ts: Date.now(), level: res.level, why: '시작 레벨' }];
  save();
  $('lv-icon').textContent = LEVEL[res.level].icon;
  $('lv-title').textContent = `${LEVEL[res.level].name} 레벨`;
  $('lv-reason').textContent = res.reason || '';
  $('lv-focus').innerHTML = (res.focus || []).map(f => `<span class="chip">이번에 키울 것: ${f}</span>`).join('');
  btn.disabled = false; $('setup-note').textContent = '';
  show('s-level');
};
$('b-to-village').onclick = openVillage;

/* ============ 마을 ============ */
function openVillage(popId) {
  $('v-title').textContent = `${S.child ? S.child.name : '우리'}의 마을`;
  $('v-level').textContent = `${LEVEL[S.level].icon} ${LEVEL[S.level].name}`;
  $('v-stars').textContent = S.stars;
  $('village-wrap').innerHTML = villageSVG();
  const done = BUILDINGS.filter(b => S.buildings[b.id].done).length;
  $('v-say').textContent = done === 0 ? '빈 땅을 눌러봐!' : done === BUILDINGS.length ? '마을이 다 완성됐어! 대단해!' : `건물 ${done}개 완성! 다음은 어디 만들까?`;
  $('village-wrap').querySelectorAll('.plot').forEach(p => {
    const go = () => startMission(p.dataset.id);
    p.addEventListener('click', go);
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    if (popId && p.dataset.id === popId) p.classList.add('pop');
  });
  show('s-village');
}
$('b-parent-gate').onclick = openGate;

/* ============ 미션 ============ */
let M = null; // {b, m, round, total, retries, seen:[]}
function cur() { // 현재 라운드의 지시 (steps가 있으면 라운드별로 다름)
  if (M.m.steps) return M.m.steps[Math.min(M.round, M.m.steps.length - 1)];
  return M.m;
}
function missionTitle() { return M.m.title.replace('{n}', M.total); }
function hintPhrase() {
  const names = cur().hints.map(h => h[1]).join(', ');
  return M.m.kind ? `${names} 같은 걸 써봐!` : `${names} 같은 거 있잖아!`;
}
function introSpeech() { return M.m.intro ? M.m.intro : `${missionTitle()} ${hintPhrase()} 찍어서 보여줘!`; }
function startMission(id) {
  const b = BUILDINGS.find(x => x.id === id);
  if (S.buildings[id].done) { speak(`${b.name}는 이미 다 만들었어! 다른 땅을 눌러봐.`); $('v-say').textContent = `${b.name}는 다 만들었어! 다른 땅을 눌러봐.`; return; }
  if (!FREE_BUILDINGS.includes(id) && !S.plus) { speak('이 땅은 부모님이 열어줘야 해!'); $('v-say').textContent = '이 땅은 부모님이 열어줘야 해!'; toast('프로토타입: 부모님 화면 → 무료로 시작하기로 열 수 있어요'); return; }
  const m = b.missions[S.level];
  M = { b, m, round: 0, total: m.rounds || ROUNDS[S.level], retries: 0, seen: [] };
  renderMission();
  show('s-mission');
  speak(introSpeech());
}
function renderMission() {
  const c = cur();
  $('m-emoji').textContent = M.b.emoji;
  $('m-title').textContent = missionTitle();
  $('m-counter').textContent = `${M.round}/${M.total}`;
  $('m-dots').innerHTML = Array.from({ length: M.total }, (_, i) => `<span class="dot ${i < M.round ? 'f' : ''}"></span>`).join('');
  let say;
  if (M.m.steps) say = `${M.round + 1}번째: ${c.noun} 찍어봐!`;
  else if (M.m.kind === 'build') say = M.round === 0 ? `${M.m.noun} 만들어서 찍으면 ${M.b.materialName} 하나!` : `다른 물건으로 ${M.m.noun} 하나 더 만들어봐!`;
  else if (M.m.kind === 'place') say = M.round === 0 ? `놓고 찍으면 ${M.b.materialName} 하나!` : `이번엔 다른 데에 놓아볼까?`;
  else say = M.round === 0 ? `${M.b.name}를 만들려면 ${M.b.materialName} ${M.total}개가 필요해!` : `${M.b.materialName} ${M.total - M.round}개 더 찾으면 완성!`;
  $('m-say').textContent = say;
  $('m-hints').innerHTML = c.hints.map(h => `<div class="hint"><div class="e">${h[0]}</div><div class="t">${h[1]}</div></div>`).join('');
}
$('b-m-back').onclick = () => { try { speechSynthesis.cancel(); } catch (e) {} stopCam(); openVillage(); };
$('b-m-speak').onclick = () => speak(introSpeech());

let currentBlob = null, currentURL = null;
let camStream = null, camFacing = 'environment';
function stopCam() { try { if (camStream) camStream.getTracks().forEach(t => t.stop()); } catch (e) {} camStream = null; $('cam-video').srcObject = null; }
async function openCamera() {
  // 1) 앱 안 카메라 시도 → 2) 안 되면 기기 사진 고르기
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      stopCam();
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing } }, audio: false });
      const v = $('cam-video'); v.srcObject = camStream; try { await v.play(); } catch (e) {}
      $('cam-title').textContent = M ? cur().noun : '';
      show('s-camera');
      return;
    } catch (e) { stopCam(); }
  }
  $('file-in').click();
}
function useBlob(blob) {
  currentBlob = blob;
  if (currentURL) URL.revokeObjectURL(currentURL);
  currentURL = URL.createObjectURL(blob);
  $('p-img').src = currentURL;
  show('s-preview');
  speak('이거 맞아?');
}
$('b-shoot').onclick = openCamera;
$('b-cam-close').onclick = () => { stopCam(); show('s-mission'); };
$('b-cam-gallery').onclick = () => { $('file-in').click(); };
$('b-cam-flip').onclick = () => { camFacing = camFacing === 'environment' ? 'user' : 'environment'; openCamera(); };
$('b-cam-shot').onclick = () => {
  const v = $('cam-video');
  if (!v.videoWidth) { toast('카메라가 아직 준비 중이에요'); return; }
  const c = document.createElement('canvas');
  const maxW = 1280, scale = Math.min(1, maxW / v.videoWidth);
  c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  c.toBlob(b => { if (!b) { toast('사진을 만들 수 없어요. 다시 눌러주세요'); return; } stopCam(); useBlob(b); }, 'image/jpeg', 0.88);
};
$('b-p-retake').onclick = openCamera;
$('file-in').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  stopCam();
  useBlob(f);
});
$('b-p-ok').onclick = async () => {
  if (!currentBlob) return;
  const mode = aiMode();
  if (mode === 'manual') { openManual(); return; }
  show('s-judging'); speak('펭펭이가 보고 있어. 잠깐만!');
  try {
    const r = mode === 'sample' ? await judgeWithAI(currentBlob, M.m) : await judgeWithGemini(currentBlob, M.m);
    roundResult(!!r.result, (r.seen || '').toString().slice(0, 6));
  } catch (e) {
    const code = e && e.code;
    if (code === 'not_granted' || code === 'images_unavailable' || code === 'sampling_disabled' || code === 'not_declared') {
      canImages = false; toast('Claude 판정을 쓸 수 없어요'); if (aiMode() === 'gemini') $('b-p-ok').click(); else openManual();
    } else if (code === 'bad_key') { toast('Gemini 키가 맞지 않아요. 부모님 화면에서 확인해주세요'); openManual(); }
    else if (code === 'image_rejected') { toast('사진을 읽을 수 없어요. 다시 찍어볼까요?'); show('s-mission'); }
    else if (code === 'rate_limited') { toast('AI가 바빠요. 잠깐 쉬었다가 다시 해봐요'); show('s-mission'); }
    else { toast('연결이 잠깐 끊겼어요. 부모님이 판정해요'); openManual(); }
  }
};
function openManual() {
  $('mn-img').src = currentURL;
  $('mn-q').textContent = `이 사진이 "${cur().attr}"에 해당하나요? 애매하면 맞아요로 눌러주세요.`;
  show('s-manual');
}
$('b-mn-yes').onclick = () => roundResult(true, '');
$('b-mn-no').onclick = () => roundResult(false, '');

function roundResult(ok, seen) {
  const acts = $('r-actions');
  const c = cur();
  if (ok) {
    M.round += 1; if (seen) M.seen.push(seen);
    S.stars += 1; [].concat(M.m.area).forEach(a => { S.areas[a] = (S.areas[a] || 0) + 1; }); S.areas.number += 1; save();
    const done = M.round >= M.total;
    const found = M.m.kind === 'build' ? `${M.m.noun} 만들었다!` : (seen ? `${seen} 찾았다!` : '찾았다!');
    $('r-emoji').textContent = '✨';
    $('r-word').textContent = found;
    $('r-sub').textContent = `${c.praise} ${M.b.materialName} 하나 얻었어!`;
    $('r-mats').innerHTML = Array.from({ length: M.total }, (_, i) => `<span class="${i < M.round ? 'got' : ''}">${M.b.material}</span>`).join('');
    acts.innerHTML = done ? `<button class="btn" id="b-r-next">완성하기! 🎉</button>` : `<button class="btn coral" id="b-r-next">📷 ${M.m.kind === 'build' ? '하나 더 만들기' : M.m.steps ? '다음 방향으로' : '다음 거 찾기'}</button>`;
    let next = '';
    if (!done) next = M.m.steps ? `이번엔 ${cur().noun} 찍어봐!` : M.m.kind === 'build' ? '다른 물건으로 하나 더 만들어볼까?' : `${M.total - M.round}개 더!`;
    speak(`${M.m.kind === 'build' ? '' : (seen ? seen + ' 찾았구나! ' : '')}${c.praise} ${M.b.materialName} 하나 얻었어! ${done ? '이제 다 모았다!' : next}`);
    $('b-r-next').onclick = () => { if (done) completeBuilding(); else { renderMission(); openCamera(); } };
  } else {
    M.retries += 1;
    const h = c.hints[M.retries % c.hints.length][1];
    $('r-emoji').textContent = '🤔';
    $('r-word').textContent = M.m.kind === 'build' ? '음… 조금만 더 만들어볼까?' : '음… 다른 걸 찾아볼까?';
    $('r-sub').textContent = M.m.kind ? `${h} 같은 걸 써보면 어때?` : `${h}는 어때?`;
    $('r-mats').innerHTML = Array.from({ length: M.total }, (_, i) => `<span class="${i < M.round ? 'got' : ''}">${M.b.material}</span>`).join('');
    acts.innerHTML = `<button class="btn coral" id="b-r-next">📷 다시 찍기</button><button class="btn quiet" id="b-r-hint">🔊 다시 듣기</button>`;
    speak(M.m.kind === 'build' ? `음, 조금만 더 만들어볼까? ${h} 같은 걸 써봐!` : `음, 다른 걸 찾아볼까? ${h}는 어때?`);
    $('b-r-next').onclick = () => { renderMission(); openCamera(); };
    $('b-r-hint').onclick = () => speak(introSpeech());
  }
  show('s-round');
}
function completeBuilding() {
  S.buildings[M.b.id].done = true;
  S.log.unshift({ ts: Date.now(), b: M.b.name, title: missionTitle(), level: S.level, rounds: M.total, retries: M.retries, seen: M.seen });
  S.log = S.log.slice(0, 20);
  // 자동 난이도 조정
  let note = '';
  const order = ['하', '중', '상'];
  if (M.retries === 0) { S.streak += 1; if (S.streak >= 2 && S.level !== '상') { S.level = order[order.indexOf(S.level) + 1]; S.streak = 0; note = `한 번도 안 틀리고 두 번 연속 완성! 레벨이 ${LEVEL[S.level].name}로 올라갔어.`; } }
  else { S.streak = 0; if (M.retries >= 3 && S.level !== '하') { S.level = order[order.indexOf(S.level) - 1]; note = `조금 어려웠나 봐. 레벨을 ${LEVEL[S.level].name}로 맞췄어.`; } }
  if (note) S.levelNotes.unshift({ ts: Date.now(), level: S.level, why: note });
  save();
  $('c-word').textContent = `${M.b.name} 완성!`;
  $('c-svg').innerHTML = `<svg viewBox="-45 -70 90 80" width="180" height="160">${buildingSVG(M.b.id)}</svg>`;
  $('c-stars').textContent = M.total;
  $('c-note').textContent = note;
  show('s-complete');
  speak(`${M.b.name} 완성! 마을이 커졌어! ${note}`);
}
$('b-c-village').onclick = () => openVillage(M.b.id);

/* ============ 부모 게이트/화면 ============ */
let gateAns = 0;
function openGate() {
  const a = 3 + Math.floor(Math.random() * 6), b = 3 + Math.floor(Math.random() * 6);
  gateAns = a + b;
  $('g-q').textContent = `${a} + ${b} = ?`;
  const opts = new Set([gateAns]); while (opts.size < 3) opts.add(gateAns + (Math.floor(Math.random() * 5) - 2) || gateAns + 3);
  $('g-keys').innerHTML = [...opts].sort(() => Math.random() - .5).map(n => `<button class="btn quiet" data-n="${n}">${n}</button>`).join('');
  $('g-keys').querySelectorAll('button').forEach(k => k.onclick = () => { if (+k.dataset.n === gateAns) openParent(); else { toast('다시 골라주세요'); openGate(); } });
  show('s-gate');
}
$('b-g-back').onclick = () => S.child ? openVillage() : show('s-who');
function openParent() {
  $('pa-name').textContent = S.child ? S.child.name : '아이';
  $('pa-age').textContent = S.child ? `만 ${S.child.age}세` : '';
  $('pa-level').textContent = `${LEVEL[S.level].icon} ${LEVEL[S.level].name}`;
  $('pa-level-chips').querySelectorAll('.chip').forEach(c => c.classList.toggle('sel', c.dataset.v === S.level));
  const done = BUILDINGS.filter(b => S.buildings[b.id].done).length;
  $('pa-b').textContent = `${done}/${BUILDINGS.length}`;
  $('pa-m').textContent = S.log.length;
  $('pa-s').textContent = S.stars;
  const maxA = Math.max(1, ...Object.values(S.areas));
  $('pa-areas').innerHTML = Object.keys(AREA_NAME).map(k => `<div><div class="row split"><span>${AREA_NAME[k]}</span><span class="muted">${S.areas[k]}회</span></div><div class="bar"><i style="width:${Math.round(S.areas[k] / maxA * 100)}%"></i></div><div class="muted" style="font-size:12px;margin-top:4px">누리과정: ${AREA_NURI[k]}</div></div>`).join('');
  const logs = S.log.map(l => `<div class="it"><span>${l.b} · ${l.title}</span><span class="muted">${new Date(l.ts).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} · ${LEVEL[l.level].icon} · 다시 ${l.retries}번</span></div>`);
  const notes = S.levelNotes.filter(n => n.why !== '시작 레벨').map(n => `<div class="it"><span>레벨 변경 → ${LEVEL[n.level].name}</span><span class="muted">${n.why}</span></div>`);
  $('pa-log').innerHTML = (notes.concat(logs)).join('') || '<p class="muted">아직 활동이 없어요. 아이와 첫 미션을 해보세요!</p>';
  $('pa-ai').textContent = aiStatusText();
  $('in-gkey').value = S.geminiKey || '';
  loadVoices(); markTone();
  show('s-parent');
}
$('pa-level-chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  S.level = b.dataset.v; S.streak = 0; S.levelNotes.unshift({ ts: Date.now(), level: S.level, why: '부모님이 직접 바꿈' }); save();
  openParent(); toast(`레벨을 ${LEVEL[S.level].name}로 바꿨어요`);
});
$('b-pa-kid').onclick = () => S.child ? openVillage() : openSetup();
$('b-sub').onclick = () => { S.plus = true; save(); toast('프로토타입: 결제는 연결되지 않았어요. 마을 6곳을 모두 열었어요.'); };
$('b-reset').onclick = () => { if (confirm('모든 기록을 지울까요?')) { S = defaultState(); save(); show('s-splash'); } };

$('b-gkey-save').onclick = async () => {
  const k = $('in-gkey').value.trim(); if (!k) { toast('키를 입력해주세요'); return; }
  toast('연결을 확인하고 있어요…');
  try { await verifyGeminiKey(k); save(); $('pa-ai').textContent = aiStatusText(); toast('연결됐어요. 이제 이 기기에서 AI가 판정해요'); }
  catch (e) { $('pa-ai').textContent = aiStatusText(); toast(e && e.code === 'bad_key' ? '키가 맞지 않아요. 다시 복사해주세요' : '연결을 확인하지 못했어요. 잠시 후 다시 시도해주세요'); }
};
$('b-gkey-clear').onclick = () => { delete S.geminiKey; save(); $('in-gkey').value = ''; $('pa-ai').textContent = aiStatusText(); toast('키를 지웠어요'); };

$('sel-voice').addEventListener('change', e => { S.voiceName = e.target.value; save(); speak('안녕! 나는 펭펭이야. 같이 도형 찾으러 가자!'); });
$('voice-tone').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  if (b.dataset.v === 'off') { S.voiceOff = true; } else { S.voiceOff = false; S.voiceTone = b.dataset.v; }
  save(); markTone(); if (!S.voiceOff) speak('안녕! 나는 펭펭이야. 같이 도형 찾으러 가자!');
});
function markTone() { $('voice-tone').querySelectorAll('.chip').forEach(c => c.classList.toggle('sel', S.voiceOff ? c.dataset.v === 'off' : c.dataset.v === (S.voiceTone || 'friend'))); }
$('b-voice-test').onclick = () => speak('안녕! 나는 펭펭이야. 동그라미 두 개 찾아봐! 시계, 접시, 동전 같은 거 있잖아!');

/* 시작 시: 링크에 담긴 키 받기 (#k=AIza...) */
(function () {
  try {
    const h = location.hash || '';
    const m = h.match(/[#&]k=([^&]+)/);
    if (m) {
      const k = decodeURIComponent(m[1]).trim();
      if (k) { S.geminiKey = k; save(); }
      history.replaceState(null, '', location.pathname + location.search);
      if (k) setTimeout(() => toast('AI 판정이 연결됐어요'), 400);
    }
  } catch (e) {}
})();
