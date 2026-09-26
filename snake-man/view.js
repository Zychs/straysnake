// SNAKE-MAN · view
// The canvases and the camera: world tile ↔ screen pixel. The game is drawn into an offscreen
// `scene` first, then presented through the CRT pass onto the visible canvas.
'use strict';
(() => {
    const { GRID_SIZE, W, VIEW, wdeltaF } = SM.core;

    const canvas = document.getElementById('gameCanvas');
    const dctx = canvas.getContext('2d');          // the visible screen (after the CRT pass)
    const scene = document.createElement('canvas'); // the game is drawn here first
    scene.width = canvas.width; scene.height = canvas.height;
    const ctx = scene.getContext('2d');

    const cam = { x: 0, y: 0 };

    // Everything is pixel art on a sub-pixel grid: each 20px tile is 10x10 "sub-pixels" of 2px.
    const P = 2;                       // sub-pixel size in screen px
    const S = GRID_SIZE / P;           // sprite size in sub-pixels (10)
    const snap = v => Math.round(v / P) * P;
    const FONT = "'Press Start 2P', 'Courier New', monospace";

    // Screen centre of a world position (fractional positions work: animation uses them).
    const sx = x => W / 2 + wdeltaF(cam.x, x) * GRID_SIZE;
    const sy = y => W / 2 + wdeltaF(cam.y, y) * GRID_SIZE;
    const onScreen = (x, y) => Math.abs(wdeltaF(cam.x, x)) < VIEW / 2 + 2 && Math.abs(wdeltaF(cam.y, y)) < VIEW / 2 + 2;

    // Camera eases toward a world position.
    function follow(x, y, dt) {
        const k = 1 - Math.exp(-dt / 90);
        cam.x = SM.core.wrap(cam.x + wdeltaF(cam.x, x) * k);
        cam.y = SM.core.wrap(cam.y + wdeltaF(cam.y, y) * k);
    }

    SM.view = { canvas, dctx, scene, ctx, cam, P, S, snap, FONT, sx, sy, onScreen, follow };
})();
