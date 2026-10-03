// SNAKE-MAN · input
// Keyboard, swipes, the touch pad (joystick + DIG / COAT / PAUSE) and the Android app hooks.
// Gamepads live in gamepad.js and press the same verbs.
// Input only ever calls the game's public verbs; it holds no game state of its own.
'use strict';
(() => {
    const { DIRS } = SM.core;
    const G = SM.G;
    const game = () => SM.game;

    // Any steering of your own takes the wheel back from the autopilot for a while.
    const hands = () => { if (SM.auto) SM.auto.manual(); };

    function pressDir(d) {
        hands();
        if (G.mode === 'ready') G.mode = 'play';
        if (G.mode === 'play') SM.player.queueDir(d);
    }
    function togglePause() {
        if (G.mode === 'play') G.mode = 'paused';
        else if (G.mode === 'paused') G.mode = 'play';
        else if (G.mode === 'over') game().restart(false);
    }
    // Between runs (start and game-over screens) DIG picks the level and COAT draws a new map.
    const menu = () => G.mode === 'ready' || G.mode === 'over';
    function dig() { hands(); if (menu()) SM.dial.cycleLevel(); else SM.dash.start(); }
    function coat() { hands(); if (menu()) game().restart(true); else SM.coat.toggle(); }
    const zoomStep = f => SM.view.setZoom(SM.view.cam.z * f);

    const KEYMAP = {
        ArrowUp: DIRS[0], ArrowRight: DIRS[1], ArrowDown: DIRS[2], ArrowLeft: DIRS[3],
        w: DIRS[0], d: DIRS[1], s: DIRS[2], a: DIRS[3],
    };

    window.addEventListener('keydown', e => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (KEYMAP[k]) { e.preventDefault(); pressDir(KEYMAP[k]); return; }
        if (k === 'Shift') { e.preventDefault(); if (!e.repeat) { hands(); SM.dash.start(); } return; }
        if (k === 'i') { SM.auto.toggle(); return; }
        if (k === 'x') { G.opts.derivs = !G.opts.derivs; return; }
        if (k === 'm') { G.opts.minimap = !G.opts.minimap; return; }
        if (k === 'c') { G.opts.crt = !G.opts.crt; return; }
        if (k === 'o') { G.opts.occlusion = !G.opts.occlusion; return; }
        if (k === '-') { zoomStep(1 / 1.25); return; }
        if (k === '=' || k === '+') { zoomStep(1.25); return; }
        if (k === 'Escape') { e.preventDefault(); hands(); SM.coat.toggle(); return; }
        if (k === 'g' && G.mode === 'over') { SM.runlog.download(); return; }
        if (k === 'l' && (G.mode === 'ready' || G.mode === 'over')) { SM.dial.cycleLevel(); return; }
        if (k === 'n' && (G.mode === 'ready' || G.mode === 'over' || G.mode === 'paused')) { game().restart(true); return; }
        if (k === ' ' || k === 'p') { e.preventDefault(); togglePause(); return; }
        if (k === 'Enter' && G.mode === 'over') game().restart(false);
    });

    const canvas = SM.view.canvas;
    let touchStart = null;
    canvas.addEventListener('touchstart', e => { const t = e.touches[0]; touchStart = { x: t.clientX, y: t.clientY }; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', e => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
        touchStart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { togglePause(); return; }
        if (Math.abs(dx) > Math.abs(dy)) pressDir(dx > 0 ? DIRS[1] : DIRS[3]);
        else pressDir(dy > 0 ? DIRS[2] : DIRS[0]);
    });

    // --- TOUCH PAD (phones and the Android app) ---
    // Virtual joystick: past a small dead zone the dominant axis picks one of the four grid
    // directions, and each new direction is queued the moment the thumb crosses into it.
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let stickId = null, stickDir = -1;
    function stickMove(e) {
        const r = stick.getBoundingClientRect();
        const max = r.width / 2 - 24;
        let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const m = Math.hypot(dx, dy);
        if (m > max) { dx *= max / m; dy *= max / m; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        if (m < r.width * 0.12) { stickDir = -1; return; }          // dead zone
        const di = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
        if (di !== stickDir) { stickDir = di; pressDir(DIRS[di]); }
    }
    function stickEnd(e) {
        if (e.pointerId !== stickId) return;
        stickId = null; stickDir = -1;
        knob.style.transform = '';
    }
    stick.addEventListener('pointerdown', e => {
        e.preventDefault();
        stickId = e.pointerId; stickDir = -1;
        stick.setPointerCapture(e.pointerId);
        stickMove(e);
    });
    stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
    stick.addEventListener('pointerup', stickEnd);
    stick.addEventListener('pointercancel', stickEnd);

    const press = (id, fn) => document.getElementById(id).addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
    // DIG doubles as LEVEL and COAT as NEW (map) on the start and game-over screens.
    press('btnDash', dig);
    press('btnCoat', coat);
    press('btnPause', togglePause);

    // Android back button (called by the app shell): pause if playing, otherwise let the app close.
    window.onAppBack = () => { if (G.mode === 'play') { G.mode = 'paused'; return true; } return false; };
    window.onAppHidden = () => { if (G.mode === 'play') G.mode = 'paused'; };
    document.addEventListener('visibilitychange', () => { if (document.hidden) window.onAppHidden(); });

    SM.input = { pressDir, togglePause, dig, coat, zoomStep };
})();
