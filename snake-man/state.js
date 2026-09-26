// SNAKE-MAN · state
// The run's shared state (G) and the silent difficulty dial every system reads from.
// Systems keep their own private state; only what several of them touch lives on G.
'use strict';
(() => {
    const { TIME_LIMIT_MS, START_LIVES, lerp, clamp01, smooth } = SM.core;

    const G = {
        mode: 'ready',          // ready | play | paused | over
        overReason: '',
        mapSeed: 0,
        score: 0,
        hi: +SM.core.store.get('snakeman-hi') || 0,
        lives: START_LIVES,
        timeLeft: TIME_LIMIT_MS,
        eaten: 0,               // pellets eaten this run (opens the zones)
        snake: [],              // [head, ..., tail] of { x, y, under?, tun?, entry? }
        direction: { x: 0, y: -1 },
        inputQueue: [],
        ghosts: [],
        invuln: 0,              // ms of post-hit grace
        flash: 0,               // red hit flash, 0..1
        prism: 0,               // ms left on a rainbow pellet
        prismChain: 0,          // ghosts eaten during this prism (each worth double the last)
        opts: { derivs: true, minimap: true, occlusion: true, crt: true },
    };

    // --- SILENT DIFFICULTY ---
    // One hidden dial, 0 → 1, fed by elapsed time and score. It only ever rises, it is never
    // announced, and every speed, range and wind-up in the game reads from it.
    const playedMs = () => TIME_LIMIT_MS - G.timeLeft;
    function heat() {
        const played = playedMs() / 240000;                                // full heat by the 4-minute mark...
        return clamp01(0.75 * played + 0.25 * Math.min(1, G.score / 600)); // ...sooner if you score well
    }
    const heatE = () => smooth(0, 1, heat());                              // eased: a long, slow opening

    // The player starts slow and reaches full speed within the first couple of minutes.
    const playerStepMs = () => lerp(150, 100, smooth(0, 0.45, heat()));
    const lungeStepMs  = () => lerp(110, 78, heatE());
    const maxAttackers = () => heatE() < 0.3 ? 1 : heatE() < 0.7 ? 2 : 3;

    SM.G = G;
    SM.dial = { playedMs, heat, heatE, playerStepMs, lungeStepMs, maxAttackers };
})();
