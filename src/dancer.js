// Draws the player's start.ng character, front-on and dancing, on a 2D canvas.

const DEFAULT_STYLE = {
  body: 'male', primaryColor: '#4b7bec', secondaryColor: '#2b2f4a', skinColor: '#8d5524',
  hairColor: '#17120f', hair: 'short', hat: 'none', accessory: 'none',
};
const HAIRS = ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'];
const HATS = ['none', 'cap', 'beanie', 'tophat', 'crown'];
const ACCESSORIES = ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'];
const HEX = /^#[0-9a-f]{6}$/i;

export function cleanStyle(s = {}) {
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const col = (v, d) => (HEX.test(v ?? '') ? v : d);
  return {
    body: s.body === 'female' ? 'female' : 'male',
    primaryColor: col(s.primaryColor, DEFAULT_STYLE.primaryColor),
    secondaryColor: col(s.secondaryColor, DEFAULT_STYLE.secondaryColor),
    skinColor: col(s.skinColor, DEFAULT_STYLE.skinColor),
    hairColor: col(s.hairColor, DEFAULT_STYLE.hairColor),
    hair: pick(s.hair, HAIRS, 'short'),
    hat: pick(s.hat, HATS, 'none'),
    accessory: pick(s.accessory, ACCESSORIES, 'none'),
  };
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  r = f(r); g = f(g); b = f(b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

export const MOVES = ['bounce', 'shaku', 'gwara', 'zanku', 'spray'];

// Works out the body's pose for this moment.
// beats: song position in beats; move: name; energy 0..1; stumble 0..1
export function makePose(beats, move, energy, stumble = 0) {
  const PI = Math.PI;
  const e = 0.45 + energy * 0.55;
  const dip = Math.pow(0.5 + 0.5 * Math.cos(2 * PI * beats), 3);
  const side = Math.sin(PI * beats); // -1..1 over two beats
  const p = {
    bob: dip * 0.14 * e,
    lean: side * 0.05 * e,
    head: side * 0.07,
    armL: [0.3, -0.9], armR: [0.3, -0.9],
    legL: [0.08, 0], legR: [0.08, 0],
    happy: energy > 0.6,
  };
  const beatIdx = Math.floor(beats);
  const alt = beatIdx % 2 === 0 ? 1 : -1;
  switch (move) {
    case 'bounce':
      p.armL = [0.35 + 0.2 * e * side, -1.5 - 0.3 * dip];
      p.armR = [0.35 - 0.2 * e * side, -1.5 - 0.3 * dip];
      p.legL = [0.1, -dip * 0.3];
      p.legR = [0.1, -dip * 0.3];
      break;
    case 'shaku': {
      const up = alt > 0;
      p.lean = alt * 0.12 * e;
      p.armL = up ? [1.2 * e + 0.4, -2.0] : [0.25, -0.6];
      p.armR = up ? [0.25, -0.6] : [1.2 * e + 0.4, -2.0];
      p.legL = up ? [0.35 * e, -0.8 * e] : [0.05, -0.1];
      p.legR = up ? [0.05, -0.1] : [0.35 * e, -0.8 * e];
      break;
    }
    case 'gwara':
      p.armL = [2.5 + 0.25 * side * e, 0.5 * Math.sin(PI * beats * 2)];
      p.armR = [2.5 - 0.25 * side * e, -0.5 * Math.sin(PI * beats * 2)];
      p.legL = [0.15, -dip * 0.4];
      p.legR = [0.15, -dip * 0.4];
      p.lean = side * 0.1 * e;
      break;
    case 'zanku': {
      const kick = Math.max(0, Math.sin(PI * (beats % 1)));
      p.legL = alt > 0 ? [0.9 * kick * e + 0.1, -0.4 * kick] : [0.06, 0];
      p.legR = alt < 0 ? [0.9 * kick * e + 0.1, -0.4 * kick] : [0.06, 0];
      p.armL = alt < 0 ? [1.4 * e, -1.2] : [0.5, -1.6];
      p.armR = alt > 0 ? [1.4 * e, -1.2] : [0.5, -1.6];
      p.lean = -alt * 0.08 * kick;
      break;
    }
    case 'spray':
      p.armR = [2.9 + 0.08 * side, -0.2 + 0.4 * Math.sin(PI * beats * 4)];
      p.armL = [0.75, -2.3];
      p.legL = [0.14, -dip * 0.35];
      p.legR = [0.14, -dip * 0.35];
      p.lean = side * 0.08;
      p.happy = true;
      break;
  }
  if (stumble > 0) {
    const s = stumble;
    p.lean = p.lean * (1 - s) + 0.28 * s;
    p.head = p.head * (1 - s) + 0.3 * s;
    p.armL = [p.armL[0] * (1 - s) + 1.5 * s, p.armL[1] * (1 - s) + 0.4 * s];
    p.armR = [p.armR[0] * (1 - s) + 0.9 * s, p.armR[1] * (1 - s) - 0.6 * s];
    p.bob = p.bob * (1 - s) + 0.1 * s;
    p.oops = s > 0.3;
    p.happy = false;
  }
  return p;
}

// Draw a limb hanging from (0,0) pointing down, rotated, with a bend.
function limb(ctx, angle, bend, len1, len2, w, colorUpper, colorLower, end) {
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = colorUpper;
  rr(ctx, -w / 2, -w / 2, w, len1 + w / 2, w / 2);
  ctx.fill();
  ctx.translate(0, len1);
  ctx.rotate(bend);
  ctx.fillStyle = colorLower;
  rr(ctx, -w / 2 * 0.95, -w / 2, w * 0.95, len2 + w / 2, w / 2);
  ctx.fill();
  if (end) {
    ctx.translate(0, len2);
    end();
  }
  ctx.restore();
}

/**
 * Draws the character with its feet at (x, y). u is the head size in pixels (~1/4.3 of full height).
 * extra.cash: draw a fan of naira notes in the raised right hand.
 */
export function drawDancer(ctx, style, x, y, u, pose, extra = {}) {
  const s = style;
  const female = s.body === 'female';
  const skin = s.skinColor;
  const skinDark = shade(skin, -0.18);
  const top = s.primaryColor;
  const bottom = s.secondaryColor;
  const hairC = s.hairColor;
  const shoe = '#1d1530';

  const legLen = 1.6 * u;
  const hipY = -legLen + pose.bob * u;
  const torsoH = 1.35 * u;
  const torsoW = (female ? 0.86 : 0.98) * u;
  const hipW = female ? 0.36 * u : 0.3 * u;

  ctx.save();
  ctx.translate(x, y);

  // shadow on the floor
  ctx.fillStyle = 'rgba(10, 4, 30, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.0 * u, 0.18 * u, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, hipY);
  ctx.rotate(pose.lean * 0.4);

  // ---- legs
  const legW = 0.3 * u;
  const footEnd = () => {
    ctx.fillStyle = shoe;
    rr(ctx, -legW * 0.62, -legW * 0.15, legW * 1.24, legW * 0.6, legW * 0.25);
    ctx.fill();
  };
  const legUpper = female ? skin : bottom;
  const legLower = female ? skin : bottom;
  ctx.save();
  ctx.translate(-hipW, 0);
  limb(ctx, pose.legL[0], pose.legL[1], 0.78 * u, 0.74 * u, legW, legUpper, legLower, footEnd);
  ctx.restore();
  ctx.save();
  ctx.translate(hipW, 0);
  limb(ctx, -pose.legR[0], -pose.legR[1], 0.78 * u, 0.74 * u, legW, legUpper, legLower, footEnd);
  ctx.restore();

  // ---- torso (leans from the hips)
  ctx.rotate(pose.lean);
  const torsoTop = -torsoH;

  // backpack behind
  if (s.accessory === 'backpack') {
    ctx.fillStyle = shade(top, -0.45);
    rr(ctx, -torsoW * 0.62, torsoTop + 0.12 * u, torsoW * 1.24, torsoH * 0.75, 0.15 * u);
    ctx.fill();
  }

  // back hair (behind the body and head)
  const headCY = torsoTop - 0.62 * u;
  const headW = 0.92 * u;
  const headH = 0.98 * u;
  ctx.save();
  ctx.translate(0, torsoTop);
  ctx.rotate(pose.head);
  ctx.translate(0, -0.62 * u);
  drawBackHair(ctx, s.hair, hairC, headW, headH, u, extra.time ?? 0);
  ctx.restore();

  // shirt / dress
  ctx.fillStyle = top;
  rr(ctx, -torsoW / 2, torsoTop, torsoW, torsoH * (female ? 0.72 : 0.86), 0.24 * u);
  ctx.fill();
  if (female) {
    // a flared skirt, in the secondary colour
    ctx.fillStyle = bottom;
    ctx.beginPath();
    const sy = torsoTop + torsoH * 0.6;
    ctx.moveTo(-torsoW * 0.46, sy);
    ctx.lineTo(torsoW * 0.46, sy);
    ctx.lineTo(torsoW * 0.72, 0.62 * u);
    ctx.quadraticCurveTo(0, 0.74 * u, -torsoW * 0.72, 0.62 * u);
    ctx.closePath();
    ctx.fill();
    // lace trim
    ctx.fillStyle = shade(bottom, 0.35);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(i * torsoW * 0.2, 0.66 * u, 0.05 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // trousers top and a belt
    ctx.fillStyle = bottom;
    rr(ctx, -torsoW / 2, -torsoH * 0.18, torsoW, torsoH * 0.26, 0.12 * u);
    ctx.fill();
    ctx.fillStyle = shade(bottom, -0.35);
    ctx.fillRect(-torsoW / 2, -torsoH * 0.18, torsoW, 0.08 * u);
  }
  // a neckline
  ctx.fillStyle = shade(top, -0.22);
  ctx.beginPath();
  ctx.ellipse(0, torsoTop + 0.02 * u, 0.26 * u, 0.14 * u, 0, 0, Math.PI);
  ctx.fill();

  if (s.accessory === 'backpack') {
    ctx.fillStyle = shade(top, -0.55);
    ctx.fillRect(-torsoW * 0.36, torsoTop, 0.11 * u, torsoH * 0.62);
    ctx.fillRect(torsoW * 0.25, torsoTop, 0.11 * u, torsoH * 0.62);
  }

  // ---- arms
  const armW = 0.26 * u;
  const shoulderY = torsoTop + 0.2 * u;
  const handEnd = (withCash) => () => {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, 0.05 * u, armW * 0.62, 0, Math.PI * 2);
    ctx.fill();
    if (withCash) drawCashFan(ctx, u, extra.time ?? 0);
  };
  ctx.save();
  ctx.translate(-torsoW / 2 + armW * 0.25, shoulderY);
  limb(ctx, pose.armL[0], pose.armL[1], 0.62 * u, 0.58 * u, armW, top, skin, handEnd(false));
  ctx.restore();
  ctx.save();
  ctx.translate(torsoW / 2 - armW * 0.25, shoulderY);
  limb(ctx, -pose.armR[0], -pose.armR[1], 0.62 * u, 0.58 * u, armW, top, skin, handEnd(!!extra.cash));
  ctx.restore();

  // ---- head
  ctx.save();
  ctx.translate(0, torsoTop);
  // neck
  ctx.fillStyle = skinDark;
  ctx.fillRect(-0.15 * u, -0.22 * u, 0.3 * u, 0.3 * u);
  if (s.accessory === 'scarf') {
    ctx.fillStyle = '#f2b705';
    rr(ctx, -0.42 * u, -0.12 * u, 0.84 * u, 0.24 * u, 0.12 * u);
    ctx.fill();
    ctx.save();
    ctx.translate(0.2 * u, 0.05 * u);
    ctx.rotate(-0.15 + Math.sin((extra.time ?? 0) * 6) * 0.08);
    rr(ctx, -0.09 * u, 0, 0.2 * u, 0.6 * u, 0.06 * u);
    ctx.fill();
    ctx.fillStyle = '#e8367a';
    ctx.fillRect(-0.09 * u, 0.45 * u, 0.2 * u, 0.06 * u);
    ctx.restore();
  }
  ctx.rotate(pose.head);
  ctx.translate(0, -0.62 * u);
  // ears
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(-headW / 2, 0.05 * u, 0.1 * u, 0.15 * u, 0, 0, Math.PI * 2);
  ctx.ellipse(headW / 2, 0.05 * u, 0.1 * u, 0.15 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  // face
  ctx.fillStyle = skin;
  rr(ctx, -headW / 2, -headH / 2, headW, headH, 0.32 * u);
  ctx.fill();
  drawFace(ctx, u, pose, s, extra.time ?? 0);
  drawFrontHair(ctx, s.hair, hairC, headW, headH, u);
  drawAccessoryOnHead(ctx, s.accessory, u, headW, headH, hairC);
  drawHat(ctx, s.hat, s.hair, u, headW, headH, top);
  ctx.restore();

  ctx.restore();
}

function drawFace(ctx, u, pose, s, time) {
  const eyeY = -0.02 * u;
  const blink = (time % 3.7) < 0.12;
  ctx.fillStyle = '#1a1020';
  ctx.strokeStyle = '#1a1020';
  ctx.lineWidth = 0.07 * u;
  ctx.lineCap = 'round';
  if (pose.happy) {
    // eyes closed in joy: ^ ^
    [-1, 1].forEach((d) => {
      ctx.beginPath();
      ctx.arc(d * 0.2 * u, eyeY + 0.04 * u, 0.09 * u, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    });
  } else if (blink) {
    [-1, 1].forEach((d) => { ctx.beginPath(); ctx.moveTo(d * 0.2 * u - 0.07 * u, eyeY); ctx.lineTo(d * 0.2 * u + 0.07 * u, eyeY); ctx.stroke(); });
  } else {
    [-1, 1].forEach((d) => {
      ctx.beginPath();
      ctx.ellipse(d * 0.2 * u, eyeY, 0.065 * u, 0.09 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // cheeks
  ctx.fillStyle = 'rgba(232, 54, 122, 0.25)';
  [-1, 1].forEach((d) => { ctx.beginPath(); ctx.ellipse(d * 0.3 * u, 0.15 * u, 0.09 * u, 0.06 * u, 0, 0, Math.PI * 2); ctx.fill(); });
  // mouth
  ctx.fillStyle = '#5a1430';
  if (pose.oops) {
    ctx.beginPath();
    ctx.ellipse(0, 0.25 * u, 0.07 * u, 0.09 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (pose.happy) {
    ctx.beginPath();
    ctx.moveTo(-0.17 * u, 0.18 * u);
    ctx.quadraticCurveTo(0, 0.44 * u, 0.17 * u, 0.18 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-0.12 * u, 0.18 * u, 0.24 * u, 0.05 * u);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0.16 * u, 0.13 * u, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
}

function drawBackHair(ctx, hair, c, hw, hh, u, time) {
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  if (hair === 'afro') {
    ctx.beginPath();
    ctx.arc(0, -0.18 * u, 0.82 * u, 0, Math.PI * 2);
    ctx.fill();
    // a little texture
    ctx.fillStyle = shade(c, 0.12);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 0.6 * u, -0.18 * u + Math.sin(a) * 0.6 * u, 0.07 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (hair === 'braids' || hair === 'dreads') {
    const n = hair === 'braids' ? 5 : 6;
    const w = hair === 'braids' ? 0.09 * u : 0.14 * u;
    const len = hair === 'braids' ? 1.45 * u : 1.2 * u;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    [-1, 1].forEach((d) => {
      for (let i = 0; i < n; i++) {
        const x0 = d * (hw / 2 - 0.05 * u - i * 0.04 * u);
        const sway = Math.sin(time * 5 + i) * 0.05 * u;
        ctx.beginPath();
        ctx.moveTo(x0, -0.2 * u);
        ctx.quadraticCurveTo(x0 + d * 0.12 * u, len * 0.4, x0 + d * (0.08 + i * 0.03) * u + sway, len * 0.85);
        ctx.stroke();
        if (hair === 'braids') {
          ctx.fillStyle = '#f2b705';
          ctx.beginPath();
          ctx.arc(x0 + d * (0.08 + i * 0.03) * u + sway, len * 0.85, 0.055 * u, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = c;
        }
      }
    });
  } else if (hair === 'ponytail') {
    ctx.save();
    ctx.translate(hw * 0.4, -0.3 * u);
    ctx.rotate(-0.5 + Math.sin(time * 6) * 0.25);
    ctx.beginPath();
    ctx.ellipse(0.3 * u, 0.25 * u, 0.2 * u, 0.5 * u, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (hair === 'bun') {
    ctx.beginPath();
    ctx.arc(0, -hh / 2 - 0.16 * u, 0.28 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFrontHair(ctx, hair, c, hw, hh, u) {
  if (hair === 'bald') {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(-0.18 * u, -0.32 * u, 0.15 * u, 0.07 * u, -0.3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = c;
  if (hair === 'afro') {
    ctx.beginPath();
    ctx.moveTo(-hw / 2 - 0.02 * u, -0.05 * u);
    ctx.quadraticCurveTo(-hw / 2, -hh / 2 - 0.05 * u, 0, -hh / 2 - 0.08 * u);
    ctx.quadraticCurveTo(hw / 2, -hh / 2 - 0.05 * u, hw / 2 + 0.02 * u, -0.05 * u);
    ctx.quadraticCurveTo(0.2 * u, -0.3 * u, 0, -0.26 * u);
    ctx.quadraticCurveTo(-0.2 * u, -0.3 * u, -hw / 2 - 0.02 * u, -0.05 * u);
    ctx.fill();
    return;
  }
  // a hair cap over the top of the head with a hairline
  ctx.beginPath();
  ctx.moveTo(-hw / 2 - 0.03 * u, 0.02 * u);
  ctx.lineTo(-hw / 2 - 0.03 * u, -hh / 2 + 0.22 * u);
  ctx.quadraticCurveTo(-hw / 2 - 0.03 * u, -hh / 2 - 0.08 * u, 0, -hh / 2 - 0.08 * u);
  ctx.quadraticCurveTo(hw / 2 + 0.03 * u, -hh / 2 - 0.08 * u, hw / 2 + 0.03 * u, -hh / 2 + 0.22 * u);
  ctx.lineTo(hw / 2 + 0.03 * u, 0.02 * u);
  ctx.lineTo(hw / 2 - 0.08 * u, -0.18 * u);
  if (hair === 'short') {
    ctx.quadraticCurveTo(0.1 * u, -0.34 * u, -0.1 * u, -0.28 * u);
  } else {
    // a middle parting
    ctx.quadraticCurveTo(0.15 * u, -0.25 * u, 0, -0.36 * u);
    ctx.quadraticCurveTo(-0.15 * u, -0.25 * u, -0.1 * u, -0.28 * u);
  }
  ctx.lineTo(-hw / 2 + 0.08 * u, -0.18 * u);
  ctx.closePath();
  ctx.fill();
  if (hair === 'braids' || hair === 'dreads') {
    ctx.strokeStyle = shade(c, 0.2);
    ctx.lineWidth = 0.025 * u;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 0.12 * u, -0.34 * u);
      ctx.lineTo(i * 0.16 * u, -hh / 2 - 0.02 * u);
      ctx.stroke();
    }
  }
}

function drawAccessoryOnHead(ctx, acc, u, hw, hh, hairC) {
  if (acc === 'glasses') {
    ctx.strokeStyle = '#120a1a';
    ctx.lineWidth = 0.05 * u;
    ctx.fillStyle = 'rgba(120, 220, 255, 0.35)';
    [-1, 1].forEach((d) => {
      rr(ctx, d * 0.2 * u - 0.15 * u, -0.12 * u, 0.3 * u, 0.22 * u, 0.06 * u);
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(-0.05 * u, -0.04 * u);
    ctx.lineTo(0.05 * u, -0.04 * u);
    ctx.stroke();
  } else if (acc === 'earrings') {
    ctx.fillStyle = '#f2b705';
    [-1, 1].forEach((d) => {
      ctx.beginPath();
      ctx.arc(d * (hw / 2 + 0.02 * u), 0.24 * u, 0.08 * u, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (acc === 'beard') {
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.moveTo(-hw / 2, 0.02 * u);
    ctx.quadraticCurveTo(-hw / 2, hh / 2 + 0.12 * u, 0, hh / 2 + 0.14 * u);
    ctx.quadraticCurveTo(hw / 2, hh / 2 + 0.12 * u, hw / 2, 0.02 * u);
    ctx.lineTo(hw / 2 - 0.1 * u, 0.1 * u);
    ctx.quadraticCurveTo(0, 0.5 * u, -hw / 2 + 0.1 * u, 0.1 * u);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHat(ctx, hat, hair, u, hw, hh, top) {
  const lift = hair === 'afro' ? 0.36 * u : hair === 'bun' ? 0.06 * u : 0;
  const y = -hh / 2 - lift;
  if (hat === 'cap') {
    ctx.fillStyle = shade(top, -0.25);
    ctx.beginPath();
    ctx.ellipse(0, y + 0.12 * u, hw * 0.56, 0.36 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = shade(top, -0.4);
    rr(ctx, -hw * 0.6, y + 0.06 * u, hw * 1.2, 0.12 * u, 0.06 * u);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, y - 0.22 * u, 0.05 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat === 'beanie') {
    ctx.fillStyle = '#e8367a';
    ctx.beginPath();
    ctx.ellipse(0, y + 0.16 * u, hw * 0.56, 0.42 * u, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#c21f62';
    rr(ctx, -hw * 0.58, y + 0.04 * u, hw * 1.16, 0.18 * u, 0.06 * u);
    ctx.fill();
    ctx.fillStyle = '#fff4dc';
    ctx.beginPath();
    ctx.arc(0, y - 0.3 * u, 0.1 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat === 'tophat') {
    ctx.fillStyle = '#16102a';
    rr(ctx, -hw * 0.66, y - 0.02 * u, hw * 1.32, 0.12 * u, 0.05 * u);
    ctx.fill();
    rr(ctx, -hw * 0.4, y - 0.72 * u, hw * 0.8, 0.74 * u, 0.06 * u);
    ctx.fill();
    ctx.fillStyle = '#e8367a';
    ctx.fillRect(-hw * 0.4, y - 0.2 * u, hw * 0.8, 0.1 * u);
  } else if (hat === 'crown') {
    ctx.fillStyle = '#f2b705';
    ctx.beginPath();
    const w = hw * 0.5;
    ctx.moveTo(-w, y + 0.08 * u);
    ctx.lineTo(-w, y - 0.28 * u);
    ctx.lineTo(-w * 0.5, y - 0.08 * u);
    ctx.lineTo(0, y - 0.38 * u);
    ctx.lineTo(w * 0.5, y - 0.08 * u);
    ctx.lineTo(w, y - 0.28 * u);
    ctx.lineTo(w, y + 0.08 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8367a';
    [-0.5, 0, 0.5].forEach((d) => {
      ctx.beginPath();
      ctx.arc(d * w, y - 0.02 * u, 0.05 * u, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

const NOTE_COLORS = [['#3f8f5f', '#bfe8c9'], ['#4a6fb0', '#c9d9f5'], ['#a8683c', '#f1d2b5']];

export function drawNaira(ctx, w, h, kind, alpha = 1) {
  const [base, light] = NOTE_COLORS[kind % NOTE_COLORS.length];
  ctx.globalAlpha = alpha;
  ctx.fillStyle = base;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = light;
  ctx.fillRect(-w / 2 + w * 0.08, -h / 2 + h * 0.16, w * 0.3, h * 0.68);
  ctx.strokeStyle = light;
  ctx.lineWidth = Math.max(1, h * 0.06);
  ctx.strokeRect(-w / 2 + h * 0.08, -h / 2 + h * 0.08, w - h * 0.16, h - h * 0.16);
  ctx.fillStyle = light;
  ctx.font = `700 ${h * 0.55}px "Familjen Grotesk", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₦', w * 0.22, h * 0.03);
  ctx.globalAlpha = 1;
}

function drawCashFan(ctx, u, time) {
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(0, 0.2 * u);
    ctx.rotate(-0.6 + i * 0.32 + Math.sin(time * 8) * 0.05);
    ctx.translate(0, 0.38 * u);
    drawNaira(ctx, 0.42 * u, 0.8 * u, i, 1);
    ctx.restore();
  }
}

// A head-and-shoulders portrait for the profile card, when start.ng hasn't given us a face.
export function portrait(style, size = 96) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#f2b705';
  g.fillRect(0, 0, size, size);
  const u = size * 0.42;
  const pose = makePose(0.5, 'bounce', 0);
  pose.bob = 0; pose.lean = 0; pose.head = 0;
  drawDancer(g, style, size / 2, size * 0.5 + 3.57 * u, u, pose, { time: 1 });
  return c.toDataURL('image/png');
}
