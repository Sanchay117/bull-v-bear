// Tiny synthesized courtroom sounds (no audio files): a gavel knock and a stamp thud.

let ctx: AudioContext | null = null;
const audio = () => (ctx ??= new AudioContext());

function knock(at: number, freq: number, gain: number) {
  const c = audio();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, at);
  o.frequency.exponentialRampToValueAtTime(freq * 0.45, at + 0.18);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + 0.25);

  const len = Math.floor(c.sampleRate * 0.05);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const n = c.createBufferSource();
  const ng = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1800;
  n.buffer = buf;
  ng.gain.value = gain * 0.8;
  n.connect(f).connect(ng).connect(c.destination);
  n.start(at);
}

export function gavel(times = 3) {
  try {
    const c = audio();
    void c.resume();
    for (let i = 0; i < times; i++) knock(c.currentTime + i * 0.28, 210, 0.5);
  } catch {
    // audio unavailable
  }
}

export function stamp() {
  try {
    const c = audio();
    void c.resume();
    knock(c.currentTime, 120, 0.6);
  } catch {
    // audio unavailable
  }
}
