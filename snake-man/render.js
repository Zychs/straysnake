// SNAKE-MAN · render
// Draws a frame: floor, pellets, tunnels, line-of-sight shadows, walls, telegraphs, the snake,
// the ghosts, FX, minimap, ladder, overlays; then the CRT pass and the DOM HUD.
// Reads game state, never changes it (the one exception: ghosts' fade-in visibility).
'use strict';
(() => {
    const { GRID_SIZE, W, VIEW, N, CN, CHUNK, idx, wdelta, dirIndex, on } = SM.core;
    const G = SM.G, M = SM.map, K = SM.kin, gfx = SM.gfx, fx = SM.fx;
    const { canvas, dctx, scene, ctx, cam, P, S, snap, sx, sy, onScreen } = SM.view;
    const { pixelLine, pixelArrow, pixelRing, pixelText } = gfx;

    // District colours: floor studs and minimap tint, so the layout reads at a glance.
    const DISTRICT_STUD = ['#1f3a22', '#40201f', '#1f2444', '#1c1c1c'];
    const DISTRICT_MM   = ['rgba(40,160,70,0.22)', 'rgba(200,60,60,0.22)', 'rgba(70,90,220,0.20)', 'rgba(0,0,0,0)'];
    const ROAD_STUD = '#3a3a3a';

    // --- MINIMAP ---
    const minimap = document.createElement('canvas');
    const MM_SCALE = 1.6;
    minimap.width = minimap.height = Math.ceil(N * MM_SCALE);
    function renderMinimapBase() {
        const m = minimap.getContext('2d'), s = MM_SCALE;
        m.clearRect(0, 0, minimap.width, minimap.height);
        m.fillStyle = 'rgba(0,0,0,0.75)';
        m.fillRect(0, 0, minimap.width, minimap.height);
        for (let k = 0; k < CN * CN; k++) {
            m.fillStyle = DISTRICT_MM[M.district[k]];
            m.fillRect((k / CN | 0) * CHUNK * s, (k % CN) * CHUNK * s, CHUNK * s, CHUNK * s);
        }
        m.fillStyle = 'rgba(255,255,255,0.07)';
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (M.road[idx(x, y)]) m.fillRect(x * s, y * s, Math.ceil(s), Math.ceil(s));
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const w = M.walls[idx(x, y)];
            if (!w) continue;
            m.fillStyle = w === 2 ? '#f4f' : '#2a2aff';
            m.fillRect(x * s, y * s, Math.ceil(s), Math.ceil(s));
        }
    }
    on('map', renderMinimapBase);

    // Visit every tile around the camera: fn(wx, wy, left, top) with the tile's screen corner.
    function forViewTiles(fn) {
        const bx = Math.floor(cam.x), by = Math.floor(cam.y);
        const half = VIEW / 2 + 2;
        for (let j = -half; j <= half; j++) {
            for (let i = -half; i <= half; i++) {
                const wx = bx + i, wy = by + j;
                fn(wx, wy, W / 2 + (wx - cam.x) * GRID_SIZE - GRID_SIZE / 2, W / 2 + (wy - cam.y) * GRID_SIZE - GRID_SIZE / 2);
            }
        }
    }

    // Floor studs are tinted by district (green plaza, red warren, blue pillars) and brighter on
    // highways; ground outside the open domain is barely there.
    function drawFloor() {
        forViewTiles((wx, wy, left, top) => {
            if (M.isWall(wx, wy)) return;
            const road = M.isRoad(wx, wy), inside = M.inDomain(wx, wy);
            ctx.fillStyle = !inside ? '#0e0e0e' : road ? ROAD_STUD : DISTRICT_STUD[M.districtAt(wx, wy)];
            ctx.fillRect(snap(left), snap(top), P, P);
            if (road && inside) ctx.fillRect(snap(left) + GRID_SIZE / 2, snap(top) + GRID_SIZE / 2, P, P);
        });
    }

    function drawWalls(now) {
        const ff = Math.floor(now / 160) % 2;
        forViewTiles((wx, wy, left, top) => {
            const w = M.walls[idx(wx, wy)];
            if (!w) return;
            if (w === 2) { ctx.drawImage(gfx.fenceSprite(ff), snap(left), snap(top)); return; }
            const o = M.isOpaque;
            const mask = (o(wx, wy - 1) ? 1 : 0) | (o(wx + 1, wy) ? 2 : 0) | (o(wx, wy + 1) ? 4 : 0) | (o(wx - 1, wy) ? 8 : 0);
            ctx.drawImage(gfx.wallSprite(mask), snap(left), snap(top));
        });
    }

    function drawPellets(now) {
        const pf = Math.floor(now / 220) % 2;
        const hb = Math.floor(now / 80) % gfx.HUES;
        for (const p of SM.pellets.list) {
            if (!onScreen(p.x, p.y)) continue;
            const spr = p.rainbow ? gfx.rainbowPelletSprite(hb, pf) : gfx.pelletSprite(pf);
            ctx.drawImage(spr, snap(sx(p.x) - GRID_SIZE / 2), snap(sy(p.y) - GRID_SIZE / 2) + SM.anim.breathe(p, now));
        }
    }

    // --- OCCLUSION (top-down line of sight, Super Animal Royale style) ---
    // Every wall edge that faces the snake's head casts a shadow quad away from it. The shadows
    // are rasterised at sub-pixel resolution, filled with a dithered dark pattern, and laid over
    // the floor. Walls are drawn on top so the map stays readable; ghosts in shadow are hidden.
    const shade = document.createElement('canvas');
    shade.width = shade.height = W / P;
    const sctx = shade.getContext('2d');
    const shadePattern = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 2;
        const x = c.getContext('2d');
        x.fillStyle = '#030309'; x.fillRect(0, 0, 2, 2);
        x.fillStyle = '#0d0d24'; x.fillRect(0, 0, 1, 1);
        return sctx.createPattern(c, 'repeat');
    })();

    function drawOcclusion(ex, ey) {
        const g = GRID_SIZE, FAR = W * 2;
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.globalCompositeOperation = 'source-over';
        sctx.clearRect(0, 0, shade.width, shade.height);
        sctx.setTransform(1 / P, 0, 0, 1 / P, 0, 0);
        sctx.beginPath();
        const far = ([px, py]) => { const dx = px - ex, dy = py - ey, m = Math.hypot(dx, dy) || 1; return [px + dx / m * FAR, py + dy / m * FAR]; };
        const quad = (a, b) => {
            const pts = [a, b, far(b), far(a)];
            let area = 0;
            for (let k = 0; k < 4; k++) { const p = pts[k], q = pts[(k + 1) % 4]; area += p[0] * q[1] - q[0] * p[1]; }
            if (area < 0) pts.reverse();                 // same winding for all, so overlaps union
            sctx.moveTo(pts[0][0], pts[0][1]);
            for (let k = 1; k < 4; k++) sctx.lineTo(pts[k][0], pts[k][1]);
            sctx.closePath();
        };
        const o = M.isOpaque;
        forViewTiles((wx, wy, l, t) => {
            if (!o(wx, wy)) return;   // fences are see-through
            const r = l + g, b = t + g;
            // only outer edges of a wall piece that face the eye cast shadow
            if (ey < t && !o(wx, wy - 1)) quad([l, t], [r, t]);
            if (ex > r && !o(wx + 1, wy)) quad([r, t], [r, b]);
            if (ey > b && !o(wx, wy + 1)) quad([r, b], [l, b]);
            if (ex < l && !o(wx - 1, wy)) quad([l, b], [l, t]);
        });
        sctx.fillStyle = '#000';
        sctx.fill();
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.globalCompositeOperation = 'source-in';
        sctx.fillStyle = shadePattern;
        sctx.fillRect(0, 0, shade.width, shade.height);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.88;
        ctx.drawImage(shade, 0, 0, W, W);
        ctx.restore();
    }

    function updateVisibility(dt) {
        const k = 1 - Math.exp(-dt / 70), h = G.snake[0];
        G.ghosts.forEach(g => {
            const seen = !G.opts.occlusion || (onScreen(g.x, g.y) && M.lineOfSight(h.x, h.y, g.x, g.y));
            g.vis += ((seen ? 1 : 0) - g.vis) * k;
        });
    }

    const lookIndex = (dx, dy) => {
        if (!dx && !dy) return 4;
        return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    };

    function drawGhost(g, now) {
        if (!onScreen(g.x, g.y) || g.vis < 0.02) return;
        const s = GRID_SIZE, coat = SM.coat;
        let x = sx(g.x) - s / 2, y = sy(g.y) - s / 2 + SM.anim.hover(g, now);
        if (g.state === 'aim') { // trembling wind-up
            const amp = g.locked ? 2 : 1;
            x += Math.round((Math.random() - 0.5) * 2 * amp) * P; y += Math.round((Math.random() - 0.5) * 2 * amp) * P;
        }
        // the skirt flutters at the ghost's own pace, out of step with the rest of the pack
        const frame = Math.floor(now * g.pace.hunt / 150 + g.pace.phase) % 2;
        let mode = 'normal';
        if (g.state === 'daze') mode = (g.t > g.dazeFor - 500 && Math.floor(now / 100) % 2) ? 'flash' : 'daze';
        if (SM.anim.swellFlash(g)) mode = 'flash';
        let look = lookIndex(g.dir.x, g.dir.y);
        if (g.state === 'aim') look = lookIndex(wdelta(g.x, g.target.x), wdelta(g.y, g.target.y));
        const col = g.traitor ? coat.TRAITOR_COLOR : g.color;
        const sprite = gfx.ghostSprite(col, frame, look, mode, SM.ghosts.tier(g), g.immune);

        // lunge afterimages
        if (g.state === 'lunge') {
            g.trail.forEach((p, i) => {
                ctx.globalAlpha = g.vis * g.fade * (0.4 - i * 0.09);
                ctx.drawImage(sprite, snap(sx(p.x) - s / 2), snap(sy(p.y) - s / 2));
            });
        }
        ctx.globalAlpha = g.vis * g.fade;
        const k = SM.anim.swell(g);   // first sight: it looms, then shrinks back over 16 frames
        if (k === 1) ctx.drawImage(sprite, snap(x), snap(y));
        else { const w = snap(s * k); ctx.drawImage(sprite, snap(x + s / 2 - w / 2), snap(y + s - w), w, w); }
        ctx.globalAlpha = 1;
        if (g.state === 'aim' && g.locked && g.vis > 0.5) pixelText('!', x + s / 2, y - 3, 10, '#fff', col);
        // while you're disguised, ghosts that can see you show it: ? watching, ! nearly onto you
        else if (coat.disguised && g.vis > 0.5 && coat.watching(g)) {
            pixelText(coat.suspicion > 0.7 ? '!' : '?', x + s / 2, y - 3, 10, g.immune ? '#f33' : '#fd4', '#000');
        }
    }

    // A hidden ghost still shows its reticle (that's your warning), but not the line back to it.
    function drawAim(g, now) {
        const fx0 = sx(g.x), fy0 = sy(g.y);
        const tx = fx0 + wdelta(g.x, g.target.x) * GRID_SIZE, ty = fy0 + wdelta(g.y, g.target.y) * GRID_SIZE;
        const progress = Math.min(1, g.t / g.aimMs);
        const col = g.traitor ? SM.coat.TRAITOR_COLOR : g.color;

        ctx.save();
        ctx.globalAlpha = (g.locked ? 0.9 : 0.35 + 0.35 * progress) * g.vis;
        pixelLine(fx0, fy0, tx, ty, col, g.locked ? 1 : 3);

        // reticle
        const r = g.locked ? GRID_SIZE * 0.7 : GRID_SIZE * (1.5 - 0.8 * progress) + Math.sin(now / 60) * 1.5;
        ctx.globalAlpha = g.locked ? 1 : 0.75;
        pixelRing(tx, ty, r, col);
        for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            pixelLine(tx + ux * (r - 4), ty + uy * (r - 4), tx + ux * (r + 4), ty + uy * (r + 4), col);
        }
        if (g.locked) { // dithered, pulsing target cell
            const on = Math.floor(now / 70) % 2;
            ctx.fillStyle = col;
            ctx.globalAlpha = 0.55;
            const L = snap(tx - GRID_SIZE / 2), T = snap(ty - GRID_SIZE / 2);
            for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
                if ((i + j + on) % 2 === 0) ctx.fillRect(L + i * P, T + j * P, P, P);
            }
        }
        ctx.restore();
    }

    function drawDerivatives() {
        const kin = K.state;
        const hx = sx(G.snake[0].x), hy = sy(G.snake[0].y);
        // INKY's read of you: the 2nd-order predicted path
        ctx.save();
        ctx.fillStyle = '#f0f';
        for (let T = 1; T <= 10; T++) {
            const p = K.predict(2, T);
            ctx.globalAlpha = 0.45 * (1 - T / 12);
            ctx.fillRect(snap(hx + (p.x - kin.ux) * GRID_SIZE) - P / 2, snap(hy + (p.y - kin.uy) * GRID_SIZE) - P / 2, P, P);
        }
        ctx.globalAlpha = 0.8;
        pixelArrow(hx, hy, kin.v.x * GRID_SIZE * 3, kin.v.y * GRID_SIZE * 3, '#0ff');
        pixelArrow(hx, hy, kin.a.x * GRID_SIZE * 10, kin.a.y * GRID_SIZE * 10, '#f0f');
        ctx.restore();
    }

    // A sprite sunk `depth` tiles into the hole on its tile: shifted down, cut off at the pit.
    function drawSunk(spr, x, y, depth) {
        const g = GRID_SIZE;
        ctx.save();
        ctx.beginPath(); ctx.rect(x - g, y - g, g * 3, g * 1.6); ctx.clip();
        ctx.drawImage(spr, x, snap(y + depth * g));
        ctx.restore();
    }

    function drawSnake(now) {
        const g = GRID_SIZE, coat = SM.coat, snake = G.snake;
        const blink = G.invuln > 0 && Math.floor(now / 80) % 2;
        ctx.globalAlpha = blink ? 0.3 : 1;

        // under a prism the body cycles the spectrum, and flickers back to normal as it runs out
        const rainbow = G.prism > 0 && !(G.prism < 1500 && Math.floor(now / 120) % 2);
        // in disguise the body goes ghostly lavender, flickering as the cover runs out
        const disguise = coat.disguised && !(coat.coatT < 1500 && Math.floor(now / 120) % 2);
        const roll = Math.floor(now / 60);
        const di = dirIndex(G.direction);
        for (let i = snake.length - 1; i >= 1; i--) {
            const part = snake[i];
            if (part.under) continue;                    // the tunnel draws those (a ridge, or nothing)
            const k = Math.min(7, Math.floor((i / snake.length) * 8));
            const spr = disguise ? gfx.coatBodySprite(k) : rainbow ? gfx.rainbowBodySprite(((roll - i) % gfx.HUES + gfx.HUES) % gfx.HUES) : gfx.bodySprite(k);
            ctx.globalAlpha = (blink ? 0.3 : 1) * (disguise ? 0.6 : 1);
            const x = snap(sx(part.x) - g / 2), y = snap(sy(part.y) - g / 2);
            // at a hole mouth the body dips into the pit (entry) or rises out of it (exit)
            const mouth = (part.entry && snake[i - 1].under) || (part.exit && snake[i + 1] && snake[i + 1].under);
            if (mouth) drawSunk(spr, x, y, 0.45);
            else ctx.drawImage(spr, x, y);
        }
        ctx.globalAlpha = blink ? 0.3 : 1;

        // head: the "Pac" in Snake-Man, chomping in the direction of travel (or a ghost costume)
        const frame = G.mode === 'play' ? [0, 1, 2, 1][Math.floor(now / 60) % 4] : 1;
        const spr = disguise ? gfx.ghostSprite(coat.COAT_COLOR, Math.floor(now / 150) % 2, di, 'normal') : gfx.pacSprite(di, frame);
        const hx = snap(sx(snake[0].x) - g / 2), hy = snap(sy(snake[0].y) - g / 2);
        const pose = SM.dash.headPose();
        if (!pose) ctx.drawImage(spr, hx, hy);
        else if (pose.sink !== undefined) drawSunk(spr, hx, hy, pose.sink * 0.9);   // sliding down into the hole
        else if (pose.pop !== undefined) {          // springing out: stretch up, overshoot, settle
            const ys = 0.25 + 0.75 * fx.ease.outBack(pose.pop), xs = 1 / Math.sqrt(Math.max(0.5, ys));
            ctx.save();
            ctx.translate(hx + g / 2, hy + g);
            ctx.scale(xs, ys);
            ctx.drawImage(spr, -g / 2, -g);
            ctx.restore();
        }
        ctx.globalAlpha = 1;

        if (coat.disguised) {   // suspicion meter over your head: yellow → red
            const bw = GRID_SIZE + 8, bx = snap(sx(snake[0].x) - bw / 2), by = snap(sy(snake[0].y) - g / 2 - 10);
            ctx.fillStyle = '#000'; ctx.fillRect(bx - P, by - P, bw + 2 * P, 4 + 2 * P);
            ctx.fillStyle = gfx.rgbStr(gfx.mix([255, 220, 60], [255, 40, 40], coat.suspicion));
            ctx.fillRect(bx, by, snap(bw * coat.suspicion), 4);
            ctx.fillStyle = coat.COAT_COLOR;
            ctx.fillRect(bx, by + 4 + P, snap(bw * Math.max(0, coat.coatT) / coat.COAT_MS), P);   // cover time left
        }
    }

    function drawMinimap(now) {
        const size = minimap.width, ox = W - size - 8, oy = 8, s = MM_SCALE;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.drawImage(minimap, ox, oy);
        ctx.beginPath(); ctx.rect(ox, oy, size, size); ctx.clip();
        ctx.fillStyle = '#ff0';
        const pellets = SM.pellets.list;
        pellets.forEach(p => { if (!p.rainbow) ctx.fillRect(ox + p.x * s - 0.5, oy + p.y * s - 0.5, 2.5, 2.5); });
        pellets.forEach(p => {
            if (!p.rainbow) return;
            ctx.fillStyle = gfx.rgbStr(gfx.hsl((now / 4) % 360));
            ctx.fillRect(ox + p.x * s - 1.5, oy + p.y * s - 1.5, 4.5, 4.5);
        });
        // with shadows on, the minimap only shows ghosts you can actually see
        G.ghosts.forEach(gh => {
            if (!gh.active || gh.vis < 0.5) return;
            ctx.fillStyle = gh.traitor ? SM.coat.TRAITOR_COLOR : gh.state === 'daze' ? (gh.immune ? '#999' : '#44f') : gh.color;
            ctx.fillRect(ox + gh.x * s - 1, oy + gh.y * s - 1, 3.5, 3.5);
        });
        // viewport box (drawn wrapped)
        ctx.strokeStyle = 'rgba(0,255,0,0.6)';
        ctx.lineWidth = 1;
        const vx = ox + (cam.x - VIEW / 2) * s, vy = oy + (cam.y - VIEW / 2) * s;
        for (const dx of [-N * s, 0, N * s]) for (const dy of [-N * s, 0, N * s]) ctx.strokeRect(vx + dx, vy + dy, VIEW * s, VIEW * s);
        if (Math.floor(now / 200) % 2 || G.mode !== 'play') {
            ctx.fillStyle = '#fff';
            ctx.fillRect(ox + G.snake[0].x * s - 1.5, oy + G.snake[0].y * s - 1.5, 4.5, 4.5);
        }
        ctx.restore();
        ctx.fillStyle = '#333';
        ctx.fillRect(ox - 2, oy - 2, size + 4, 2); ctx.fillRect(ox - 2, oy + size, size + 4, 2);
        ctx.fillRect(ox - 2, oy, 2, size); ctx.fillRect(ox + size, oy, 2, size);
    }

    function drawOverlay(lines) {
        // dithered darkening instead of a flat wash
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for (let y = 0; y < canvas.height; y += P * 2) ctx.fillRect(0, y, W, P);
        lines.forEach(([text, size, color], i) => {
            pixelText(text, W / 2, canvas.height / 2 - 72 + i * 32, size, color, i === 0 ? '#401010' : '#000');
        });
    }

    // --- CRT PASS ---
    const bloomA = document.createElement('canvas'); bloomA.width = bloomA.height = W / 4;
    const bloomB = document.createElement('canvas'); bloomB.width = bloomB.height = W / 10;
    const bctxA = bloomA.getContext('2d'), bctxB = bloomB.getContext('2d');
    const crtOverlay = document.createElement('canvas');
    crtOverlay.width = W; crtOverlay.height = canvas.height;
    (() => {
        const o = crtOverlay.getContext('2d');
        // scanlines: darken the lower half of every sub-pixel row
        o.fillStyle = 'rgba(0,0,0,0.28)';
        for (let y = 1; y < crtOverlay.height; y += P) o.fillRect(0, y, W, 1);
        // faint aperture-grille tint
        const tints = ['rgba(255,0,0,0.035)', 'rgba(0,255,0,0.035)', 'rgba(0,0,255,0.035)'];
        for (let x = 0; x < W; x++) { o.fillStyle = tints[x % 3]; o.fillRect(x, 0, 1, crtOverlay.height); }
        // vignette
        const v = o.createRadialGradient(W / 2, W / 2, W * 0.3, W / 2, W / 2, W * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.45)');
        o.fillStyle = v;
        o.fillRect(0, 0, W, crtOverlay.height);
    })();

    function present(now) {
        dctx.globalCompositeOperation = 'source-over';
        dctx.globalAlpha = 1;
        dctx.imageSmoothingEnabled = false;
        const j = SM.anim.jolt();   // the sighting shock shudders the screen
        dctx.fillStyle = '#000';
        if (j.x || j.y) dctx.fillRect(0, 0, W, canvas.height);
        dctx.drawImage(scene, j.x, j.y);
        if (!G.opts.crt) return;

        // bloom: downsample twice (cheap blur), add back on top
        bctxA.imageSmoothingEnabled = bctxB.imageSmoothingEnabled = true;
        bctxA.clearRect(0, 0, bloomA.width, bloomA.height);
        bctxA.drawImage(scene, 0, 0, bloomA.width, bloomA.height);
        bctxB.clearRect(0, 0, bloomB.width, bloomB.height);
        bctxB.drawImage(bloomA, 0, 0, bloomB.width, bloomB.height);
        dctx.imageSmoothingEnabled = true;
        dctx.globalCompositeOperation = 'lighter';
        dctx.globalAlpha = 0.28;
        dctx.drawImage(bloomA, 0, 0, W, canvas.height);
        dctx.globalAlpha = 0.32;
        dctx.drawImage(bloomB, 0, 0, W, canvas.height);

        dctx.globalCompositeOperation = 'source-over';
        dctx.globalAlpha = 1;
        dctx.drawImage(crtOverlay, 0, 0);
        // a whisper of flicker and a slow rolling bar
        const barY = (now / 12) % (canvas.height + 120) - 60;
        dctx.fillStyle = 'rgba(255,255,255,0.025)';
        dctx.fillRect(0, barY, W, 60);
        dctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.025})`;
        dctx.fillRect(0, 0, W, canvas.height);
    }

    // --- DOM HUD ---
    const $ = id => document.getElementById(id);
    const el = { score: $('score'), hi: $('hi'), lives: $('lives'), time: $('time'), zone: $('zone'), coat: $('coat'),
                 dash: $('dash'), kin: $('kin'), btnCoat: $('btnCoat'), btnPause: $('btnPause'), btnDash: $('btnDash') };
    const setText = (e, t) => { if (e && e.innerText !== String(t)) e.innerText = t; };
    const fmtTime = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

    function hud() {
        const coat = SM.coat, dash = SM.dash;
        setText(el.score, G.score);
        setText(el.hi, G.hi);
        setText(el.lives, G.lives);
        setText(el.time, fmtTime(G.timeLeft));
        el.time.className = G.timeLeft <= 30000 ? 'low' : '';
        const next = M.STAGES[M.stage + 1];
        setText(el.zone, (M.stage + 1) + '/' + M.STAGES.length + (next ? ' (' + (next.at - G.eaten) + ')' : ''));
        setText(el.coat, coat.disguised ? (coat.coatT / 1000).toFixed(1) + 's' : coat.cool > 0 ? Math.ceil(coat.cool / 1000) + 's' : 'READY');
        el.coat.style.color = coat.disguised ? coat.COAT_COLOR : coat.cool > 0 ? '#666' : '';
        setText(el.dash, dash.busy ? 'DIG!' : dash.cool > 0 ? Math.ceil(dash.cool / 1000) + 's' : 'READY');
        el.dash.style.color = dash.busy ? '#c89c62' : dash.cool > 0 ? '#666' : '';
        el.btnCoat.classList.toggle('on', coat.disguised);
        el.btnCoat.classList.toggle('cool', coat.cool > 0);
        el.btnDash.classList.toggle('on', dash.busy);
        el.btnDash.classList.toggle('cool', dash.cool > 0);
        setText(el.btnPause, G.mode === 'paused' ? 'GO' : G.mode === 'over' ? 'AGAIN' : 'PAUSE');
        setText(el.btnCoat, G.mode === 'ready' || G.mode === 'over' ? 'NEW' : 'COAT');
        const kin = K.state, f = n => (n >= 0 ? ' ' : '−') + Math.abs(n).toFixed(2);
        el.kin.innerHTML = `<span class="v">ẋ (${f(kin.v.x)},${f(kin.v.y)})</span> &nbsp; <span class="a">ẍ (${f(kin.a.x)},${f(kin.a.y)})</span>`;
    }

    // --- FRAME ---
    function draw(now, dt) {
        SM.view.follow(G.snake[0].x, G.snake[0].y, dt);

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, W, canvas.height);
        drawFloor();
        drawPellets(now);
        SM.dash.drawFloor(now);    // holes, ridges and the racing mound sit on the ground...
        fx.draw('floor', now);

        // Line of sight: shadow the floor behind walls, then lay the walls on top
        updateVisibility(dt);
        if (G.opts.occlusion) drawOcclusion(sx(G.snake[0].x), sy(G.snake[0].y));
        drawWalls(now);            // ...so walls cover anything burrowing beneath them

        // Attack telegraphs under everything else
        G.ghosts.forEach(g => { if (g.active && g.state === 'aim') drawAim(g, now); });

        if (G.opts.derivs && G.mode !== 'over') drawDerivatives();
        drawSnake(now);
        G.ghosts.forEach(g => { if (g.active) drawGhost(g, now); });
        fx.draw('over', now);

        if (G.opts.minimap) drawMinimap(now);
        SM.heal.draw(now);

        // Hit flash
        if (G.flash > 0) {
            ctx.fillStyle = `rgba(255,0,0,${G.flash * 0.35})`;
            ctx.fillRect(0, 0, W, canvas.height);
            G.flash = Math.max(0, G.flash - dt / 400);
        }

        const touch = document.documentElement.classList.contains('touch');
        if (G.mode === 'ready') drawOverlay([
            ['SNAKE-MAN', 32, '#FFD700'],
            [touch ? 'PUSH THE STICK' : 'PRESS AN ARROW KEY', 14, '#0f0'],
            ['5:00 ON THE CLOCK - MAP #' + G.mapSeed, 10, '#999'],
            [touch ? 'DIG: BURROW UNDER WALLS' : 'SHIFT: DASH - BURROW UNDER WALLS', 10, '#c89c62'],
            [touch ? 'COAT: PASS AS A GHOST' : 'ESC: TURNCOAT - PASS AS A GHOST', 10, SM.coat.COAT_COLOR],
            ['CLIMB THE LADDER TO HEAL', 10, '#ff5577'],
            touch ? ['NEW: NEW MAP', 10, '#777'] : ['N: NEW MAP   C: CRT   O: SHADOWS', 10, '#777'],
        ]);
        if (G.mode === 'paused') drawOverlay([['PAUSED', 32, '#0f0'], [touch ? 'TAP GO TO RESUME' : 'SPACE TO RESUME', 12, '#999']]);
        if (G.mode === 'over') drawOverlay([
            [G.overReason, 30, G.overReason === 'TIME UP' ? '#FFD700' : '#f33'],
            ['SCORE ' + G.score, 18, '#FFD700'],
            ['LADDER RUNG ' + (SM.heal.rung + 1), 10, '#ff5577'],
            [touch ? 'AGAIN: SAME MAP' : 'ENTER/SPACE: SAME MAP', 10, '#999'],
            [touch ? 'NEW: NEW MAP' : 'N: NEW MAP', 10, '#999'],
        ]);

        present(now);
        hud();
    }

    SM.render = { draw };
})();
