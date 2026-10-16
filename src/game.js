import { Band } from './audio.js';
import { SONGS, buildSong, playStep, laneMidi } from './songs.js';
import { cleanStyle, drawDancer, makePose, drawNaira, shade, portrait } from './dancer.js';
import * as startng from './platform.js';

// ---------------------------------------------------------------- setup
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

const LANE_COLORS = ['#13a36b', '#3db8e8', '#e8367a', '#f2b705'];
const LANE_KEYS = ['D', 'F', 'J', 'K'];
const KEYMAP = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
const WINDOWS = { perfect: 0.05, great: 0.095, good: 0.14 };
const POINTS = { perfect: 300, great: 200, good: 100 };
const HYPE_GAIN = { perfect: 0.034, great: 0.024, good: 0.012 };
const OWAMBE_SECONDS = 9;
const SHOUTS = { 25: 'E choke!', 50: 'Gbedu!', 75: 'No dulling!', 100: 'Odogwu!', 150: 'Enjoyment!', 200: 'Baba nla!' };

const store = {
  get(k, d) { try { const v = localStorage.getItem(`owambe:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`owambe:${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
};

const band = new Band();
let W = 0, H = 0, DPR = 1;
let L = {}; // layout

let me = { user: null, player: startng.FALLBACK_GUEST };
let style = cleanStyle(me.player.style);

let state = 'title';
let songIndex = Math.min(store.get('song', 0), SONGS.length - 1);
let offsetMs = store.get('offset', 0);
let run = null; // the current performance
let schedTimer = null;

// visual state that lives across screens
const fx = { particles: [], rings: [], texts: [], shake: 0, flash: [0, 0, 0, 0], press: [0, 0, 0, 0] };
const crowd = [];
let bgPattern = null;
let lastFrame = performance.now();
let idleClock = 0;

// ---------------------------------------------------------------- layout
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const wide = W >= 820 && W / H > 1.05;
  const hw = wide ? Math.min(420, W * 0.4) : Math.min(420, W - 32);
  if (wide) {
    L = {
      wide, hw,
      hx: Math.min(W * 0.64, W - hw / 2 - 40) - hw / 2,
      top: 0,
      hitY: H - Math.max(96, H * 0.13),
      dancerX: W * 0.26,
      dancerY: H * 0.84,
      u: Math.min(H * 0.6 / 4.4, W * 0.075),
      crowdY: H,
    };
  } else {
    const stageH = Math.max(170, H * 0.34);
    L = {
      wide, hw,
      hx: (W - hw) / 2,
      top: stageH,
      hitY: H - Math.max(84, H * 0.11),
      dancerX: W / 2,
      dancerY: stageH - 10,
      u: (stageH - 40) / 4.9,
      crowdY: stageH + 6,
    };
  }
  L.laneW = hw / 4;
  L.noteR = Math.min(L.laneW * 0.34, 30);
  makeCrowd();
  makePattern();
}

function makeCrowd() {
  crowd.length = 0;
  const n = Math.ceil(W / 46) + 2;
  const geles = ['#e8367a', '#f2b705', '#13a36b', '#3db8e8', '#a55eea', '#ff7a3d'];
  let seed = 7;
  const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    crowd.push({
      x: (i / (n - 2)) * W + (r() - 0.5) * 20 - 20,
      h: 46 + r() * 34,
      phase: r() * 2,
      gele: r() < 0.55 ? geles[Math.floor(r() * geles.length)] : null,
      hands: r(),
    });
  }
}

// An adire-inspired resist-dye pattern for the backdrop.
function makePattern() {
  const s = 72;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const p = c.getContext('2d');
  p.strokeStyle = 'rgba(160, 150, 255, 0.07)';
  p.fillStyle = 'rgba(160, 150, 255, 0.07)';
  p.lineWidth = 2;
  for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s], [s / 2, s / 2]]) {
    for (let r = 6; r <= 22; r += 8) { p.beginPath(); p.arc(x, y, r, 0, Math.PI * 2); p.stroke(); }
  }
  for (const [x, y] of [[s / 2, 0], [0, s / 2], [s, s / 2], [s / 2, s]]) {
    p.beginPath(); p.arc(x, y, 3, 0, Math.PI * 2); p.fill();
  }
  bgPattern = ctx.createPattern(c, 'repeat');
}

addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- player
function showPlayer() {
  const p = me.player;
  $('player-name').textContent = p.name || 'Guest';
  $('player-account').textContent = me.user?.account ? `@${me.user.account}` : 'Not signed in';
  style = cleanStyle(p.style);
  $('player-face').src = p.face || portrait(style);
  $('player-sign-in').hidden = !!me.user;
  $('player-card').hidden = false;
}

async function refreshPlayer() {
  const who = await startng.whoami();
  if (who === undefined) return; // start.ng didn't answer: keep what we have
  me = who;
  showPlayer();
}

$('player-sign-in').onclick = () => startng.signIn();
showPlayer();
refreshPlayer();
addEventListener('focus', refreshPlayer);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshPlayer();
  else if (state === 'playing') pause();
});

