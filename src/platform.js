// Talks to start.ng through its hidden connect page (see https://start.ng/docs.md).
const START_NG = 'https://start.ng';
const ON_START_NG = /(^|\.)start\.ng$/.test(location.hostname);

// The look used when start.ng can't be reached (for example, opened as a local file).
export const FALLBACK_GUEST = {
  name: 'Guest',
  style: {
    body: 'female', primaryColor: '#e8367a', secondaryColor: '#2c2a6b', skinColor: '#8d5524',
    hairColor: '#1a120d', hair: 'braids', hat: 'none', accessory: 'earrings',
  },
  face: null,
};

let frame;
function connectFrame() {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.title = 'start.ng';
    el.onload = () => resolve(el);
    el.onerror = reject;
    document.body.append(el);
  });
  return frame;
}

// Sends a message and resolves to start.ng's reply, or null if it didn't answer.
export async function askStartNg(message, replyType, timeoutMs = 5000) {
  if (!ON_START_NG) return null;
  let el;
  try { el = await connectFrame(); } catch { return null; }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => { clearTimeout(timer); removeEventListener('message', onMessage); resolve(reply); };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(e) {
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

// Resolves to { user, player } where user is null for guests. Returns undefined if start.ng didn't answer.
export async function whoami() {
  const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
  if (!reply) return undefined;
  return { user: reply.user ?? null, player: reply.user ?? reply.guest ?? FALLBACK_GUEST };
}

export function signIn() {
  location.href = `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
}

export const playingAsGuest = new URLSearchParams(location.search).has('guest');
export const canTalkToStartNg = ON_START_NG;

// Clean a session out of the address if start.ng sent one back (we use the connect page instead).
if (location.hash.includes('startng_session')) {
  history.replaceState(null, '', location.pathname + location.search);
}

export async function saveRun(stats) {
  const reply = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved', 8000);
  if (!reply) return { ok: false, error: ON_START_NG ? 'start.ng didn’t answer. Your run wasn’t saved.' : 'Scores save once the game is live on start.ng.' };
  return reply;
}

export async function leaderboard(limit = 8) {
  const reply = await askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData', 6000);
  if (!reply?.ok) return null;
  return reply.entries ?? [];
}
