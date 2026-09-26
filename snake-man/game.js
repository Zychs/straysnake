// SNAKE-MAN · game
// Boot, a fresh run, the per-tick update order, and the end of a run. The main loop lives here.
'use strict';
(() => {
    const { TIME_LIMIT_MS, START_LIVES, RAINBOW_COUNT, CHUNK, CN, store } = SM.core;
    const G = SM.G, M = SM.map;

    function init() {
        M.generate(G.mapSeed);
        G.score = 0; G.lives = START_LIVES; G.eaten = 0;
        G.timeLeft = TIME_LIMIT_MS;
        G.overReason = '';
        G.ghosts = [];
        G.invuln = 0; G.flash = 0; G.prism = 0; G.prismChain = 0;
        SM.fx.clear(); SM.anim.reset(); SM.coat.reset(); SM.dash.reset(); SM.heal.reset();

        // The seeded rng continues from map generation, so the opening layout is the same every run.
        // You start in a plaza, fenced into the highway block around it.
        const rng = M.rng;
        const pk = M.plazas[Math.floor(rng() * M.plazas.length)];
        const px = (pk / CN | 0) * CHUNK + CHUNK / 2, py = (pk % CN) * CHUNK + CHUNK / 2;
        M.setupDomain(px, py, rng);
        SM.player.place(SM.player.findSpawn(px, py, 4, rng));
        SM.pellets.reset();
        for (let i = 0; i < M.STAGES[0].food; i++) SM.pellets.spawn(rng, 6);
        for (let i = 0; i < RAINBOW_COUNT; i++) SM.pellets.spawn(rng, 12, true);

        SM.ghosts.reset();
    }

    function restart(newMap) {
        if (newMap) G.mapSeed = M.newSeed();
        init();
        G.mode = 'ready';
    }

    function end(reason) {
        G.mode = 'over';
        G.overReason = reason;
        if (G.score > G.hi) {
            G.hi = G.score;
            store.set('snakeman-hi', G.hi);
        }
    }

    // One tick of the rules. Order matters: the player moves first, then the ghosts react.
    function update(dt) {
        G.timeLeft -= dt;
        if (G.timeLeft <= 0) { G.timeLeft = 0; end('TIME UP'); return; }

        if (!SM.player.update(dt)) return;
        if (!SM.ghosts.update(dt)) return;
        G.invuln = Math.max(0, G.invuln - dt);
        G.prism = Math.max(0, G.prism - dt);
        SM.coat.update(dt);
        SM.dash.tick(dt);
        SM.heal.update(dt);
        SM.pellets.update(dt);
        SM.ghosts.direct(dt);
        SM.anim.tick(dt);
        SM.fx.update(dt);
    }

    let last = performance.now();
    function loop(now) {
        const dt = Math.min(100, now - last);
        last = now;
        if (G.mode === 'play') update(dt);
        SM.render.draw(now, dt);
        requestAnimationFrame(loop);
    }

    SM.game = { init, restart, end, update };

    G.mapSeed = M.loadSeed();
    init();
    requestAnimationFrame(loop);
})();