// ---------------------------------------------------------------- title screen
function renderSongs() {
  const box = $('songs');
  box.replaceChildren(...SONGS.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'invite';
    b.dataset.level = s.level;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(i === songIndex));
    const best = store.get(`best:${s.id}`, null);
    b.innerHTML = `<span class="lvl"></span><h3></h3><p></p><div class="meta"><span></span><span></span></div>`;
    b.querySelector('.lvl').textContent = s.level;
    b.querySelector('h3').textContent = s.title;
    b.querySelector('p').textContent = s.blurb;
    const [bpm, bestEl] = b.querySelectorAll('.meta span');
    bpm.textContent = `${s.bpm} BPM`;
    bestEl.textContent = best ? `Your best ${best.toLocaleString()}` : 'Not played yet';
    b.onclick = () => { songIndex = i; store.set('song', i); renderSongs(); };
    b.ondblclick = () => startSong();
    return b;
  }));
}
renderSongs();

function showOffset() { $('offset').textContent = `${offsetMs > 0 ? '+' : ''}${offsetMs} ms`; }
$('offset-down').onclick = () => { offsetMs = Math.max(-200, offsetMs - 10); store.set('offset', offsetMs); showOffset(); };
$('offset-up').onclick = () => { offsetMs = Math.min(200, offsetMs + 10); store.set('offset', offsetMs); showOffset(); };
showOffset();
if (coarse) $('keys-hint').textContent = 'Tap the drums at the bottom of the screen in time with the falling notes.';

$('start').onclick = () => startSong();
$('board-btn').onclick = async () => {
  $('board').hidden = false;
  await fillBoard($('board-list'), 10);
  $('board-close').focus();
};
$('board-close').onclick = () => { $('board').hidden = true; $('board-btn').focus(); };

async function fillBoard(list, limit) {
  list.replaceChildren(Object.assign(document.createElement('li'), { className: 'empty', textContent: 'Loading the guest list…' }));
  const entries = await startng.leaderboard(limit);
  if (!entries) {
    list.replaceChildren(Object.assign(document.createElement('li'), {
      className: 'empty',
      textContent: startng.canTalkToStartNg ? 'The leaderboard didn’t load. Try again in a moment.' : 'The leaderboard appears once the game is live on start.ng.',
    }));
    return;
  }
  if (!entries.length) {
    list.replaceChildren(Object.assign(document.createElement('li'), { className: 'empty', textContent: 'Nobody has played yet. Be the first name on the list.' }));
    return;
  }
  list.replaceChildren(...entries.map((e) => {
    const li = document.createElement('li');
    if (me.user && e.player_id === me.user.id) li.className = 'me';
    li.innerHTML = '<span class="rk"></span><span class="nm"><i></i><span></span></span><span class="pt"></span><span class="cb"></span>';
    li.querySelector('.rk').textContent = `#${e.rank}`;
    li.querySelector('.nm i').style.background = e.color || '#f2b705';
    li.querySelector('.nm span').textContent = e.name;
    li.querySelector('.pt').textContent = (e.stats?.points ?? e.score ?? 0).toLocaleString();
    li.querySelector('.cb').textContent = e.stats?.best_combo != null ? `${e.stats.best_combo} combo` : '';
    return li;
  }));
}

// ---------------------------------------------------------------- run
function startSong() {
  band.init();
  if (band.ctx.state !== 'running') band.ctx.resume();
  const built = buildSong(SONGS[songIndex]);
  built.chart.forEach((n) => { n.judged = false; n.result = null; });
  run = {
    built,
    startAt: band.now + 0.4,
    nextStep: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hype: 0,
    owambeUntil: -1,
    counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    lastHit: -9,
    stumbleAt: -9,
    nextNote: 0,
    move: 'bounce',
    moveBar: -1,
    ended: false,
    shouted: new Set(),
  };
  fx.particles.length = 0;
  fx.rings.length = 0;
  fx.texts.length = 0;
  state = 'playing';
  document.body.classList.add('playing');
  $('title').hidden = true;
  $('results').hidden = true;
  $('paused').hidden = true;
  $('hud').hidden = false;
  updateHud();
  clearInterval(schedTimer);
  schedTimer = setInterval(schedule, 25);
  schedule();
  canvas.focus?.();
}

function latency() {
  const c = band.ctx;
  return (c.outputLatency || c.baseLatency || 0) + offsetMs / 1000;
}

// The song position the player is hearing right now, in seconds.
function songTime() {
  return band.now - run.startAt - latency();
}

function isOwambe(t = songTime()) {
  return run && t < run.owambeUntil;
}

function schedule() {
  if (!run || state !== 'playing') return;
  const { built } = run;
  const total = built.bars.length * 16;
  const ahead = band.now + 0.12;
  while (run.nextStep < total) {
    const t = run.startAt + run.nextStep * built.stepDur;
    if (t > ahead) break;
    const bar = Math.floor(run.nextStep / 16);
    const step = run.nextStep % 16;
    playStep(band, built, bar, step, t, { owambe: isOwambe(t - run.startAt) });
    run.nextStep++;
  }
}

