// SNAKE-MAN · gamepad
// Controllers through the browser Gamepad API (the Android app's WebView passes them through):
// a clip-on pad like the Backbone, a full controller, or a one-stick accessibility controller.
//
//   first controller's left stick / d-pad   steer
//   right stick (any controller)            zoom: up in, down out
//   a second controller's stick             zoom too, so two one-stick controllers split the jobs
//   A  DIG      (between runs: LEVEL)       B  COAT     (between runs: NEW map)
//   X  ZOOM     (steps through a few)       Y  PAUSE    (GO / AGAIN), also START
//   LB / RB  zoom out / in                  VIEW (back)  LEVEL between runs
//
// A one-stick controller has no right stick, so its zoom lives on X and the shoulders.
// Polling only presses the same verbs input.js does; it holds no game state.
'use strict';
(() => {
    const { DIRS } = SM.core;
    const I = SM.input, V = SM.view;

    // Standard-mapping button indices.
    const A = 0, B = 1, X = 2, Y = 3, LB = 4, RB = 5, VIEW_BTN = 8, START = 9;
    const DPAD = { 12: 0, 15: 1, 13: 2, 14: 3 };   // up, right, down, left → DIRS index

    const MOVE_DEAD = 0.5;    // the stick must lean this far before it picks a direction
    const ZOOM_DEAD = 0.25;
    const ZOOM_RATE = 1.6;    // zoom doubles (or halves) in about this many seconds at full tilt
    const ZOOM_STOPS = [1, 0.75, 0.6, 1.25, 1.5];

    const held = new Map();   // gamepad index → buttons held last frame
    let moveDir = -1;         // direction the steering stick is holding, -1 at rest
    let any = false;

    function stickDir(x, y) {
        if (Math.hypot(x, y) < MOVE_DEAD) return -1;
        return Math.abs(x) > Math.abs(y) ? (x > 0 ? 1 : 3) : (y > 0 ? 2 : 0);
    }

    function nextZoomStop() {
        const z = V.cam.z;
        const i = ZOOM_STOPS.findIndex(s => Math.abs(s - z) < 0.01);
        V.setZoom(ZOOM_STOPS[(i + 1) % ZOOM_STOPS.length]);   // off a stop (after stick zoom): back to 1
    }

    function pressed(pad, i) {
        const b = pad.buttons[i];
        return !!b && (b.pressed || b.value > 0.5);
    }

    let last = performance.now();
    function poll(now) {
        const dt = Math.min(100, now - last) / 1000;
        last = now;
        const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(p => p && p.connected) : [];
        if ((pads.length > 0) !== any) {
            any = pads.length > 0;
            document.documentElement.classList.toggle('gamepad', any);
        }

        let zoom = 0;
        pads.forEach((pad, n) => {
            const was = held.get(pad.index) || [];
            const cur = pad.buttons.map((_, i) => pressed(pad, i));
            const down = i => cur[i] && !was[i];
            held.set(pad.index, cur);
            if (cur.some(Boolean)) SM.sfx.unlock();   // a button press is the only "gesture" a pad player makes

            const ax = k => pad.axes[k] || 0;
            if (n === 0) {
                const d = stickDir(ax(0), ax(1));
                if (d !== moveDir) { moveDir = d; if (d >= 0) I.pressDir(DIRS[d]); }
            } else if (Math.abs(ax(1)) > ZOOM_DEAD) zoom -= ax(1);   // a second controller's stick zooms
            if (Math.abs(ax(3)) > ZOOM_DEAD) zoom -= ax(3);           // any right stick zooms

            for (const b in DPAD) if (down(+b)) I.pressDir(DIRS[DPAD[b]]);
            if (down(A)) I.dig();
            if (down(B)) I.coat();
            if (down(X)) nextZoomStop();
            if (down(Y) || down(START)) I.togglePause();
            if (down(LB)) I.zoomStep(1 / 1.25);
            if (down(RB)) I.zoomStep(1.25);
            if (down(VIEW_BTN) && (SM.G.mode === 'ready' || SM.G.mode === 'over')) SM.dial.cycleLevel();
        });
        if (!pads.length) moveDir = -1;
        if (zoom) V.setZoom(V.cam.z * Math.pow(2, Math.max(-1, Math.min(1, zoom)) * dt / ZOOM_RATE));

        requestAnimationFrame(poll);
    }
    requestAnimationFrame(poll);
})();
