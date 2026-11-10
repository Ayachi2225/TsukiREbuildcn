// Read-only audit probe against the real Audio class; no browser or game data required.
import { Audio } from "../app/js/audio.js";

globalThis.localStorage = { getItem: () => null };
const audio = new Audio();
audio.ctx = {};
let decodeResolve;
let started = 0;
audio.buffer = () => new Promise((resolve) => { decodeResolve = resolve; });
audio.node = () => {
  started++;
  return { s: { addEventListener() {} } };
};
const playback = audio.playVoice("audit_pending_voice", true);
let voiceDoneResolved = false;
await audio.voiceDone().then(() => { voiceDoneResolved = true; });
const before = { voiceDoneResolved, pendingNodeCount: audio.voice.length, started };
decodeResolve({});
await playback;
const after = { nodeCount: audio.voice.length, started };
console.log(JSON.stringify({ beforeDecode: before, afterDecode: after }, null, 2));