function judge(lane) {
  fx.press[lane] = 1;
  if (!run || state !== 'playing') return;
  const t = songTime();
  const { chart } = run.built;
  let best = null;
  let bestDt = Infinity;
  for (let i = run.nextNote; i < chart.length; i++) {
    const n = chart[i];
    if (n.time - t > WINDOWS.good) break;
    if (n.judged || n.lane !== lane) continue;
    const dt = Math.abs(n.time - t);
    if (dt < bestDt) { best = n; bestDt = dt; }
  }
  if (!best || bestDt > WINDOWS.good) {
    // a stroke with nothing to play: the drum still sounds, quietly
    const bar = run.built.bars[Math.max(0, Math.floor(t / (run.built.stepDur * 16)))] ?? run.built.bars[0];
    band.talkingDrum(band.now, laneMidi(run.built.song, bar, lane), lane, 0.35);
    run.hype = Math.max(0, run.hype - 0.015);
    return;
  }
  const result = bestDt <= WINDOWS.perfect ? 'perfect' : bestDt <= WINDOWS.great ? 'great' : 'good';
  best.judged = true;
  best.result = result;
  band.talkingDrum(band.now, best.midi, lane, result === 'good' ? 0.75 : 1);
  run.counts[result]++;
  run.combo++;
  run.maxCombo = Math.max(run.maxCombo, run.combo);
  const owambe = isOwambe(t);
  run.score += POINTS[result] * multiplier() * (owambe ? 2 : 1);
  run.lastHit = t;
  fx.flash[lane] = 1;
  ring(lane, result);
  popText(result === 'perfect' ? 'Perfect' : result === 'great' ? 'Great' : 'Good', result);

  if (!owambe) {
    run.hype = Math.min(1, run.hype + HYPE_GAIN[result]);
    if (run.hype >= 1) startOwambe(t);
  }
  if (SHOUTS[run.combo] && !run.shouted.has(run.combo)) {
    run.shouted.add(run.combo);
    shout(SHOUTS[run.combo]);
    band.cheer(band.now, 0.55, 1.4);
  }
  // money starts flying once the crowd is into it
  const sprays = owambe ? 2 : run.combo >= 30 ? 2 : run.combo >= 12 ? 1 : 0;
  for (let i = 0; i < sprays; i++) spawnNote();
  updateHud();
}

function multiplier() {
  return 1 + Math.min(3, Math.floor(run.combo / 10));
}

function startOwambe(t) {
  run.owambeUntil = t + OWAMBE_SECONDS;
  run.hype = 1;
  band.whistle(band.now);
  band.cheer(band.now, 1, 2.6);
  shout('Owambe Mode!', true);
  if (!reduceMotion) fx.shake = 1;
  for (let i = 0; i < 30; i++) spawnNote(true);
}

function miss(n) {
  n.judged = true;
  n.result = 'miss';
  run.counts.miss++;
  if (run.combo >= 20) band.dud(band.now);
  run.combo = 0;
  run.stumbleAt = n.time;
  if (isOwambe(n.time)) run.owambeUntil -= 0.8;
  else run.hype = Math.max(0, run.hype - 0.09);
  popText('Miss', 'miss');
  updateHud();
}

function updateHud() {
  if (!run) return;
  $('score').textContent = run.score.toLocaleString();
  const owambe = isOwambe();
  $('mult').textContent = `${run.combo >= 10 ? `${run.combo} combo, ` : ''}×${multiplier() * (owambe ? 2 : 1)}`;
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  band.ctx.suspend();
  $('paused').hidden = false;
  $('resume').focus();
}

function resume() {
  if (state !== 'paused') return;
  $('paused').hidden = true;
  band.ctx.resume();
  state = 'playing';
}

function toTitle() {
  clearInterval(schedTimer);
  if (band.ctx) band.ctx.resume();
  state = 'title';
  run = null;
  document.body.classList.remove('playing');
  $('paused').hidden = true;
  $('results').hidden = true;
  $('hud').hidden = true;
  $('title').hidden = false;
  renderSongs();
  $('start').focus();
}

$('pause-btn').onclick = pause;
$('resume').onclick = resume;
$('quit').onclick = () => { if (band.ctx) band.master.gain.setTargetAtTime(0.0001, band.now, 0.05); setTimeout(() => { if (band.master) band.master.gain.setTargetAtTime(0.72, band.now, 0.01); }, 300); toTitle(); };
$('again').onclick = () => startSong();
$('menu').onclick = toTitle;

const VERDICTS = {
  S: 'The aunties emptied their purses. The MC wants your number.',
  A: 'The MC called your name twice. Proper odogwu drumming.',
  B: 'Solid set. You’ve earned your small chops.',
  C: 'The party survived. Work on that squeeze.',
  D: 'The DJ had to take over. Shake it off and play again.',
};

