// SNAKE-MAN · pellets
// Yellow dots and rainbow gems. They only appear inside the open domain. Yellow ones are
// weighted toward the dangerous districts (they stack up in warrens); rainbow ones want a
// warren outright, and an eaten one comes back somewhere else after a while.
'use strict';
(() => {
    const { N, idx, wrap, tdist, RAINBOW_RESPAWN_MS } = SM.core;
    const G = SM.G, M = SM.map;

    // grid: 0 empty, 1 yellow pellet, 2 rainbow pellet
    const grid = new Uint8Array(N * N);
    let list = [];
    let rainbowTimers = [];   // ms until each eaten rainbow pellet reappears

    // Pellets pile up where it's dangerous: plaza, warren, pillars, yards (highways get ROAD).
    const WEIGHT = [0.5, 3, 2, 1], WEIGHT_ROAD = 0.7, WEIGHT_MAX = 3;
    const weight = (x, y) => M.isRoad(x, y) ? WEIGHT_ROAD : WEIGHT[M.districtAt(x, y)];

    function reset() { grid.fill(0); list = []; rainbowTimers = []; }

    function spawn(rand = Math.random, minDist = 10, rainbow = false) {
        const h = G.snake[0], r = M.domainRect() || { x: 0, y: 0, w: N, h: N };
        for (let tries = 0; tries < 1500; tries++) {
            const x = wrap(r.x + Math.floor(rand() * r.w)), y = wrap(r.y + Math.floor(rand() * r.h));
            const i = idx(x, y);
            if (M.walls[i] || grid[i]) continue;
            if (tdist(x, y, h.x, h.y) < minDist) continue;
            if (G.snake.some(s => s.x === x && s.y === y)) continue;
            if (rainbow) { if (tries < 800 && (M.isRoad(x, y) || M.districtAt(x, y) !== M.D_WARREN)) continue; }
            else if (rand() * WEIGHT_MAX > weight(x, y)) continue;
            grid[i] = rainbow ? 2 : 1;
            list.push({ x, y, rainbow });
            return;
        }
    }

    const at = (x, y) => grid[idx(x, y)];

    // Remove the pellet at (x, y) and return its kind. Yellow ones are replaced at once,
    // rainbow ones after RAINBOW_RESPAWN_MS.
    function take(x, y) {
        const i = idx(x, y), kind = grid[i];
        if (!kind) return 0;
        grid[i] = 0;
        list = list.filter(p => p.x !== x || p.y !== y);
        if (kind === 2) rainbowTimers.push(RAINBOW_RESPAWN_MS);
        else spawn();
        return kind;
    }

    // Top the yellow pellets up to `target` (the domain just grew).
    function fillTo(target) {
        for (let i = list.filter(p => !p.rainbow).length; i < target; i++) spawn(Math.random, 12);
    }

    function update(dt) {
        rainbowTimers = rainbowTimers.map(t => t - dt);
        while (rainbowTimers.length && rainbowTimers[0] <= 0) { rainbowTimers.shift(); spawn(Math.random, 15, true); }
    }

    SM.pellets = { reset, spawn, at, take, fillTo, update, get list() { return list; } };
})();
