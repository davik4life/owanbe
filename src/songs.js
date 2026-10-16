// The set list, the band's parts, and the drum chart the player plays.
// Charts are generated from a fixed seed, so every player gets the same song.

const MAJOR = [0, 4, 7, 12];
const MINOR = [0, 3, 7, 12];

export const SONGS = [
  {
    id: 'small-chops',
    title: 'Small Chops',
    level: 'Easy',
    blurb: 'A slow highlife groove to warm up the hall.',
    bpm: 96,
    seed: 2024,
    root: 48, // C
    prog: [[0, MAJOR], [5, MAJOR], [0, MAJOR], [7, MAJOR]],
    form: [['intro', 2], ['verse', 8], ['chorus', 8], ['break', 4], ['verse', 8], ['chorus', 8], ['outro', 2]],
    diff: 0,
    lead: 1.75,
  },
  {
    id: 'aso-ebi',
    title: 'Aso-Ebi',
    level: 'Medium',
    blurb: 'Everybody in matching lace. Keep up.',
    bpm: 108,
    seed: 1960,
    root: 45, // A minor
    prog: [[0, MINOR], [8, MAJOR], [3, MAJOR], [10, MAJOR]],
    form: [['intro', 2], ['verse', 8], ['chorus', 8], ['break', 4], ['verse', 8], ['chorus', 8], ['chorus', 4], ['outro', 2]],
    diff: 1,
    lead: 1.45,
  },
  {
    id: 'jollof-wahala',
    title: 'Jollof Wahala',
    level: 'Hard',
    blurb: 'The rice has finished and the DJ is not slowing down.',
    bpm: 122,
    seed: 4242,
    root: 50, // D
    prog: [[0, MAJOR], [7, MAJOR], [9, MINOR], [5, MAJOR]],
    form: [['intro', 2], ['verse', 8], ['chorus', 8], ['break', 4], ['verse', 8], ['chorus', 8], ['chorus', 8], ['outro', 2]],
    diff: 2,
    lead: 1.2,
  },
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fold = (m, lo) => lo + ((((m - lo) % 12) + 12) % 12);

// How likely each sixteenth of the bar is to carry a drum stroke.
const WEIGHT = [1, 0.12, 0.55, 0.5, 0.85, 0.12, 0.62, 0.42, 0.95, 0.12, 0.55, 0.5, 0.85, 0.12, 0.62, 0.45];
const DENSITY = {
  verse: [0.5, 0.62, 0.72],
  chorus: [0.68, 0.85, 1.0],
  break: [0.3, 0.4, 0.55],
  outro: [0.4, 0.5, 0.6],
};

function allowed(step, diff) {
  if (diff === 0) return step % 2 === 0;
  if (diff === 1) return step % 2 === 0 || step === 3 || step === 11;
  return true;
}

export function buildSong(song) {
  const spb = 60 / song.bpm;
  const stepDur = spb / 4;
  const rand = rng(song.seed);
  const bars = [];
  song.form.forEach(([type, count], sectionIndex) => {
    for (let i = 0; i < count; i++) {
      const [off, tones] = song.prog[bars.length % song.prog.length];
      bars.push({ type, i, count, sectionIndex, off, tones, last: sectionIndex === song.form.length - 1 && i === count - 1 });
    }
  });

  const isFinal = (sectionIndex) => song.form.slice(sectionIndex + 1).every(([t]) => t !== 'chorus');

  const makeMotif = (density) => {
    let steps = [];
    let tries = 0;
    while (steps.length < 3 && tries++ < 20) {
      steps = [];
      let last = -9;
      for (let s = 0; s < 16; s++) {
        if (!allowed(s, song.diff)) continue;
        const gap = s - last;
        if (song.diff < 2 && gap < 2 && !(song.diff === 1 && (s === 3 || s === 11))) continue;
        if (song.diff === 2 && gap === 1 && steps.length > 1 && steps[steps.length - 1] - steps[steps.length - 2] === 1) continue;
        if (rand() < WEIGHT[s] * density) {
          steps.push(s);
          last = s;
        }
      }
    }
    let lane = Math.floor(rand() * 4);
    const moves = [-1, 1, 1, -1, 2, -2, 0, 1];
    return steps.map((s) => {
      const note = { step: s, lane };
      let next = lane + moves[Math.floor(rand() * moves.length)];
      if (next < 0) next = 1;
      if (next > 3) next = 2;
      lane = next;
      return note;
    });
  };

  const notes = [];
  let motifs = null;
  let motifSection = -1;
  bars.forEach((bar, b) => {
    if (bar.type === 'intro') return;
    if (bar.sectionIndex !== motifSection) {
      motifSection = bar.sectionIndex;
      let d = DENSITY[bar.type][song.diff];
      if (bar.type === 'chorus' && isFinal(bar.sectionIndex)) d *= 1.12;
      motifs = { A: makeMotif(d), B: makeMotif(d), fill: makeMotif(Math.min(1.25, d * 1.3)) };
    }
    let pattern;
    if (bar.last) pattern = [{ step: 0, lane: 0 }, { step: 0, lane: 3 }];
    else if (bar.i % 4 === 3) pattern = motifs.fill;
    else if (bar.i % 4 === 2) pattern = motifs.B;
    else pattern = motifs.A;

    const chordChance = bar.type === 'chorus' ? [0, 0.35, 0.55][song.diff] : bar.type === 'verse' ? [0, 0, 0.2][song.diff] : 0;
    const startsPhrase = bar.i % 2 === 0;
    pattern.forEach((p) => {
      notes.push({ bar: b, step: p.step, lane: p.lane });
      if (p.step === 0 && startsPhrase && !bar.last && rand() < chordChance) {
        notes.push({ bar: b, step: p.step, lane: (p.lane + 2) % 4 });
      }
    });
  });

  // dedupe and sort, then time and pitch each stroke
  const seen = new Set();
  const chart = [];
  notes.forEach((n) => {
    const key = `${n.bar}:${n.step}:${n.lane}`;
    if (seen.has(key)) return;
    seen.add(key);
    const bar = bars[n.bar];
    chart.push({
      time: (n.bar * 16 + n.step) * stepDur,
      lane: n.lane,
      midi: laneMidi(song, bar, n.lane),
      bar: n.bar,
      step: n.step,
      judged: false,
      result: null,
    });
  });
  chart.sort((a, b) => a.time - b.time || a.lane - b.lane);
  chart.forEach((n) => {
    n.double = chart.some((o) => o !== n && Math.abs(o.time - n.time) < 1e-6);
  });

  return { song, bars, chart, spb, stepDur, length: bars.length * 16 * stepDur };
}

export function laneMidi(song, bar, lane) {
  const base = fold(song.root + bar.off, 50);
  return base + bar.tones[lane];
}

// The band's part for one sixteenth.
export function playStep(band, built, barIndex, step, t, opts) {
  const bar = built.bars[barIndex];
  if (!bar) return;
  const { song } = built;
  const type = bar.type;
  const root = song.root + bar.off;
  const bassRoot = fold(root, 33);
  const chord = bar.tones.slice(0, 3).map((x) => fold(root, 57) + x);
  const hype = opts.owambe;
  const sd = built.stepDur;

  // Final hit
  if (bar.last) {
    if (step === 0) {
      band.kick(t, 1.1);
      band.clap(t);
      band.bass(t, bassRoot, sd * 10);
      band.horns(t, [...chord, chord[0] + 12], sd * 12, 1.2);
      band.cheer(t, 1, 3.2);
    }
    return;
  }

  const drums = type !== 'break' && !(type === 'intro' && bar.i === 0);
  // Kick: a laid-back Afrobeat pattern
  if (drums) {
    if (type === 'intro') {
      if (step === 8 || step === 12) band.kick(t, 0.8);
    } else {
      if (step === 0 || step === 8) band.kick(t, 1);
      if (step === 3 || step === 11) band.kick(t, 0.55);
      if (type === 'chorus' && step === 14) band.kick(t, 0.5);
    }
  }
  // Claps and rims
  if (type === 'verse' || type === 'chorus' || type === 'outro') {
    if (step === 4 || step === 12) band.clap(t, type === 'chorus' ? 1 : 0.75);
    if (step === 7 || step === 10 || step === 15) band.rim(t, 0.8);
  }
  // Break builds into the next section with a clap roll
  if (type === 'break' && bar.i === bar.count - 1) {
    if (step >= 8 || step % 4 === 0) band.clap(t, 0.3 + (step / 16) * 0.8);
  }
  // Shaker on every sixteenth, pushed on the off-beats
  band.shaker(t, step % 4 === 2 ? 1 : step % 2 ? 0.45 : 0.7);
  // Agogo bell timeline
  const bellSteps = hype ? [0, 2, 3, 5, 7, 8, 10, 12, 14, 15] : [0, 3, 6, 8, 10, 12, 14];
  if (bellSteps.includes(step)) band.bell(t, step === 0 || step === 8, type === 'break' ? 0.7 : 1);
  // Bass
  if (type !== 'intro' || bar.i > 0) {
    const bassLine = [[0, 0, 3], [3, 0, 2], [6, 7, 2], [8, 12, 2], [10, 0, 2], [11, 12, 1], [14, 7, 2]];
    const hit = bassLine.find(([s]) => s === step);
    if (hit) band.bass(t, bassRoot + hit[1], sd * hit[2] * 0.95, type === 'break' ? 0.8 : 1);
  }
  // Highlife guitar arpeggio
  if (step % 2 === 0 && type !== 'break') {
    const order = [0, 2, 1, 2, 3, 2, 1, 2];
    const tones = [...chord, chord[0] + 12].map((m) => m + 12);
    band.pluck(t, tones[order[step / 2]], step % 4 === 2 ? 1 : 0.7);
  }
  // Organ skank on the off-beats in the chorus, or always in Owambe Mode
  if ((type === 'chorus' || hype) && (step === 2 || step === 6 || step === 10 || step === 14)) {
    band.stab(t, chord, 0.9);
  }
  // Horn hits
  if (type === 'chorus') {
    if (bar.i % 4 === 0 && step === 0) band.horns(t, [...chord, chord[0] + 12], sd * 6);
    if (bar.i % 4 === 2 && (step === 10 || step === 12)) band.horns(t, chord.map((m) => m + 12), sd * 1.5, 0.8);
  }
}