async function finish() {
  const r = run;
  r.ended = true;
  state = 'results';
  clearInterval(schedTimer);
  const { perfect, great, good, miss: misses } = r.counts;
  const total = r.built.chart.length;
  const acc = total ? (perfect + great * 0.7 + good * 0.4) / total : 0;
  const grade = acc >= 0.95 && misses <= 2 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.6 ? 'C' : 'D';
  const song = r.built.song;
  const prev = store.get(`best:${song.id}`, 0);
  if (r.score > prev) store.set(`best:${song.id}`, r.score);

  $('grade').textContent = grade;
  $('song-done').textContent = `${song.title}, ${song.level.toLowerCase()}`;
  $('verdict').textContent = VERDICTS[grade];
  $('r-score').textContent = r.score.toLocaleString();
  $('r-combo').textContent = r.maxCombo;
  $('r-acc').textContent = `${Math.round(acc * 100)}%`;
  $('r-tally').innerHTML = '';
  [['p', 'Perfect', perfect], ['g', 'Great', great], ['o', 'Good', good], ['m', 'Missed', misses]].forEach(([c, label, v]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="${c}"></span> <b></b>`;
    li.querySelector('span').textContent = label;
    li.querySelector('b').textContent = v;
    $('r-tally').append(li);
  });
  $('hud').hidden = true;
  $('results').hidden = false;
  $('again').focus();
  document.body.classList.remove('playing');

  const status = $('save-status');
  if (me.user) {
    status.textContent = 'Saving your set to start.ng…';
    const saved = await startng.saveRun({ points: r.score, best_combo: r.maxCombo });
    if (saved.ok) {
      const res = saved.result ?? {};
      status.textContent = res.improved ? `New personal best. You’re #${res.rank} on the board.` : `Saved. Your best still stands at ${(res.best ?? 0).toLocaleString()} (#${res.rank}).`;
    } else {
      status.textContent = saved.error || 'Your run wasn’t saved.';
    }
  } else {
    status.textContent = 'Sign in with start.ng to put your score on the board.';
    if (startng.canTalkToStartNg) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Sign in';
      b.onclick = () => startng.signIn();
      status.append(b);
    }
  }
  fillBoard($('r-board'), 5);
}

// ---------------------------------------------------------------- input
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (state === 'playing') {
    if (e.code in KEYMAP) {
      e.preventDefault();
      if (!e.repeat) judge(KEYMAP[e.code]);
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); pause(); }
    return;
  }
  if (state === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) { e.preventDefault(); resume(); return; }
  if (state === 'title' && $('board').hidden) {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      if (document.activeElement?.classList.contains('invite') || document.activeElement === document.body) {
        songIndex = (songIndex + (e.code === 'ArrowRight' ? 1 : SONGS.length - 1)) % SONGS.length;
        store.set('song', songIndex);
        renderSongs();
        $('songs').children[songIndex].focus();
        e.preventDefault();
      }
    }
    if (e.code === 'Enter' && document.activeElement === document.body) startSong();
  }
  if (e.code === 'Escape' && !$('board').hidden) { $('board').hidden = true; }
});

canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'playing') return;
  e.preventDefault();
  const x = e.clientX - L.hx;
  if (e.clientY < L.top + 40) return;
  let lane = Math.floor(x / L.laneW);
  // let thumbs that land just outside the highway still count
  if (x < 0 && x > -L.laneW) lane = 0;
  if (x >= L.hw && x < L.hw + L.laneW) lane = 3;
  if (lane >= 0 && lane < 4) judge(lane);
});

// ---------------------------------------------------------------- effects
function ring(lane, result) {
  fx.rings.push({ lane, life: 1, color: result === 'perfect' ? '#f2b705' : LANE_COLORS[lane] });
}
function popText(text, kind) {
  fx.texts = fx.texts.filter((t) => t.big);
  fx.texts.push({ text, kind, life: 1, big: false });
}
function shout(text, gold) {
  fx.texts = fx.texts.filter((t) => !t.big);
  fx.texts.push({ text, kind: gold ? 'owambe' : 'shout', life: 1, big: true });
}
function spawnNote(burst) {
  if (fx.particles.length > (reduceMotion ? 24 : 110)) return;
  const cx = L.dancerX;
  const spread = L.wide ? W * 0.22 : W * 0.5;
  fx.particles.push({
    x: cx + (Math.random() - 0.5) * spread * 2,
    y: burst ? -20 - Math.random() * H * 0.4 : -20,
    vy: 50 + Math.random() * 60,
    sway: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 3,
    kind: Math.floor(Math.random() * 3),
    s: 0.8 + Math.random() * 0.5,
    floor: (L.wide ? L.dancerY : L.top) + Math.random() * 14,
    rest: 0,
  });
}

