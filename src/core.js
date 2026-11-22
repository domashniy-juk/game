/* core: math, state, physics, shared world containers. No THREE usage here. */
(function (window) {
  'use strict';
  var G = (window.G = window.G || {});

  /* ------------------------------------------------------------------ math */
  G.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  G.lerp = function (a, b, t) { return a + (b - a) * t; };
  G.damp = function (a, b, rate, dt) { return a + (b - a) * (1 - Math.exp(-rate * dt)); };
  G.rand = function (a, b) { return a + Math.random() * (b - a); };
  G.randInt = function (a, b) { return Math.floor(G.rand(a, b + 1)); };
  G.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  G.wrapPI = function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

  /* deterministic rng for texture/level baking */
  G.rng = function (seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t << 1) >>> 0;
      t = (t + Math.imul(t >>> 7, t << 7)) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ------------------------------------------------------------------ tuning */
  G.cfg = {
    eye: 1.72, crouchEye: 1.02, stepUp: 0.66, stepDown: 1.4,
    playerR: 0.44, walkSpeed: 5.6, runSpeed: 10.2, strafeSpeed: 8.4,
    gravity: 26, jumpVel: 3.4, jumpCharge: 0.16,
    mouseSens: 0.0021, maxPitch: 1.42, levelEase: 2.1, rollEase: 9,
    fireDelay: 0.078, beltSize: 120, reloadTime: 1.55, spread: 0.010,
    bulletSpeed: 340, bulletRange: 220, damageKick: 0.85,
    fovBase: 74, fovRun: 82, hitR: 1.35
  };

  G.pal = {
    stone: 0xb59a6d, stoneDark: 0x6f5b3d, marble: 0xd8cbb2, marbleBlue: 0x8fa3b8,
    gold: 0xd9a13b, bronze: 0x8c6a2e, wood: 0x5b4126, blood: 0x8c1b12,
    water: 0x2f6f78, moss: 0x5f6b3b, sand: 0xc9a86e, sky: 0x9fc0d8
  };

  /* ------------------------------------------------------------------ state */
  G.state = {
    running: false, paused: true, over: false, win: false,
    time: 0, score: 0, lastScore: 0, combo: 0, comboT: 0,
    health: 100, armor: 100, ammo: G.cfg.beltSize, spare: 3,
    reloadT: 0, fireCooldown: 0, firing: false, aimHeld: false,
    wave: -1, waveArmed: [], alive: 0, boss: null, gameOver: false, cleared: false,
    shakeAmp: 0, shake: 0, levelT: 0, aimT: 0, hitFlash: 0, dmgFlash: 0, hurtPulse: 0,
    fps: 0, fpsAvg: 0, fpsMin: 999, frames: 0, fpsClock: 0,
    muted: false, messages: [], cheats: 0
  };
  G.input = { lock: false, fwd: 0, side: 0, sprint: false, crouch: false, jump: false, use: false, mdx: 0, mdy: 0, wheel: 0 };
  G.view = { yaw: 0, pitch: 0, aimPitch: 0, roll: 0, bob: 0, bobPhase: 0, height: G.cfg.eye, vy: 0, air: 0, crouchF: 0, lunge: 0 };
  G.playerPos = { x: 0, y: 0, z: 52 };

  G.world = {
    colliders: [],       /* AABBs {min,max,solid,mover,gate} */
    solids: [],          /* meshes for bullet raycast */
    triggers: [],        /* {x,z,r,wave,label} */
    gates: [],           /* {mesh, collider, open/close anim} */
    movers: [],          /* lift platforms */
    switches: [],        /* {pos, action, label} */
    bounds: { min: { x: -50, z: -67 }, max: { x: 55, z: 66 } },
    lights: [],          /* point lights kept few for speed */
    pickups: [], enemies: [], projectiles: [], tracers: [], decals: []
  };

  /* ------------------------------------------------------------------ physics (AABB list) */
  var W = G.world;

  function circleHitsRect(cx, cz, r, x0, z0, x1, z1) {
    var nx = cx < x0 ? x0 : cx > x1 ? x1 : cx;
    var nz = cz < z0 ? z0 : cz > z1 ? z1 : cz;
    var dx = cx - nx, dz = cz - nz;
    return dx * dx + dz * dz < r * r;
  }

  /* true when an entity at (x,z), feet y, head y, radius r is blocked */
  G.blocked = function (x, z, feet, head, r, step) {
    for (var i = 0; i < W.colliders.length; i++) {
      var c = W.colliders[i];
      if (!c.solid) continue;
      if (c.max.y <= feet + step) continue;   /* low enough to climb over */
      if (c.min.y >= head) continue;          /* over the head */
      if (circleHitsRect(x, z, r, c.min.x, c.min.z, c.max.x, c.max.z)) return c;
    }
    return null;
  };

  /* highest surface under the feet (0 = base floor) */
  G.groundAt = function (x, z, feet, step, drop) {
    var best = 0, top = feet + step, low = feet - drop;
    for (var i = 0; i < W.colliders.length; i++) {
      var c = W.colliders[i];
      if (!c.solid) continue;
      var y = c.max.y;
      if (y > top || y < low) continue;
      if (circleHitsRect(x, z, 0.30, c.min.x, c.min.z, c.max.x, c.max.z) && y > best) best = y;
    }
    return best;
  };

  /* slide-then-step movement on the XZ plane; returns new pos + grounded flag */
  G.moveXZ = function (p, dx, dz, r, feet, head, step) {
    var res = { x: p.x, z: p.z, bumped: false };
    var sub = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
    for (var s = 1; s <= sub; s++) {
      var tx = p.x + dx * (s / sub), tz = p.z + dz * (s / sub);
      if (!G.blocked(tx, p.z, feet, head, r, step)) res.x = tx; else res.bumped = true;
      if (!G.blocked(res.x, tz, feet, head, r, step)) res.z = tz; else res.bumped = true;
    }
    return res;
  };

  /* horizontal ray vs colliders -> distance of the first hit (for enemy line-of-sight) */
  G.rayHitXZ = function (ox, oz, dx, dz, len, y) {
    var best = len;
    for (var i = 0; i < W.colliders.length; i++) {
      var c = W.colliders[i];
      if (!c.solid || c.max.y <= y || c.min.y >= y + 1.6) continue;
      /* slab test */
      var t0 = 0, t1 = best, hit = true;
      var lo = c.min.x, hi = c.max.x;
      if (Math.abs(dx) < 1e-6) { if (ox < lo || ox > hi) hit = false; }
      else {
        var ta = (lo - ox) / dx, tb = (hi - ox) / dx;
        if (ta > tb) { var q = ta; ta = tb; tb = q; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) hit = false;
      }
      if (hit) {
        lo = c.min.z; hi = c.max.z;
        if (Math.abs(dz) < 1e-6) { if (oz < lo || oz > hi) hit = false; }
        else {
          ta = (lo - oz) / dz; tb = (hi - oz) / dz;
          if (ta > tb) { var q2 = ta; ta = tb; tb = q2; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) hit = false;
        }
      }
      if (hit && t1 > 0.02) best = Math.min(best, t1);
    }
    return best;
  };

  /* full 3D ray vs every collider: returns the nearest hit with a face normal */
  G.rayBox = function (ox, oy, oz, dx, dy, dz, len) {
    var best = null;
    for (var i = 0; i < W.colliders.length; i++) {
      var c = W.colliders[i];
      if (!c.solid) continue;
      var t0 = 0, t1 = len, nax = 0, nay = 0, naz = 0, ok = true;
      var lo = c.min.x, hi = c.max.x;
      if (Math.abs(dx) < 1e-7) { if (ox < lo || ox > hi) ok = false; }
      else {
        var ta = (lo - ox) / dx, tb = (hi - ox) / dx, na = -1;
        if (ta > tb) { var q = ta; ta = tb; na = 1; }
        if (ta > t0) { t0 = ta; nax = na; }
        t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (ok) {
        lo = c.min.y; hi = c.max.y;
        if (Math.abs(dy) < 1e-7) { if (oy < lo || oy > hi) ok = false; }
        else {
          ta = (lo - oy) / dy; tb = (hi - oy) / dy; na = -1;
          if (ta > tb) { q = ta; ta = tb; na = 1; }
          if (ta > t0) { t0 = ta; nay = na; }
          t1 = Math.min(t1, tb);
          if (t0 > t1) ok = false;
        }
      }
      if (ok) {
        lo = c.min.z; hi = c.max.z;
        if (Math.abs(dz) < 1e-7) { if (oz < lo || oz > hi) ok = false; }
        else {
          ta = (lo - oz) / dz; tb = (hi - oz) / dz; na = -1;
          if (ta > tb) { q = ta; ta = tb; na = 1; }
          if (ta > t0) { t0 = ta; naz = na; }
          t1 = Math.min(t1, tb);
          if (t0 > t1) ok = false;
        }
      }
      if (ok && t0 > 0.02 && (!best || t0 < best.t)) {
        var nx = 0, ny = 0, nz = 0;
        /* the entry face opposes the dominant direction component */
        if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) >= Math.abs(dz)) nx = dx > 0 ? -1 : 1;
        else if (Math.abs(dy) >= Math.abs(dz)) ny = dy > 0 ? -1 : 1;
        else nz = dz > 0 ? -1 : 1;
        best = { t: t0, nx: nx, ny: ny, nz: nz };
      }
    }
    return best;
  };

  /* 3D ray vs the collider set: distance + surface normal of the first hit */
  G.rayHit3 = function (ox, oy, oz, dx, dy, dz, len) {
    var best = null;
    for (var i = 0; i < W.colliders.length; i++) {
      var c = W.colliders[i];
      if (!c.solid) continue;
      var t0 = 0, t1 = len, ok = true;
      var lo = c.min.x, hi = c.max.x;
      if (Math.abs(dx) < 1e-7) { if (ox < lo || ox > hi) ok = false; }
      else {
        var ta = (lo - ox) / dx, tb = (hi - ox) / dx;
        if (ta > tb) { var q = ta; ta = tb; tb = q; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (ok) {
        lo = c.min.y; hi = c.max.y;
        if (Math.abs(dy) < 1e-7) { if (oy < lo || oy > hi) ok = false; }
        else {
          ta = (lo - oy) / dy; tb = (hi - oy) / dy;
          if (ta > tb) { q = ta; ta = tb; tb = q; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) ok = false;
        }
      }
      if (ok) {
        lo = c.min.z; hi = c.max.z;
        if (Math.abs(dz) < 1e-7) { if (oz < lo || oz > hi) ok = false; }
        else {
          ta = (lo - oz) / dz; tb = (hi - oz) / dz;
          if (ta > tb) { q = ta; ta = tb; tb = q; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) ok = false;
        }
      }
      if (!ok) continue;
      var t = t0 > 0.02 ? t0 : t1;
      if (t < 0.02 || (best && t >= best.t)) continue;
      /* recover the normal from the axis that produced t */
      var nx = 0, ny = 0, nz = 0;
      if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) >= Math.abs(dz)) nx = dx > 0 ? -1 : 1;
      else if (Math.abs(dy) >= Math.abs(dz)) ny = dy > 0 ? -1 : 1;
      else nz = dz > 0 ? -1 : 1;
      best = { t: t, nx: nx, ny: ny, nz: nz };
    }
    return best;
  };

  /* ------------------------------------------------------------------ messaging (Sam-style callouts) */
  G.say = function (text, kind) {
    G.state.messages.push({ t: text, kind: kind || 'say', life: 3.6, age: 0 });
    if (G.state.messages.length > 6) G.state.messages.shift();
  };
  G.yell = function (t) { G.say(t, 'yell'); };

  /* small helpers other modules use */
  G.dist2 = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); };
  G.angTowards = function (ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); };

  G.reset = function () {
    var s = G.state;
    s.health = 100; s.armor = 100; s.ammo = G.cfg.beltSize; s.spare = 3;
    s.score = 0; s.combo = 0; s.wave = -1; s.over = false; s.win = false;
    s.shake = 0; s.shakeAmp = 0; s.hitFlash = 0; s.dmgFlash = 0; s.reloadT = 0; s.fireCooldown = 0;
    s.gameOver = false; s.cleared = false; s.aimT = 0; s.levelT = 0;
    s.messages.length = 0; s.cheats = 0;
    s.alive = 0; G.state.boss = null;
    G.world.enemies.length = 0; G.world.projectiles.length = 0;
    G.world.tracers.length = 0; G.world.pickups.length = 0;
    G.view.yaw = 0; G.view.pitch = 0; G.view.aimPitch = 0; G.view.roll = 0;
    G.view.height = G.cfg.eye; G.view.vy = 0; G.view.air = 0; G.view.crouchF = 0;
    G.playerPos.x = 0; G.playerPos.y = 0; G.playerPos.z = 52;
  };
})(window);
