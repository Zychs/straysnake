// SNAKE-MAN · sfx
// Sound, synthesised on the fly: no audio files, so it works from file:// and in the Android
// WebView. One AudioContext for the whole run, created on the first key or touch (browsers
// refuse to start audio before a user gesture). Each sound is a few short-lived oscillator
// notes scheduled on the context clock; the nodes free themselves when they stop.
// Everything is driven by bus events, so no rule knows sound exists. V toggles mute.
'use strict';
(() => {
    const { on, store } = SM.core;
    const G = SM.G;

    let ac = null, master = null;
    let muted = store.get('snakeman-mute') === '1';
    const VOL = 0.18;

    function unlock() {
        if (!ac) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            ac = new AC();
            master = ac.createGain();
            master.gain.value = muted ? 0 : VOL;
            master.connect(ac.destination);
        }
        if (ac.state === 'suspended') ac.resume();
    }
    ['keydown', 'pointerdown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));

    function setMuted(m) {
        muted = m;
        store.set('snakeman-mute', m ? '1' : '0');
        if (master) master.gain.setTargetAtTime(m ? 0 : VOL, ac.currentTime, 0.02);
    }

    // One note: freq glides from f0 to f1 over dur seconds, starting `at` seconds from now.
    function tone(f0, f1 = f0, dur = 0.08, { type = 'square', vol = 1, at = 0 } = {}) {
        if (!ac || muted || ac.state !== 'running') return;
        const t = ac.currentTime + at;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + dur + 0.02);
    }
    const arp = (notes, step, opts) => notes.forEach((f, i) => tone(f, f, step * 1.1, { ...opts, at: i * step }));

    // Waka alternates pitch like the arcade chomp.
    let waka = 0;
    const SOUNDS = {
        eat:        e => e.rainbow ? arp([660, 880, 1100, 1320], 0.05, { type: 'triangle' })
                                   : tone((waka ^= 1) ? 520 : 390, 260, 0.06, { vol: 0.5 }),
        boost:      () => arp([523, 659, 784, 1047, 1319], 0.06, { type: 'triangle' }),
        fruit:      () => arp([880, 1175], 0.07, { type: 'sine', vol: 0.6 }),
        prism:      () => tone(200, 1200, 0.35, { type: 'sawtooth', vol: 0.35 }),
        ghostEaten: () => tone(1400, 180, 0.25, { type: 'square', vol: 0.6 }),
        hit:        () => { tone(300, 60, 0.4, { type: 'sawtooth' }); tone(150, 40, 0.4, { type: 'square', vol: 0.5 }); },
        dash:       () => tone(180, 60, 0.18, { type: 'triangle' }),
        surfaced:   () => tone(80, 260, 0.15, { type: 'triangle' }),
        bonk:       () => tone(140, 90, 0.1, { type: 'square', vol: 0.6 }),
        dodge:      () => tone(900, 1300, 0.05, { type: 'sine', vol: 0.4 }),
        snip:       () => tone(1200, 400, 0.12, { type: 'sawtooth', vol: 0.5 }),
        betrayed:   () => arp([330, 247], 0.08, { type: 'square', vol: 0.5 }),
        heal:       () => arp([392, 523, 659, 784], 0.08, { type: 'triangle' }),
    };
    for (const [ev, fn] of Object.entries(SOUNDS)) on(ev, d => { if (G.mode === 'play') fn(d || {}); });

    window.addEventListener('keydown', e => { if (e.key === 'v' || e.key === 'V') setMuted(!muted); });

    SM.sfx = { tone, arp, setMuted, get muted() { return muted; } };
})();