// ---------------------------------------------------------------- drawing
function drawBackground(t, beat, energy, owambe) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, Math.max(W, H) * 0.8);
  g.addColorStop(0, '#30278a');
  g.addColorStop(0.55, '#1b1446');
  g.addColorStop(1, '#0f0a2c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = bgPattern;
  ctx.fillRect(0, 0, W, H);

  if (owambe > 0) {
    const og = ctx.createLinearGradient(0, 0, 0, H);
    og.addColorStop(0, `rgba(242, 183, 5, ${0.28 * owambe})`);
    og.addColorStop(1, `rgba(232, 54, 122, ${0.18 * owambe})`);
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, W, H);
  }

  // spotlight beams on the dancer
  const pulse = Math.pow(1 - (beat % 1), 3) * energy;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const sx = L.dancerX;
  const floor = L.dancerY;
  [-1, 1].forEach((d, i) => {
    const bx = sx + d * (L.wide ? W * 0.18 : W * 0.4);
    const beam = ctx.createLinearGradient(bx, 0, sx, floor);
    const col = i ? '232, 54, 122' : '61, 184, 232';
    beam.addColorStop(0, `rgba(${col}, ${0.2 + pulse * 0.25})`);
    beam.addColorStop(1, `rgba(${col}, 0)`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(bx - 14, 0);
    ctx.lineTo(bx + 14, 0);
    const spread = L.u * (1.6 + Math.sin(t * 0.7 + i) * 0.3);
    ctx.lineTo(sx + spread, floor);
    ctx.lineTo(sx - spread, floor);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();

  drawCanopy(t, beat, energy, owambe);
}

// The party tent: a scalloped valance and string lights.
function drawCanopy(t, beat, energy, owambe) {
  const sc = Math.max(34, Math.min(56, W / 18));
  const depth = 26;
  ctx.fillStyle = owambe > 0.5 ? '#f2b705' : '#fff4dc';
  ctx.fillRect(0, 0, W, depth - 8);
  for (let x = 0, i = 0; x < W + sc; x += sc, i++) {
    ctx.fillStyle = i % 2 ? '#f2b705' : '#fff4dc';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + sc, 0);
    ctx.lineTo(x + sc, depth - 8);
    ctx.quadraticCurveTo(x + sc / 2, depth + 14, x, depth - 8);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(15,10,44,0.18)';
  ctx.fillRect(0, depth - 10, W, 3);

  // string lights hanging in arcs
  const bulbs = ['#f2b705', '#e8367a', '#13a36b', '#3db8e8'];
  const span = Math.max(220, W / 4);
  const beatI = Math.floor(beat);
  ctx.strokeStyle = 'rgba(255,244,220,0.35)';
  ctx.lineWidth = 1.5;
  for (let x0 = -span / 2; x0 < W + span; x0 += span) {
    ctx.beginPath();
    ctx.moveTo(x0, depth + 4);
    ctx.quadraticCurveTo(x0 + span / 2, depth + 70, x0 + span, depth + 4);
    ctx.stroke();
    for (let k = 1; k < 8; k++) {
      const f = k / 8;
      const bx = x0 + span * f;
      const by = (1 - f) * (1 - f) * (depth + 4) + 2 * (1 - f) * f * (depth + 70) + f * f * (depth + 4);
      const idx = (k + Math.round(x0 / span) + beatI) % 4;
      const on = energy > 0.15 ? (k + beatI) % 2 === 0 || energy > 0.8 : true;
      const col = bulbs[(idx + 4) % 4];
      ctx.fillStyle = on ? col : shade(col, -0.55);
      ctx.beginPath();
      ctx.arc(bx, by + 5, 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (on) {
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.25 * energy;
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(bx, by + 5, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

function drawStageFloor() {
  const y = L.dancerY;
  ctx.fillStyle = 'rgba(10, 6, 34, 0.55)';
  ctx.beginPath();
  ctx.ellipse(L.dancerX, y + 4, L.u * 2.6, L.u * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242, 183, 5, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(L.dancerX, y + 4, L.u * 2.6, L.u * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCrowd(beat, energy) {
  const base = L.crowdY;
  crowd.forEach((p) => {
    const b = beat + p.phase * 0.25;
    const bob = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * b), 2) * (4 + energy * 10);
    const h = p.h * (L.wide ? 1 : 0.5);
    const x = p.x;
    const y = base - h + bob;
    ctx.fillStyle = '#0c0826';
    // hands up when the party is lit
    if (energy > 0.55 && p.hands < energy) {
      ctx.strokeStyle = '#0c0826';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      const wave = Math.sin(Math.PI * b) * 6;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 22); ctx.lineTo(x - 18 + wave, y - 18);
      ctx.moveTo(x + 10, y + 22); ctx.lineTo(x + 18 + wave, y - 18);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - 20, y + 16, 40, h, 14) : ctx.rect(x - 20, y + 16, 40, h);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y + 6, 13, 0, Math.PI * 2);
    ctx.fill();
    if (p.gele) {
      // a gele headtie fanning up
      ctx.fillStyle = shade(p.gele, -0.35);
      ctx.beginPath();
      ctx.moveTo(x - 16, y + 2);
      ctx.quadraticCurveTo(x - 24, y - 20, x - 4, y - 16);
      ctx.quadraticCurveTo(x + 8, y - 30, x + 22, y - 10);
      ctx.quadraticCurveTo(x + 18, y + 2, x + 12, y + 2);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function drawHighway(t, beat) {
  const { hx, hw, top, hitY, laneW, noteR } = L;
  const bottom = H;
  // body
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(15, 10, 44, 0)');
  g.addColorStop(0.18, 'rgba(15, 10, 44, 0.72)');
  g.addColorStop(1, 'rgba(15, 10, 44, 0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(hx, top, hw, bottom - top);

  // edges, gold lace
  ctx.fillStyle = 'rgba(242, 183, 5, 0.65)';
  for (let y = top + 30; y < bottom; y += 14) {
    ctx.beginPath(); ctx.arc(hx, y, 2, 0, Math.PI * 2); ctx.arc(hx + hw, y, 2, 0, Math.PI * 2); ctx.fill();
  }
  // lane dividers
  ctx.strokeStyle = 'rgba(255, 244, 220, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(hx + i * laneW, top + 20); ctx.lineTo(hx + i * laneW, bottom); ctx.stroke();
  }
  // lane glow when pressed
  for (let i = 0; i < 4; i++) {
    if (fx.press[i] > 0.01) {
      const lg = ctx.createLinearGradient(0, hitY, 0, top + (hitY - top) * 0.3);
      lg.addColorStop(0, hexA(LANE_COLORS[i], 0.32 * fx.press[i]));
      lg.addColorStop(1, hexA(LANE_COLORS[i], 0));
      ctx.fillStyle = lg;
      ctx.fillRect(hx + i * laneW, top, laneW, hitY - top);
    }
  }

  if (!run) return;
  const { built } = run;
  const lead = built.song.lead;
  const pxPerSec = (hitY - top) / lead;
  const yOf = (nt) => hitY - (nt - t) * pxPerSec;

  // beat lines
  const spb = built.spb;
  const firstBeat = Math.floor(t / spb);
  for (let b = firstBeat; b < firstBeat + lead / spb + 2; b++) {
    const y = yOf(b * spb);
    if (y < top + 10 || y > hitY) continue;
    ctx.strokeStyle = b % 4 === 0 ? 'rgba(242, 183, 5, 0.28)' : 'rgba(255, 244, 220, 0.07)';
    ctx.lineWidth = b % 4 === 0 ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(hx, y); ctx.lineTo(hx + hw, y); ctx.stroke();
  }

  // drum heads at the hit line
  for (let i = 0; i < 4; i++) {
    const cx = hx + laneW * (i + 0.5);
    const press = fx.press[i];
    const flash = fx.flash[i];
    ctx.save();
    ctx.translate(cx, hitY);
    ctx.scale(1 + flash * 0.08, 1 - press * 0.12);
    // tension strings of the talking drum
    ctx.strokeStyle = hexA(LANE_COLORS[i], 0.6);
    ctx.lineWidth = 1.5;
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(k * noteR * 0.28, noteR * 0.9);
      ctx.lineTo(k * noteR * 0.18, noteR * 2.1);
      ctx.stroke();
    }
    ctx.fillStyle = shade(LANE_COLORS[i], -0.55);
    ctx.beginPath(); ctx.arc(0, 0, noteR * 1.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash > 0.05 ? shade('#fff4dc', 0) : '#e9dcc0';
    ctx.globalAlpha = 0.25 + flash * 0.75 + press * 0.2;
    ctx.beginPath(); ctx.arc(0, 0, noteR * 0.88, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = LANE_COLORS[i];
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, noteR * 1.02, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (!coarse) {
      ctx.fillStyle = 'rgba(255, 244, 220, 0.55)';
      ctx.font = '700 13px "Familjen Grotesk", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(LANE_KEYS[i], cx, hitY + noteR * 1.75);
    }
  }

  // notes
  const chart = built.chart;
  // links between notes struck together
  for (let i = run.nextNote; i < chart.length; i++) {
    const n = chart[i];
    if (n.time - t > lead + 0.1) break;
    if (n.judged || !n.double) continue;
    const pair = chart.find((o) => o !== n && !o.judged && Math.abs(o.time - n.time) < 1e-6 && o.lane > n.lane);
    if (!pair) continue;
    const y = yOf(n.time);
    ctx.strokeStyle = 'rgba(242, 183, 5, 0.75)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(hx + laneW * (n.lane + 0.5), y);
    ctx.lineTo(hx + laneW * (pair.lane + 0.5), y);
    ctx.stroke();
  }
  for (let i = run.nextNote; i < chart.length; i++) {
    const n = chart[i];
    if (n.time - t > lead + 0.1) break;
    if (n.judged && n.result !== 'miss') continue;
    let y = yOf(n.time);
    if (y < top - noteR) continue;
    const cx = hx + laneW * (n.lane + 0.5);
    const missed = n.result === 'miss';
    const appear = Math.min(1, (y - top) / 60);
    ctx.globalAlpha = missed ? Math.max(0, 0.5 - (t - n.time) * 1.5) : Math.max(0, appear);
    const col = missed ? '#5a4f80' : LANE_COLORS[n.lane];
    ctx.fillStyle = shade(col, -0.35);
    ctx.beginPath(); ctx.arc(cx, y + 3, noteR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx, y, noteR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = missed ? '#8a80aa' : shade(col, 0.55);
    ctx.beginPath(); ctx.arc(cx, y, noteR * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(cx - noteR * 0.35, y - noteR * 0.42, noteR * 0.22, noteR * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // rings
  fx.rings.forEach((r) => {
    const cx = hx + laneW * (r.lane + 0.5);
    ctx.strokeStyle = hexA(r.color, r.life);
    ctx.lineWidth = 4 * r.life;
    ctx.beginPath();
    ctx.arc(cx, hitY, noteR * (1.1 + (1 - r.life) * 1.1), 0, Math.PI * 2);
    ctx.stroke();
  });

  // combo watermark
  if (run.combo >= 5) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff4dc';
    ctx.font = `400 ${Math.min(hw * 0.32, 120)}px Shrikhand, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(run.combo), hx + hw / 2, top + (hitY - top) * 0.45);
    ctx.restore();
  }

  // hype meter along the right edge
  const owambe = isOwambe(t);
  const level = owambe ? Math.max(0, (run.owambeUntil - t) / OWAMBE_SECONDS) : run.hype;
  const mx = hx + hw + 12;
  if (!L.wide) {
    // on narrow screens the meter runs across the top of the highway
    const my = top + 2;
    ctx.fillStyle = 'rgba(255, 244, 220, 0.14)';
    roundRect(hx, my, hw, 6, 3); ctx.fill();
    const mg = ctx.createLinearGradient(hx, 0, hx + hw, 0);
    mg.addColorStop(0, '#e8367a');
    mg.addColorStop(1, '#f2b705');
    ctx.fillStyle = mg;
    roundRect(hx, my, hw * level, 6, 3); ctx.fill();
  } else {
    const mTop = top + (hitY - top) * 0.25;
    const mH = hitY - mTop;
    ctx.fillStyle = 'rgba(255, 244, 220, 0.12)';
    roundRect(mx, mTop, 8, mH, 4); ctx.fill();
    const mg = ctx.createLinearGradient(0, mTop + mH, 0, mTop);
    mg.addColorStop(0, '#e8367a');
    mg.addColorStop(1, '#f2b705');
    ctx.fillStyle = mg;
    roundRect(mx, mTop + mH * (1 - level), 8, mH * level, 4); ctx.fill();
    ctx.save();
    ctx.translate(mx + 4, mTop - 10);
    ctx.fillStyle = owambe ? '#f2b705' : 'rgba(255,244,220,0.7)';
    ctx.font = '700 12px "Familjen Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Hype', 0, 0);
    ctx.restore();
  }
}

function drawTexts(dt) {
  const { hx, hw, top, hitY } = L;
  fx.texts.forEach((tx) => {
    tx.life -= dt * (tx.big ? 0.55 : 1.6);
    if (tx.life <= 0) return;
    const p = 1 - tx.life;
    ctx.save();
    if (tx.big) {
      const cx = L.wide ? L.dancerX : W / 2;
      const cy = L.wide ? H * 0.2 : top + (hitY - top) * 0.25;
      const s = p < 0.15 ? 0.6 + (p / 0.15) * 0.5 : 1.1 - Math.min(0.1, (p - 0.15));
      ctx.translate(cx, cy);
      ctx.rotate(-0.06);
      ctx.scale(s, s);
      ctx.globalAlpha = Math.min(1, tx.life * 2.5);
      const size = Math.min(L.wide ? 72 : 52, W / 8);
      ctx.font = `400 ${size}px Shrikhand, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f0a2c';
      ctx.fillText(tx.text, 0, size * 0.12);
      ctx.fillStyle = tx.kind === 'owambe' ? '#f2b705' : '#fff4dc';
      ctx.fillText(tx.text, 0, 0);
    } else {
      const cx = hx + hw / 2;
      const cy = hitY - L.noteR * 2.6 - p * 18;
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      ctx.font = `400 ${tx.kind === 'perfect' ? 30 : 26}px Shrikhand, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const col = { perfect: '#f2b705', great: '#3db8e8', good: '#8fe3b8', miss: '#ff8db5' }[tx.kind];
      ctx.fillStyle = '#0f0a2c';
      ctx.fillText(tx.text, cx, cy + 3);
      ctx.fillStyle = col;
      ctx.fillText(tx.text, cx, cy);
    }
    ctx.restore();
  });
  fx.texts = fx.texts.filter((tx) => tx.life > 0);
}

function drawParticles(dt, t) {
  fx.particles.forEach((p) => {
    if (p.y < p.floor) {
      p.y += p.vy * dt;
      p.sway += dt * 3;
      p.x += Math.sin(p.sway) * 40 * dt;
      p.rot += p.vr * dt + Math.cos(p.sway) * dt;
    } else {
      p.rest += dt;
    }
    const w = 34 * p.s * (L.wide ? 1 : 0.8);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.y < p.floor ? p.rot : 0.1 * Math.sin(p.rot));
    ctx.scale(1, p.y < p.floor ? Math.cos(p.sway * 0.7) * 0.8 + 0.2 : 0.35);
    drawNaira(ctx, w, w * 0.48, p.kind, Math.max(0, 1 - p.rest / 2.5));
    ctx.restore();
  });
  fx.particles = fx.particles.filter((p) => p.rest < 2.5 && p.y < H + 40);
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  idleClock += dt;

  let t, beat, energy, owambeAmt = 0;
  if (run) {
    t = state === 'paused' ? run.pausedT ?? songTime() : songTime();
    if (state === 'paused') run.pausedT = t; else run.pausedT = undefined;
    beat = t / run.built.spb;
    const owambe = isOwambe(t);
    owambeAmt = owambe ? Math.min(1, (run.owambeUntil - t) * 2, (t - (run.owambeUntil - OWAMBE_SECONDS)) * 4) : 0;
    energy = owambe ? 1 : Math.min(1, run.combo / 40 + run.hype * 0.4);

    if (state === 'playing') {
      // misses and end of song
      const chart = run.built.chart;
      while (run.nextNote < chart.length && chart[run.nextNote].judged) run.nextNote++;
      for (let i = run.nextNote; i < chart.length; i++) {
        const n = chart[i];
        if (t - n.time <= WINDOWS.good) break;
        if (!n.judged) miss(n);
      }
      $('progress').style.width = `${Math.min(100, (t / run.built.length) * 100)}%`;
      if (!run.ended && t > run.built.length + 0.4) finish();
      updateHudSoft();
    }
  } else {
    t = idleClock;
    beat = idleClock * (100 / 60);
    energy = 0.35;
  }

  ctx.save();
  if (fx.shake > 0) {
    const s = fx.shake * 8;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    fx.shake = Math.max(0, fx.shake - dt * 2.5);
  }
  drawBackground(t, beat, energy, owambeAmt);
  if (L.wide && run) drawStageFloor();

  // the dancer
  let move = 'bounce';
  let stumble = 0;
  if (run) {
    const bar = Math.floor(beat / 4);
    if (bar !== run.moveBar && bar % 2 === 0) {
      run.moveBar = bar;
      const pool = owambeAmt > 0 ? ['spray', 'gwara', 'spray', 'zanku']
        : energy > 0.7 ? ['gwara', 'zanku', 'shaku', 'spray']
        : energy > 0.3 ? ['shaku', 'zanku', 'bounce', 'gwara']
        : ['bounce', 'shaku', 'bounce'];
      run.move = pool[Math.floor(bar / 2) % pool.length];
    }
    move = run.move;
    stumble = Math.max(0, 1 - (t - run.stumbleAt) / 0.5);
    if (t < 0) move = 'bounce';
  } else {
    move = ['bounce', 'shaku', 'zanku', 'gwara'][Math.floor(beat / 8) % 4];
  }
  const pose = makePose(beat, move, energy, stumble);
  if (!L.wide) drawCrowd(beat, energy);
  // on the title screen the dancer waits in the side gutter, if there's room
  const gutter = (W - 880) / 2;
  if (run || (!L.wide ? false : gutter >= 190)) {
    const dx = run ? L.dancerX : W - gutter / 2;
    const du = run ? L.u : Math.min(L.u, gutter / 2.6);
    drawDancer(ctx, style, dx, L.dancerY, du, pose, { time: t, cash: move === 'spray' });
  }
  if (L.wide) drawCrowd(beat, energy);
  drawParticles(dt, t);
  if (run) drawHighway(t, beat);
  drawCountIn(t);
  drawTexts(dt);
  ctx.restore();

  for (let i = 0; i < 4; i++) {
    fx.press[i] = Math.max(0, fx.press[i] - dt * 6);
    fx.flash[i] = Math.max(0, fx.flash[i] - dt * 5);
  }
  fx.rings.forEach((r) => (r.life -= dt * 3));
  fx.rings = fx.rings.filter((r) => r.life > 0);
  // the odd note drifts down even between hits when the crowd is happy
  if (run && state === 'playing' && energy > 0.6 && Math.random() < dt * (owambeAmt > 0 ? 6 : 1.5)) spawnNote();

  requestAnimationFrame(frame);
}

let hudShownOwambe = false;
function updateHudSoft() {
  const o = isOwambe();
  if (o !== hudShownOwambe) { hudShownOwambe = o; updateHud(); }
}

// "3, 2, 1" over the last intro bar, then "Play!"
function drawCountIn(t) {
  if (!run) return;
  const spb = run.built.spb;
  const firstNote = run.built.chart[0]?.time ?? 0;
  const beatsLeft = (firstNote - t) / spb;
  if (beatsLeft > 4 || beatsLeft < -1) return;
  const label = beatsLeft > 3 ? '3' : beatsLeft > 2 ? '2' : beatsLeft > 1 ? '1' : beatsLeft > 0 ? 'Play!' : '';
  if (!label) return;
  const frac = 1 - (beatsLeft % 1);
  ctx.save();
  ctx.globalAlpha = 1 - frac * 0.7;
  const size = Math.min(110, W / 5) * (1 + (1 - frac) * 0.2);
  ctx.font = `400 ${size}px Shrikhand, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = L.hx + L.hw / 2;
  const cy = L.top + (L.hitY - L.top) * 0.45;
  ctx.fillStyle = '#0f0a2c';
  ctx.fillText(label, cx, cy + 6);
  ctx.fillStyle = '#f2b705';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, Math.max(0, h), Math.min(r, h / 2));
  else ctx.rect(x, y, w, h);
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

requestAnimationFrame(frame);
$('start').focus();

// handy for testing in the console
window.owambe = { SONGS, buildSong, songTime: () => songTime(), get run() { return run; } };
