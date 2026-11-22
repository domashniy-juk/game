/* THE LOCATION.
   Spawn in the COURTYARD -> gate1 -> MAIN HALL (balcony, lift, skylights).
   West: CORRIDOR with the big red switch (it opens a secret stash door).
   East: gateEast -> POOL ROOM. North: gate2 -> BOSS ARENA -> gateFar (exit).

   Inner faces (units):
     courtyard  x[-26,26]   z[45,64]     wall top 13.6
     main hall  x[-30,30] z[-12,45]      ceiling 22
     corridor   x[-49,-30] z[9,30]       ceiling 9
     pool room  x[30,53]  z[-12,26]      ceiling 16
     boss arena x[-34,34] z[-65,-12]     ceiling 15
*/
(function (G) {
  'use strict';
  var L = (G.level = {
    built: false, scene: null, gates: {}, lifts: [], flames: [], lights: [],
    water: null, switch: null, secret: null, pickupSpots: []
  });
  var T = 0.7;
  var matC = {};

  function PM(col, tag) {
    var ck = 'c' + col + (tag || '');
    if (matC[ck]) return matC[ck];
    matC[ck] = new THREE.MeshPhongMaterial({ color: col, specular: 0x1e1208, shininess: 8 });
    return matC[ck];
  }
  function MT(key, rx, ry, tint) {
    var ck = 't' + key + rx + 'x' + ry + (tint || 0xffffff);
    if (matC[ck]) return matC[ck];
    matC[ck] = new THREE.MeshPhongMaterial({
      map: G.textures.tiled(key, rx, ry),
      color: tint === undefined ? 0xffffff : tint,
      specular: 0x1c1206, shininess: 7
    });
    return matC[ck];
  }
  function addC(x0, x1, y0, y1, z0, z1, mover) {
    G.world.colliders.push({
      min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, solid: true, mover: !!mover
    });
  }
  /* B(sc, x0,x1,y0,y1,z0,z1, key, tint, noCol, noShadow) */
  function B(sc, x0, x1, y0, y1, z0, z1, key, tint, noCol, noShadow) {
    var w = Math.max(0.02, x1 - x0), h = Math.max(0.02, y1 - y0), d = Math.max(0.02, z1 - z0);
    var mat = key ? MT(key, Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(Math.max(h, d) / 4)), tint)
      : PM(tint === undefined ? 0xb2a68f : tint);
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = !noShadow;
    m.receiveShadow = true;
    sc.add(m);
    if (!noCol) addC(x0, x1, y0, y1, z0, z1, false);
    return m;
  }
  /* CYL(sc, x, z, y0, h, r, key, tint, noCol) */
  function CYL(sc, x, z, y0, h, r, key, tint, noCol) {
    var mat = key ? MT(key, 2, Math.max(1, Math.round(h / 4)), tint) : PM(tint === undefined ? 0xb2a68f : tint);
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 12), mat);
    m.position.set(x, y0 + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    sc.add(m);
    if (!noCol) addC(x - r, x + r, y0, y0 + h, z - r, z + r, false);
    return m;
  }
  function ART(sc, w, h, key, x, y, z, yaw) {
    var ck = 'a' + key;
    if (!matC[ck]) matC[ck] = new THREE.MeshBasicMaterial({ map: G.tex[key], transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matC[ck]);
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    sc.add(m);
  }
  function FL(sc, x, y, z, s, withLight, col) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ map: G.tex.flame, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, y, z);
    sc.add(m);
    var f = { m: m, x: x, y: y, z: z, s: s, ph: Math.random() * 6.28, light: null };
    L.flames.push(f);
    if (withLight && L.lights.length < 10) {
      var pl = new THREE.PointLight(col || 0xff9a3a, 1.05, 26, 2.1);
      pl.position.set(x, y, z);
      sc.add(pl);
      L.lights.push(pl);
      f.light = pl;
    }
    return f;
  }
  function LAMP(col, inten, dist, x, y, z) {
    if (L.lights.length >= 10) return null;
    var pl = new THREE.PointLight(col, inten, dist, 2.1);
    pl.position.set(x, y, z);
    L.scene.add(pl);
    L.lights.push(pl);
    return pl;
  }
  /* things that move per frame */
  L.update = function (dt) {
    if (!L.gateArr) {
      L.gateArr = [];
      for (var gk in L.gates) L.gateArr.push(L.gates[gk]);
    }
    for (var i = 0; i < L.gateArr.length; i++) {
      var g = L.gateArr[i];
      if (g.f === g.target) continue;
      g.f += (g.target > g.f ? 1 : -1) * Math.min(1, dt * 0.9);
      if (Math.abs(g.target - g.f) < 0.02) g.f = g.target;
      g.snd -= dt;
      if (g.snd <= 0) {
        G.audio.mech({ x: (g.x0 + g.x1) / 2, z: (g.z0 + g.z1) / 2 }, true);
        g.snd = 0.9;
      }
      moveGate(g);
    }
    /* the service lift: up with a passenger, back down when empty */
    for (var j = 0; j < L.lifts.length; j++) {
      var lf = L.lifts[j], P = G.playerPos;
      var riding = P.x > lf.x0 - 0.3 && P.x < lf.x1 + 0.3 && P.z > lf.z0 - 0.3 && P.z < lf.z1 + 0.3 && P.z < lf.z1 + 0.3 &&
        Math.abs(P.y - lf.col.max.y) < 0.45;
      var want = riding ? lf.yTop : 0;
      if (Math.abs(want - lf.y) > 0.004) {
        lf.y += (want > lf.y ? 1 : -1) * Math.min(Math.abs(want - lf.y), dt * 1.9);
        lf.mesh.position.y = lf.y - 0.225;
        lf.rail.position.y = lf.y + 0.575;
        lf.col.min.y = lf.y - 0.45;
        lf.col.max.y = lf.y;
        lf.snd -= dt;
        if (lf.snd <= 0) {
          G.audio.mech({ x: (lf.x0 + lf.x1) / 2, z: (lf.z0 + lf.z1) / 2 }, false);
          lf.snd = 0.8;
        }
      }
      if (riding) G.playerPos.y = lf.y;
    }
    /* water drifts, sun shafts breathe, braziers flicker */
    if (L.water) {
      L.water.tex.offset.x += dt * 0.05;
      L.water.tex.offset.y -= dt * 0.035;
      L.water.m.material.opacity = 0.68 + 0.05 * Math.sin(G.state.time * 1.4);
    }
    for (var bi = 0; bi < (L.beams || []).length; bi++) {
      L.beams[bi].material.opacity = 0.055 + 0.03 * Math.sin(G.state.time * 0.6 + bi);
    }
    for (var fi = 0; fi < L.flames.length; fi++) {
      var f = L.flames[fi];
      var s = 0.9 + 0.18 * Math.sin(G.state.time * 11 + f.ph) + 0.05 * Math.random();
      f.m.scale.set(s, s * (0.94 + 0.12 * Math.sin(G.state.time * 7 + f.ph)), 1);
      if (f.light) f.light.intensity = 0.8 + 0.35 * Math.sin(G.state.time * 9 + f.ph * 2);
    }
    if (L.switch) {
      var pulse = L.switch.on ? 0.55 : 0.14 + 0.08 * Math.sin(G.state.time * 3);
      L.switch.but.emissive.setRGB(pulse, pulse * 0.05, 0);
      L.switch.ring.emissive.setRGB(L.switch.on ? 0.4 : 0, L.switch.on ? 0.3 : 0, 0);
    }
  };
  L.reset = function () {
    if (!L.gateArr) {
      L.gateArr = [];
      for (var gk2 in L.gates) L.gateArr.push(L.gates[gk2]);
    }
    for (var a = 0; a < L.gateArr.length; a++) {
      var gg = L.gateArr[a];
      gg.f = gg.target = gg.startOpen ? 0 : 1;
      moveGate(gg);
    }
    for (var lj = 0; lj < L.lifts.length; lj++) {
      var lp = L.lifts[lj];
      lp.y = 0;
      lp.mesh.position.y = -0.225;
      lp.rail.position.y = 0.575;
      lp.col.min.y = -0.45;
      lp.col.max.y = 0;
    }
    if (L.switch) {
      L.switch.on = false;
      L.switch.but.color.setHex(0xa01c10);
      L.switch.but.emissive.setRGB(0.1, 0, 0);
      L.switch.ring.color.setHex(0xc9a13b);
      L.switch.ring.emissive.setRGB(0, 0, 0);
    }
  };
  /* is the big switch in reach and under the crosshair? */
  L.aimedSwitch = function () {
    if (!L.switch) return false;
    var dx = L.switch.x - G.playerPos.x;
    var dy = L.switch.y - (G.playerPos.y + G.view.height);
    var dz = L.switch.z - G.playerPos.z;
    var len = Math.hypot(dx, dy, dz);
    if (len > 4.5) return false;
    var V = G.view;
    var cp = Math.cos(V.pitch), sp = Math.sin(V.pitch);
    var fx = -Math.sin(V.yaw) * cp, fy = sp, fz = -Math.cos(V.yaw) * cp;
    return (dx * fx + dy * fy + dz * fz) / len > 0.92;
  };

  /* gate: f=1 closed, f=0 dropped; the collider slides with it */
  function GATE(name, x0, x1, z0, z1, h, startOpen, tint, spikes) {
    var m = B(L.scene, x0, x1, 0, h, z0, z1, 'metal', tint, true, true);
    var col = { min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: h, z: z1 }, solid: true, mover: true };
    G.world.colliders.push(col);
    if (spikes) {
      var n = Math.max(3, Math.round(Math.max(x1 - x0, z1 - z0) / 1.7));
      var wide = (x1 - x0) >= (z1 - z0);
      for (var i = 0; i < n; i++) {
        var k = (i + 0.5) / n;
        var px = wide ? x0 + (x1 - x0) * k : (x0 + x1) / 2;
        var q = wide ? (z0 + z1) / 2 : z0 + (z1 - z0) * k;
        var sp = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.85, 5), PM(0x8a8274));
        sp.position.set(wide ? m.position.x - (x1 - x0) / 2 + (x1 - x0) * k : 0, -h - 0.42, 0);
        if (wide) sp.position.x = -(x1 - x0) / 2 + (x1 - x0) * k;
        else sp.position.z = -(z1 - z0) / 2 + (z1 - z0) * k;
        sp.rotation.x = Math.PI;
        m.add(sp);
      }
    }
    var g = { name: name, mesh: m, col: col, h: h, f: startOpen ? 0 : 1, target: startOpen ? 0 : 1, snd: 0 };
    moveGate(g);
    L.gates[name] = g;
    return g;
  }
  function moveGate(g) {
    g.mesh.position.y = g.h * (1 - g.f) + g.h / 2;
    g.col.min.y = g.h * (1 - g.f);
    g.col.max.y = g.h * (2 - g.f);
  }
  L.setGate = function (name, open) {
    var g = L.gates[name];
    if (g) g.target = open ? 0 : 1;
  };
  /* lift: platform that rises when ridden */
  function LIFT(name, x0, x1, z0, z1, yTop) {
    var m = B(L.scene, x0, x1, -0.45, 0, z0, z1, 'metal', 0x8d8578, true, true);
    var col = { min: { x: x0, y: -0.45, z: z0 }, max: { x: x1, y: 0, z: z1 }, solid: true, mover: true };
    G.world.colliders.push(col);
    var rail = B(L.scene, x0, x1, 0, 1.15, z1 - 0.2, z1, 'metal', 0x6f6a5e, true, false);
    L.lifts.push({ name: name, mesh: m, rail: rail, col: col, x0: x0, x1: x1, z0: z0, z1: z1, y: 0, yTop: yTop, snd: 0 });
  }
  function OBL(x, z, h, w, tint) {
    var sc = L.scene;
    B(sc, x - w, x + w, 0, 1.2, z - w, z + w, 'obelisk', tint);
    B(sc, x - w * 0.6, x + w * 0.6, 1.2, h - 1.5, z - w * 0.6, z + w * 0.6, 'obelisk');
    B(sc, x - w * 0.8, x + w * 0.8, h - 1.5, h - 0.7, z - w * 0.8, z + w * 0.8, 'obelisk', tint);
    var cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, 1.5, 4), PM(0xc9a13b));
    cap.position.set(x, h - 0.05, z);
    cap.rotation.y = Math.PI / 4;
    sc.add(cap);
  }
  function BRAZ(x, z, yb, s, big) {
    var sc = L.scene;
    CYL(sc, x, z, yb, 0.9 * s, 1.4 * s, 'metal', 0x6a6455, true);
    CYL(sc, x, z, yb + 0.9 * s, 0.9 * s, 0.8 * s, 'metal', 0x5f5a4c, true);
    B(sc, x - 1.5 * s, x + 1.5 * s, yb + 1.8 * s, yb + 2.5 * s, z - 1.5 * s, z + 1.5 * s, 'metal', 0x77705f, true, false);
    FL(sc, x, yb + 2.9 * s, z, (big ? 2.8 : 1.8) * s, true, 0xff9a3a);
  }
  function STATUE(x, z, yaw) {
    var sc = L.scene;
    B(sc, x - 3.2, x + 3.2, 0, 2.4, z - 2.2, z + 2.2, 'obelisk', 0xa9996f);
    B(sc, x - 2.3, x + 2.3, 2.4, 7.0, z - 1.8, z + 1.8, 'obelisk', 0xb4a377);
    B(sc, x - 1.5, x + 1.5, 7.0, 10.0, z - 1.5, z + 1.5, 'obelisk', 0xb9a87c);
    B(sc, x - 0.8, x + 0.8, 7.6, 10.0, z + 1.5, z + 2.5, 'obelisk', 0x9b8b63);
    var crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 6), PM(0xc9a13b));
    crown.position.set(x, 11.2, z);
    sc.add(crown);
    addC(x - 3.2, x + 3.2, 0, 11.5, z - 2.2, z + 2.2, false);
  }
  function THRONE(x, z) {
    var sc = L.scene;
    B(sc, x - 4.0, x + 4.0, 0, 1.4, z - 2.6, z + 2.6, 'marble', 0xc8bda0);
    B(sc, x - 2.8, x + 2.8, 1.4, 2.8, z - 2.0, z + 2.0, 'marble', 0xd2c6aa);
    B(sc, x - 2.8, x + 2.8, 2.8, 8.4, z - 2.4, z - 1.6, 'marble', 0xbfae90);
    B(sc, x - 1.4, x + 1.4, 8.4, 9.6, z - 1.2, z + 1.2, 'metal', 0xc9a13b, true, false);
    FL(sc, x - 3.2, 4.0, z - 1.0, 1.6, true, 0xffb04a);
    FL(sc, x + 3.2, 4.0, z - 1.0, 1.6, false);
  }
  function RUB(sc, x0, x1, z0, z1, n, seed) {
    var r = G.rng(seed);
    for (var i = 0; i < n; i++) {
      var x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      B(sc, x, x + 0.4 + r() * 1.5, 0, 0.12 + r() * 0.5, z, z + 0.4 + r() * 1.5, 'wallRough', 0xa2946f, true, false);
    }
  }
  function SWITCH(x, y, z, yaw) {
    var sc = L.scene;
    var plate = B(sc, x - 0.34, x + 0.34, y - 1.2, y + 1.2, z - 1.1, z + 1.1, 'metal', 0x6f6a5e, true, false);
    var butMat = new THREE.MeshPhongMaterial({ color: 0xa01c10, emissive: 0x1a0200, shininess: 26 });
    var but = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.4, 16), butMat);
    but.rotation.z = Math.PI / 2;
    but.position.set(x - 0.4, y + 1.2, z);
    but.castShadow = true;
    sc.add(but);
    var ringMat = new THREE.MeshPhongMaterial({ color: 0xc9a13b, emissive: 0x000000, shininess: 40 });
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.1, 8, 20), ringMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x - 0.36, y + 1.2, z);
    sc.add(ring);
    L.switch = { x: x - 0.4, y: y + 1.2, z: z, but: butMat, ring: ringMat, mesh: but, plate: plate, on: false };
    G.world.switches.push(L.switch);
  }

  /* ================================================================== BUILD */
  L.build = function (scene) {
    L.scene = scene;
    var sc = scene;

    /* ---------- COURTYARD (spawn) ---------- */
    B(sc, -27, 27, -0.4, 0, 45, 65, 'floor', 0xd6c29c);
    B(sc, -26.7, -7, 0, 13.6, 45, 45 + T, 'wall', 0xa08a63);
    B(sc, 7, 26.7, 0, 13.6, 45, 45 + T, 'wall', 0xa08a63);
    B(sc, -7, 7, 11, 13.6, 45, 45 + T, 'wall', 0x9a8460);
    B(sc, -26.7, -26, 0, 13.6, 45, 64.7, 'wall', 0xa08a63);
    B(sc, 26, 26.7, 0, 13.6, 45, 64.7, 'wall', 0xa08a63);
    B(sc, -26.7, -7, 0, 13.6, 64, 64 + T, 'wall', 0xa08a63);
    B(sc, 7, 26.7, 0, 13.6, 64, 64 + T, 'wall', 0xa08a63);
    B(sc, -7, 7, 11, 13.6, 64, 64 + T, 'wall', 0x9a8460);
    GATE('gate1', -7, 7, 45.05, 45.65, 11, true, 0x8f8878, false);
    GATE('gateExit', -7, 7, 64.05, 64.65, 11, true, 0x8f8878, true);
    OBL(-14, 50, 14, 2.6, 0xb09a72);
    OBL(14, 50, 14, 2.6, 0xb09a72);
    BRAZ(-21, 47.5, 0, 1.0, false);
    BRAZ(21, 47.5, 0, 1.0, false);
    ART(sc, 14, 9, 'mural', -12, 6, 63.85, 0);
    ART(sc, 10, 8, 'muralBlue', 25.85, 6, 55, -Math.PI / 2);
    CYL(sc, 19, 60, 0, 12, 1.4, 'pillar', 0xbcae92);
    RUB(sc, -24, 24, 46, 63, 10, 71);

    /* ---------- MAIN HALL ---------- */
    B(sc, -30.7, 30.7, -0.4, 0, -12.7, 45, 'floor', 0xc2b08e);
    /* west wall with the corridor mouth at z[22,26] */
    B(sc, -30.7, -30, 0, 22, -12.7, 22, 'wall', 0xa8946c);
    B(sc, -30.7, -30, 0, 22, 26, 45, 'wall', 0xa8946c);
    B(sc, -30.7, -30, 9, 22, 22, 26, 'wall', 0x9a8460);
    /* east wall with the pool gate at z[16,26] */
    B(sc, 30, 30.7, 0, 22, -12.7, 16, 'wall', 0xa8946c);
    B(sc, 30, 30.7, 0, 22, 26, 45, 'wall', 0xa8946c);
    B(sc, 30, 30.7, 11, 22, 16, 26, 'wall', 0x9a8460);
    GATE('gateEast', 30.05, 30.65, 16, 26, 11, true, 0x8f8f88, false);
    /* north wall with gate2 */
    B(sc, -30.7, -6, 0, 22, -12.7, -12, 'wall', 0xa8946c);
    B(sc, 6, 30.7, 0, 22, -12.7, -12, 'wall', 0xa8946c);
    B(sc, -6, 6, 13, 22, -12.7, -12, 'wall', 0x9a8460);
    GATE('gate2', -6, 6, -12.65, -12.05, 13, false, 0x8f8878, true);
    /* roof, two skylight holes: x[-5,5]z[-4,4] and x[8,20]z[12,20] */
    B(sc, -30.7, 30.7, 22, 23.2, -12.7, -4, 'wallDark', 0x8e7a58, true);
    B(sc, -30.7, -5, 22, 23.2, -4, 4, 'wallDark', 0x8e7a58, true);
    B(sc, 5, 30.7, 22, 23.2, -4, 4, 'wallDark', 0x8e7a58, true);
    B(sc, -30.7, 30.7, 22, 23.2, 4, 12, 'wallDark', 0x8e7a58, true);
    B(sc, -30.7, 8, 22, 23.2, 12, 20, 'wallDark', 0x8e7a58, true);
    B(sc, 20, 30.7, 22, 23.2, 12, 20, 'wallDark', 0x8e7a58, true);
    B(sc, -30.7, 30.7, 22, 23.2, 20, 45, 'wallDark', 0x8e7a58, true);
    /* pillar rows */
    for (var pi = 0; pi < 2; pi++) {
      for (var pj = 0; pj < 4; pj++) {
        var ppx = pi === 0 ? -15 : 15, ppz = -4 + pj * 12;
        B(sc, ppx - 1.9, ppx + 1.9, 0, 1.3, ppz - 1.9, ppz + 1.9, 'obelisk', 0xb09a72);
        CYL(sc, ppx, ppz, 1.3, 18, 1.25, 'pillar', 0xbba47c);
        B(sc, ppx - 2.0, ppx + 2.0, 19.3, 21.6, ppz - 2.0, ppz + 2.0, 'obelisk', 0xb09a72);
      }
    }
    /* balcony + rail + stairs up to it */
    B(sc, -30, -24.5, 7, 7.6, -12.7, 45, 'obelisk', 0xb09a72);
    B(sc, -25, -24.5, 7.6, 9.0, -12.7, 45, 'obelisk', 0xa2946f, true, false);
    B(sc, -29.5, -24.5, 0, 1.9, -12.7, -8.5, 'obelisk', 0xa8946c);
    B(sc, -28.0, -24.5, 1.9, 3.8, -12.7, -10.0, 'obelisk', 0xa8946c);
    B(sc, -26.6, -24.5, 3.8, 5.7, -12.7, -11.0, 'obelisk', 0xa8946c);
    B(sc, -25.4, -24.5, 5.7, 7.6, -12.7, -12.0, 'obelisk', 0xa8946c);
    LIFT('liftA', -34.6, -30.05, 22.4, 25.6, 7.6);
    /* dais with the bronze door plaque */
    B(sc, -9, 9, 0, 1.2, 36, 45, 'marble', 0xd0c4a8);
    B(sc, -9, 9, 1.2, 1.6, 36, 45, 'marble', 0xc0b494);
    ART(sc, 6, 2.2, 'mural', 0, 1.9, 35.9, 0);
    BRAZ(-7, 38, 1.6, 1.0, false);
    BRAZ(7, 38, 1.6, 1.0, false);
    STATUE(-13, -4, 0);
    STATUE(13, -4, Math.PI);
    ART(sc, 17, 11, 'muralBlue', -29.85, 12, 6, Math.PI / 2);
    ART(sc, 15, 10, 'mural', -29.85, 12, 36, Math.PI / 2);
    ART(sc, 15, 10, 'mural', 29.85, 12, -2, -Math.PI / 2);
    LAMP(0xffd9a8, 1.2, 30, 0, 14, 16);
    LAMP(0xffc07a, 0.9, 24, 0, 12, -2);

    /* ---------- CORRIDOR ---------- */
    B(sc, -49.7, -30, -0.4, 0, 9, 30.7, 'wallDark', 0x8d7a56);
    B(sc, -49.7, -49, 0, 9, 9, 14, 'wall', 0x8f7c58);
    B(sc, -49.7, -49, 0, 9, 20, 30.7, 'wall', 0x8f7c58);
    B(sc, -49.7, -49, 6.6, 9, 14, 20, 'wall', 0x83714f);
    GATE('secret', -49.55, -49.0, 14, 20, 6.6, false, 0x8a7a52, false);
    B(sc, -49.7, -30, 0, 9, 30, 30.7, 'wall', 0x8f7c58);
    B(sc, -49.7, -30, 9, 10, 9, 14, 'wallDark', 0x86734f, true);
    B(sc, -49.7, -30, 9, 10, 16, 22, 'wallDark', 0x86734f, true);
    B(sc, -49.7, -30, 9, 10, 24, 30.7, 'wallDark', 0x86734f, true);
    SWITCH(-48.65, 1.8, 24, 0);
    BRAZ(-46, 11, 0, 0.9, false);
    BRAZ(-34, 28, 0, 0.9, false);
    CYL(sc, -40, 12, 0, 8, 1.1, 'pillar', 0xa89a76);
    RUB(sc, -48, -31, 9.5, 30, 8, 33);
    LAMP(0xffb46a, 0.85, 18, -40, 5.5, 20);

    /* ---------- POOL ROOM ---------- */
    B(sc, 30, 53.7, -0.4, 0, -12.7, -6, 'marble', 0xd0c6ac);
    B(sc, 30, 34, -0.4, 0, -6, 14, 'marble', 0xd0c6ac);
    B(sc, 48, 53.7, -0.4, 0, -6, 14, 'marble', 0xd0c6ac);
    B(sc, 30, 53.7, -0.4, 0, 14, 26.7, 'marble', 0xd0c6ac);
    B(sc, 34, 48, -2, -1.55, -6, 14, 'marbleBlue', 0x9fb3c6);
    B(sc, 34, 34.6, -2, 0.05, -6, 14, 'marble', 0xcdc2a8);
    B(sc, 47.4, 48, -2, 0.05, -6, 14, 'marble', 0xcdc2a8);
    B(sc, 34, 48, -2, 0.05, -6, -5.4, 'marble', 0xcdc2a8);
    B(sc, 34, 48, -2, 0.05, 13.4, 14, 'marble', 0xcdc2a8);
    B(sc, 53, 53.7, 0, 16, -12.7, 26.7, 'wall', 0xb8a884);
    B(sc, 30, 53.7, 0, 16, -12.7, -12, 'wall', 0xb8a884);
    B(sc, 30, 53.7, 0, 16, 26, 26.7, 'wall', 0xb8a884);
    B(sc, 30, 53.7, 16, 17.2, -12.7, 0, 'wallDark', 0x96855f, true);
    B(sc, 30, 40, 16, 17.2, 0, 8, 'wallDark', 0x96855f, true);
    B(sc, 48, 53.7, 16, 17.2, 0, 8, 'wallDark', 0x96855f, true);
    B(sc, 30, 53.7, 16, 17.2, 8, 26.7, 'wallDark', 0x96855f, true);
    for (var pc = 0; pc < 3; pc++) {
      CYL(sc, 50.5, -4 + pc * 8, 0, 15, 0.95, 'marble', 0xd4c8ae);
      B(sc, 49.4, 51.6, 0, 1.0, -5 + pc * 8, -3 + pc * 8, 'marble', 0xc4b998);
    }
    B(sc, 36, 48, 13.6, 14.8, -2, 4, 'marble', 0xd4c8ae, true, false);
    CYL(sc, 45, 1, 0, 11, 1.0, 'marble', 0xd0c4a8);
    ART(sc, 16, 11, 'muralBlue', 30.85, 8, 18, Math.PI / 2);
    ART(sc, 14, 10, 'mural', 52.85, 8, 6, -Math.PI / 2);
    LAMP(0x9fd8dd, 0.9, 26, 41, 8, 4);

    /* ---------- BOSS ARENA ---------- */
    B(sc, -34.7, 34.7, -0.4, 0, -66, -12, 'floor', 0xbfa97e);
    B(sc, -34.7, -34, 0, 15, -66, -12, 'wall', 0xa8946c);
    B(sc, 34, 34.7, 0, 15, -66, -12, 'wall', 0xa8946c);
    B(sc, -34.7, -7, 0, 15, -66, -65.3, 'wall', 0xa8946c);
    B(sc, 7, 34.7, 0, 15, -66, -65.3, 'wall', 0xa8946c);
    B(sc, -7, 7, 12, 15, -66, -65.3, 'wall', 0x9a8460);
    GATE('gateFar', -7, 7, -65.95, -65.35, 12, false, 0x8f8878, true);
    B(sc, -34.7, 34.7, 15, 16.2, -66, -42, 'wallDark', 0x8e7a58, true);
    B(sc, -34.7, -8, 15, 16.2, -42, -34, 'wallDark', 0x8e7a58, true);
    B(sc, 8, 34.7, 15, 16.2, -42, -34, 'wallDark', 0x8e7a58, true);
    B(sc, -34.7, 34.7, 15, 16.2, -34, -12, 'wallDark', 0x8e7a58, true);
    B(sc, -16, 16, 0, 5.2, -58, -44, 'obelisk', 0xb8a97e);
    B(sc, -22, -16, 0, 1.7, -48, -44, 'obelisk', 0xac9e78);
    B(sc, -19, -16, 1.7, 3.4, -48, -45.5, 'obelisk', 0xac9e78);
    B(sc, -17.5, -16, 3.4, 5.2, -48, -46.5, 'obelisk', 0xa8946c);
    THRONE(0, -52);
    BRAZ(-10, -30, 0, 1.5, true);
    BRAZ(10, -30, 0, 1.5, true);
    BRAZ(0, -44, 0, 1.2, false);
    OBL(-24, -22, 14, 2.4, 0xb09a72);
    OBL(24, -22, 14, 2.4, 0xb09a72);
    OBL(-28, -58, 13, 2.2, 0xb09a72);
    OBL(28, -58, 13, 2.2, 0xb09a72);
    STATUE(-16, -20, 0);
    STATUE(16, -20, Math.PI);
    RUB(sc, -32, 32, -64, -14, 14, 99);
    ART(sc, 20, 12, 'mural', -34.85, 8, -40, Math.PI / 2);
    ART(sc, 18, 11, 'muralBlue', 34.85, 8, -46, -Math.PI / 2);
    LAMP(0xffc07a, 1.0, 34, 0, 10, -38);

    /* ---------- pool water ---------- */
    var wtex = G.textures.tiled('water', 5, 5);
    var wmat = new THREE.MeshPhongMaterial({
      map: wtex, color: 0x8fc9d4, transparent: true, opacity: 0.72,
      shininess: 80, specular: 0xdff6ff
    });
    var wmesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 20), wmat);
    wmesh.rotation.x = -Math.PI / 2;
    wmesh.position.set(41, -1.05, 4);
    wmesh.receiveShadow = false;
    sc.add(wmesh);
    L.water = { m: wmesh, tex: wtex };

    /* ---------- sun shafts ---------- */
    L.beams = [];
    function sunBeam(x, z, w, d, y1, yaw) {
      var bm = new THREE.Mesh(new THREE.BoxGeometry(w, y1, d),
        new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false }));
      bm.position.set(x, y1 / 2, z);
      bm.rotation.y = yaw;
      sc.add(bm);
      L.beams.push(bm);
    }
    sunBeam(0, 0, 10, 8, 22, 0.15);
    sunBeam(14, 16, 12, 8, 22, -0.2);
    sunBeam(44, 4, 8, 8, 16, 0.1);
    sunBeam(0, -38, 16, 8, 15, 0.05);

    /* ---------- pickup spots (meshes built by main.js) ---------- */
    L.pickupSpots = [
      { x: -4, y: 0.55, z: 50, kind: 'med' },
      { x: 4, y: 0.55, z: 50, kind: 'ammo' },
      { x: -27, y: 8.15, z: 30, kind: 'med' },
      { x: -40, y: 0.55, z: 27, kind: 'ammo' },
      { x: 41, y: -0.9, z: 4, kind: 'med' },
      { x: 0, y: 5.75, z: -30, kind: 'ammo' },
      { x: -22, y: 0.55, z: -56, kind: 'med' },
      { x: 22, y: 0.55, z: -56, kind: 'ammo' }
    ];
    /* top-down map for the HUD radar (walkable floors) */
    L.map = {
      rooms: [
        { x0: -26, z0: 45, x1: 26, z1: 64, label: 'COURT' },
        { x0: -30, z0: -12, x1: 30, z1: 45, label: 'HALL' },
        { x0: -49, z0: 9, x1: -30, z1: 30, label: 'CORR' },
        { x0: 30, z0: -12, x1: 53, z1: 26, label: 'POOL' },
        { x0: -34, z0: -65, x1: 34, z1: -12, label: 'ARENA' }
      ],
      doors: [
        { x: 0, z: 45.3 },
        { x: 30.3, z: 21 },
        { x: 0, z: -12.3 },
        { x: -49.2, z: 17 }
      ]
    };
    L.built = true;
  };
})(window.G);
