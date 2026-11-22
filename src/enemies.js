/* entities: winged divers, armoured runners, the boss, and enemy fire */
(function (G) {
  'use strict';
  var E = (G.enemies = {});
  E.list = G.world.enemies;

  /* ------------------------------------------------------------------ materials */
  function Phong(col, spec, shine, em) {
    return new THREE.MeshPhongMaterial({
      color: col,
      specular: spec === undefined ? 0x241408 : spec,
      shininess: shine === undefined ? 14 : shine,
      emissive: em === undefined ? 0x000000 : em
    });
  }
  var MAT = null;
  function mats() {
    if (MAT) return MAT;
    MAT = {
      hide: Phong(0x8d3a22, 0x3a1c0c, 22),
      hide2: Phong(0x6d2c18),
      skin: Phong(0xb06038),
      horn: Phong(0xd8c69a, 0x222222, 30),
      eye: Phong(0xffcf4a, 0x000000, 4, 0xff9a20),
      metal: Phong(0x7f7a6a, 0x333028, 40),
      dark: Phong(0x3d3428),
      gold: Phong(0xd9b24a, 0x554422, 45)
    };
    return MAT;
  }
  function box(g, w, h, d, x, y, z, mat) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || mats().hide);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }

  /* ------------------------------------------------------------------ bodies */
  function flyerBody(sc, s, big, heads) {
    var m = mats();
    var g = new THREE.Group();
    box(g, 1.2 * s, 0.95 * s, 1.9 * s, 0, 0, 0, m.hide);
    box(g, 0.8 * s, 0.7 * s, 0.8 * s, 0, 0.15 * s, 1.2 * s, m.hide2);
    box(g, 0.55 * s, 0.4 * s, 0.5 * s, 0, 0.35 * s, 1.5 * s, m.skin);
    box(g, 0.2 * s, 0.12 * s, 0.18 * s, -0.14 * s, 0.4 * s, 1.7 * s, m.eye);
    box(g, 0.2 * s, 0.12 * s, 0.18 * s, 0.14 * s, 0.4 * s, 1.7 * s, m.eye);
    box(g, 0.16 * s, 0.5 * s, 0.16 * s, -0.28 * s, 0.7 * s, 1.35 * s, m.horn);
    box(g, 0.16 * s, 0.5 * s, 0.16 * s, 0.28 * s, 0.7 * s, 1.35 * s, m.horn);
    box(g, 1.4 * s, 0.25 * s, 1.1 * s, 0, 0.2 * s, -1.3 * s, m.hide2);
    box(g, 0.3 * s, 0.7 * s, 0.6 * s, 0, -0.6 * s, -0.4 * s, m.hide2);
    box(g, 0.9 * s, 0.1 * s, 0.5 * s, -0.4 * s, -0.95 * s, -0.4 * s, m.dark);
    box(g, 0.9 * s, 0.1 * s, 0.5 * s, 0.4 * s, -0.95 * s, -0.4 * s, m.dark);
    var hl = new THREE.PointLight(big ? 0xff8a34 : 0xff7a30, big ? 2.2 : 0.8, big ? 26 : 8, 2);
    hl.position.set(0, 0.4 * s, 1.6 * s);
    g.add(hl);
    var wL = new THREE.Group(), wR = new THREE.Group();
    for (var i = 0; i < 3; i++) {
      var seg = new THREE.Mesh(new THREE.BoxGeometry(1.9 * s * (1 - i * 0.2), 0.12 * s, 0.9 * s * (1 - i * 0.14)), i % 2 ? m.hide2 : m.hide);
      seg.position.x = 1.0 * s + i * 1.6 * s;
      wL.add(seg);
      var mir = new THREE.Mesh(seg.geometry, seg.material);
      mir.position.x = -seg.position.x;
      wR.add(mir);
    }
    wL.position.set(-0.5 * s, 0.35 * s, 0);
    wR.position.set(0.5 * s, 0.35 * s, 0);
    g.add(wL);
    g.add(wR);
    for (var h = 0; h < heads - 1; h++) {
      var side = h === 0 ? -1 : 1;
      box(g, 0.5 * s, 0.4 * s, 1.1 * s, side * 0.55 * s, 0.55 * s, 1.1 * s, m.hide2);
      box(g, 0.4 * s, 0.3 * s, 0.4 * s, side * 0.55 * s, 0.7 * s, 1.6 * s, m.skin);
      box(g, 0.14 * s, 0.1 * s, 0.14 * s, side * 0.55 * s, 0.78 * s, 1.78 * s, m.eye);
    }
    sc.add(g);
    return { grp: g, wL: wL, wR: wR };
  }

  function runnerBody(sc, s) {
    var m = mats();
    var g = new THREE.Group();
    box(g, 1.0 * s, 1.2 * s, 0.75 * s, 0, 1.35 * s, 0, m.metal);
    box(g, 0.75 * s, 0.5 * s, 0.85 * s, 0, 2.1 * s, 0, m.hide);
    box(g, 0.42 * s, 0.34 * s, 0.42 * s, 0, 2.5 * s, 0.08 * s, m.skin);
    box(g, 0.5 * s, 0.1 * s, 0.12 * s, 0, 2.55 * s, 0.3 * s, m.eye);
    box(g, 0.4 * s, 0.7 * s, 0.5 * s, -0.72 * s, 1.6 * s, 0, m.hide2);
    box(g, 0.4 * s, 0.7 * s, 0.5 * s, 0.72 * s, 1.6 * s, 0, m.hide2);
    var legL = new THREE.Group(), legR = new THREE.Group();
    var l1 = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.9 * s, 0.36 * s), m.dark);
    l1.position.set(-0.26 * s, 0, 0);
    legL.add(l1);
    legL.position.set(0, 0.9 * s, 0);
    var l2 = new THREE.Mesh(l1.geometry, l1.material);
    l2.position.set(0.26 * s, 0, 0);
    legR.add(l2);
    legR.position.set(0, 0.9 * s, 0);
    g.add(legL);
    g.add(legR);
    var gun = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.13 * s, 1.5 * s, 8), m.dark);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0.35 * s, 1.7 * s, 0.9 * s);
    g.add(gun);
    sc.add(g);
    return { grp: g, legL: legL, legR: legR };
  }

  /* ------------------------------------------------------------------ spawn */
  function mk(type, x, y, z, delay) {
    var sc = G.level.scene, e;
    if (type === 'runner') {
      var rb = runnerBody(sc, 1);
      e = {
        type: type, grp: rb.grp, parts: rb, x: x, y: 0, z: z, yaw: 0,
        r: 1.1, score: 120, hits: 1, t: 0, delay: delay,
        fireT: G.rand(0.7, 1.8), hop: 0, hopT: 0, leap: G.rand(0.8, 2.2), phase: G.rand(0, 6.28)
      };
    } else {
      var big = type === 'boss';
      var s = big ? 2.6 : 1.15;
      var fb = flyerBody(sc, s, big, big ? 3 : 1);
      e = {
        type: type, grp: fb.grp, wings: fb, x: x, y: y, z: z, homeX: x, homeY: y, homeZ: z, yaw: 0,
        r: s * 1.2, score: big ? 900 : 100, hits: big ? 8 : 1, t: 0, delay: delay,
        state: big ? 'fire' : 'hover', dive: null, fireT: G.rand(0.8, 1.6), flap: G.rand(0, 6.28), pitch: 0
      };
      if (big) G.state.boss = e;
    }
    E.list.push(e);
  }

  E.spawnWave = function (i) {
    var wv = G.waves[i];
    if (!wv) return;
    for (var k = 0; k < wv.spawn.length; k++) {
      var sp = wv.spawn[k];
      mk(sp.t, sp.x, sp.y, sp.z, sp.d);
    }
    G.state.wave = i;
    G.state.spawned = true;
  };

  /* ------------------------------------------------------------------ enemy fire */
  function shootFire(e, big) {
    var ox = e.x, oy = e.type === 'runner' ? e.y + 1.7 : e.y, oz = e.z;
    var dx = G.playerPos.x - ox, dy = (G.view.height + 0.5) - oy, dz = G.playerPos.z - oz;
    var len = Math.hypot(dx, dy, dz) || 1;
    var sp = big ? 19 : 38;
    G.world.projectiles.push({
      hostile: true, x: ox, y: oy, z: oz,
      vx: dx / len * sp, vy: dy / len * sp, vz: dz / len * sp,
      r: big ? 0.8 : 0.16, life: 7, big: !!big, dmg: big ? 34 : 16, mesh: null
    });
    G.fx.spark(ox, oy, oz, 1.4, 0.3, big ? 1.0 : 0.32, big ? 0xff8a3a : 0xffd27a);
    G.audio.dart({ x: ox, z: oz });
  }

  /* ------------------------------------------------------------------ AI */
  function updateRunner(e, dt) {
    var P = G.playerPos, d = G.dist2(e.x, e.z, P.x, P.z);
    e.yaw = G.damp(e.yaw, Math.atan2(P.x - e.x, P.z - e.z), 5, dt);
    var want = d > 12 ? 1 : (d < 7 ? -0.6 : 0);
    var spd = 5.6 * want;
    var weave = 2.4 * Math.sin(e.t * 1.1 + e.phase);
    var mx = (Math.sin(e.yaw) * spd + Math.cos(e.yaw) * weave) * dt;
    var mz = (Math.cos(e.yaw) * spd - Math.sin(e.yaw) * weave) * dt;
    var res = G.moveXZ({ x: e.x, z: e.z }, mx, mz, 0.6, 0, 2.4, 0.5);
    e.x = res.x;
    e.z = res.z;
    e.leap -= dt;
    if (e.leap <= 0 && d > 4 && d < 26) { e.leap = G.rand(1.2, 2.6); e.hop = 1; e.hopT = 0; }
    if (e.hop) {
      e.hopT += dt;
      if (e.hopT > 0.45) e.hop = 0;
      else e.grp.position.y = Math.sin(G.clamp(e.hopT / 0.45, 0, 1) * Math.PI) * 1.0;
    } else e.grp.position.y = 0;
    e.grp.position.set(e.x, e.grp.position.y, e.z);
    e.grp.rotation.y = e.yaw;
    var sw = Math.sin(G.state.time * 9 + e.phase) * (want !== 0 ? 0.55 : 0.12);
    e.parts.legL.rotation.x = sw;
    e.parts.legR.rotation.x = -sw;
    e.fireT -= dt;
    if (e.fireT <= 0) {
      e.fireT = G.rand(1.1, 2.0);
      if (d < 44) {
        var clear = G.rayHitXZ(e.x, e.z, P.x - e.x, P.z - e.z, d, e.y + 1.7);
        if (clear >= d - 0.7) shootFire(e, false);
      }
    }
  }

  function updateFlyer(e, dt) {
    var P = G.playerPos;
    if (e.wings) {
      e.wings.wL.rotation.z = 0.45 + Math.sin(G.state.time * 11 + e.flap) * 0.5;
      e.wings.wR.rotation.z = -0.45 - Math.sin(G.state.time * 11 + e.flap) * 0.5;
    }
    if (e.state === 'hover') {
      e.x = e.homeX + Math.sin(G.state.time * 0.6 + e.flap) * 8;
      e.z = e.homeZ + Math.cos(G.state.time * 0.45 + e.flap) * 6;
      e.y = e.homeY + Math.sin(G.state.time * 1.1 + e.flap) * 1.3;
      e.yaw = Math.atan2(P.x - e.x, P.z - e.z);
      e.grp.rotation.y = e.yaw;
      if (e.t > e.delay) {
        e.state = 'dive';
        e.dive = { lock: 0 };
        G.audio.screech({ x: e.x, z: e.z }, e.type === 'boss');
      }
      e.grp.position.set(e.x, e.y, e.z);
      return;
    }
    if (e.state === 'dive') {
      e.dive.lock += dt;
      var dx = P.x - e.x, dy = 0.9 - e.y, dz = P.z - e.z;
      var len = Math.hypot(dx, dy, dz) || 1;
      var sp = (e.type === 'boss' ? 12 : 20) * (1 + Math.min(1.2, e.dive.lock * 1.4));
      e.x += dx / len * sp * dt;
      e.y += dy / len * sp * dt;
      e.z += dz / len * sp * dt;
      e.yaw = Math.atan2(dx, dz);
      e.pitch = -Math.atan2(dy, Math.hypot(dx, dz));
      e.grp.position.set(e.x, e.y, e.z);
      e.grp.rotation.set(-e.pitch, e.yaw, 0);
      if (e.wings) { e.wings.wL.rotation.z = 0.16; e.wings.wR.rotation.z = -0.16; }
      G.fx.spark(e.x, e.y - 0.6 * e.r, e.z, 1.0, 0.3, 0.55 * e.r, 0xff8a3a);
      var near = Math.hypot(e.x - P.x, e.z - P.z);
      if (near < 2.0 + e.r * 0.35 || e.y < 0.9) {
        e.dead = true;
        e.grp.visible = false;
        var dd = G.dist2(e.x, e.z, P.x, P.z);
        G.fx.burstHit(e.x, Math.max(0.5, e.y), e.z, 0, 1, 0, e.type === 'boss');
        if (dd < 9) G.player.hurt(46 * (1 - dd / 9), 'SHOOLLL!', true);
        else G.fx.decal(e.x, 0.08, e.z, 0, 1, 0, 2.6);
      }
      return;
    }
    if (e.state === 'fire') {
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = G.rand(1.4, 2.4);
        shootFire(e, true);
      }
      e.x = e.homeX + Math.sin(G.state.time * 0.4 + e.flap) * 12;
      e.z = e.homeZ + Math.cos(G.state.time * 0.33 + e.flap) * 9;
      e.y = e.homeY + Math.sin(G.state.time * 0.9 + e.flap) * 2.2;
      e.grp.position.set(e.x, e.y, e.z);
      e.yaw = Math.atan2(P.x - e.x, P.z - e.z);
      e.grp.rotation.y = e.yaw;
    }
  }

  E.update = function (dt) {
    for (var i = E.list.length - 1; i >= 0; i--) {
      var e = E.list[i];
      if (e.dead) { E.list.splice(i, 1); continue; }
      e.t += dt;
      if (e.type === 'runner') updateRunner(e, dt);
      else updateFlyer(e, dt);
    }
    updateFire(dt);
    G.state.alive = E.list.length;
  };

  function updateFire(dt) {
    var arr = G.world.projectiles;
    for (var i = arr.length - 1; i >= 0; i--) {
      var p = arr[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      var chest = G.view.height + 0.5;
      var hitPlayer = Math.hypot(p.x - G.playerPos.x, p.z - G.playerPos.z) < p.r + 0.6 &&
        Math.abs(p.y - chest) < 1.2 + p.r;
      if (hitPlayer) {
        G.player.hurt(p.dmg, null, p.big);
        G.fx.spark(p.x, p.y, p.z, 3.5, 0.4, p.big ? 1.2 : 0.35, 0xff9a3a);
        if (p.mesh) G.level.scene.remove(p.mesh);
        arr.splice(i, 1);
        continue;
      }
      var hitWall = p.y < 0.06 || G.rayHitXZ(p.x, p.z, p.vx, p.vz, 1.5, p.y) < 1.4;
      if (hitWall || p.life <= 0) {
        G.fx.spark(p.x, Math.max(0.3, p.y), p.z, 1.8, 0.35, p.big ? 1.0 : 0.3, 0xffc46a);
        if (p.big) G.fx.puff(p.x, Math.max(0.6, p.y), p.z, 1.6, 1.5, 1.6, 0x9a8f80);
        if (p.mesh) G.level.scene.remove(p.mesh);
        arr.splice(i, 1);
        continue;
      }
      if (!p.mesh) {
        p.mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.12, p.r), 10, 8),
          new THREE.MeshBasicMaterial({ color: p.big ? 0xffa040 : 0xffe0a0, fog: false }));
        G.level.scene.add(p.mesh);
      }
      p.mesh.position.set(p.x, p.y, p.z);
      if (p.big) {
        var s2 = 1 + Math.sin(G.state.time * 20) * 0.18;
        p.mesh.scale.set(s2, s2, s2);
        G.fx.spark(p.x, p.y, p.z, 0.6, 0.22, 0.55, 0xffb44a);
      }
    }
  }

  /* ------------------------------------------------------------------ shot by the player */
  E.pickTarget = function (ox, oy, oz, dx, dy, dz, maxD) {
    var best = null, bt = maxD;
    for (var i = 0; i < E.list.length; i++) {
      var e = E.list[i];
      if (e.dead) continue;
      var cy = e.type === 'runner' ? e.y + 1.6 : e.y;
      var ex = e.x - ox, ey = cy - oy, ez = e.z - oz;
      var along = ex * dx + ey * dy + ez * dz;
      if (along < 0 || along > bt) continue;
      var off2 = ex * ex + ey * ey + ez * ez - along * along;
      var rr = (e.r + 0.4) * (e.r + 0.4);
      if (off2 > rr) continue;
      var tHit = along - Math.sqrt(Math.max(0, rr - off2));
      if (tHit < 0.5) continue;
      bt = tHit;
      best = { e: e, t: tHit };
    }
    return best;
  };

  E.takeHit = function (hit) {
    var e = hit.e;
    e.hits -= 1;
    var big = e.type === 'boss';
    G.fx.spark(hit.x, hit.y, hit.z, 3.0, 0.35, 0.7, 0xffd27a);
    if (e.hits <= 0) {
      e.dead = true;
      if (e.grp) e.grp.visible = false;
      G.fx.burstHit(e.x, e.y, e.z, 0, 1, 0, big);
      G.fx.burst(e.x, e.y, e.z, big ? 90 : 28);
      G.state.score += e.score;
      G.state.combo++;
      G.state.comboT = 2.6;
      G.player.shake(big ? 1.1 : 0.5);
      G.say(G.pick(['BAM!', 'POW!', 'SPLAT!', 'THUNK!', 'DING!']), 'hit');
      if (big) { G.state.boss = null; G.yell('BOSS DOWN'); }
    } else {
      G.fx.burst(e.x, e.y, e.z, 12);
      G.state.score += 25;
      G.say('HIT! ' + e.hits + ' LEFT', 'hit');
    }
  };

  /* ------------------------------------------------------------------ pools and cleanup */
  G.fx.burst = function (x, y, z, n) {
    for (var i = 0; i < n; i++) G.fx.gib(x, y, z, 8, 0.26, 5.5);
  };
  G.fx.smoke = function (x, y, z, sp, life, size, col) {
    G.fx.puff(x + G.rand(-0.4, 0.4), y, z + G.rand(-0.4, 0.4), sp, life, size, col);
  };

  E.clearAll = function () {
    for (var i = 0; i < E.list.length; i++) {
      var e = E.list[i];
      if (e.grp && e.grp.parent) e.grp.parent.remove(e.grp);
    }
    E.list.length = 0;
    for (var j = 0; j < G.world.projectiles.length; j++) {
      var p = G.world.projectiles[j];
      if (p.mesh) G.level.scene.remove(p.mesh);
    }
    G.world.projectiles.length = 0;
    G.state.boss = null;
  };
})(window.G);
