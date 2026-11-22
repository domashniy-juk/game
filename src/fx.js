/* fx: pooled particles, gibs, tracers, decals, muzzle light, screen shake */
(function (G) {
  'use strict';
  var F = (G.fx = { built: false, scene: null });
  var POOL = { spark: 260, smoke: 130, gib: 240, tracer: 60, decal: 110, shell: 40 };

  F.build = function (scene) {
    F.scene = scene;
    F.p = {}; /* pools of {mesh, live, vel, life...} */

    function mkPool(name, n, factory) {
      var arr = F.p[name] = [];
      for (var i = 0; i < n; i++) {
        var m = factory(i);
        m.visible = false;
        scene.add(m);
        arr.push({ m: m, live: false, life: 0, max: 1, vx: 0, vy: 0, vz: 0, rot: 0, s: 1, kind: 0 });
      }
    }

    /* additive sparks / flame licks */
    mkPool('spark', POOL.spark, function () {
      var mat = new THREE.SpriteMaterial({ map: G.tex.spark, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffffff });
      return new THREE.Sprite(mat);
    });
    /* smoke puffs */
    mkPool('smoke', POOL.smoke, function () {
      var mat = new THREE.SpriteMaterial({ map: G.tex.smoke, blending: THREE.NormalBlending, depthWrite: false, transparent: true, opacity: 0.6, color: 0xbdb6a8 });
      return new THREE.Sprite(mat);
    });
    /* gibs: small meat/metal chunks */
    mkPool('gib', POOL.gib, function (i) {
      var geo = new THREE.BoxGeometry(1, 1, 1);
      var mat = new THREE.MeshPhongMaterial({ color: i % 3 === 0 ? 0x8c1b12 : (i % 3 === 1 ? 0x6a4a2a : 0x9c7a3c), specular: 0x120806, shininess: 8 });
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      return m;
    });
    /* tracers: stretched glowing darts */
    mkPool('tracer', POOL.tracer, function () {
      var geo = new THREE.BoxGeometry(1, 1, 1);
      var mat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      return new THREE.Mesh(geo, mat);
    });
    /* wall / floor decals (scorch, gore) */
    mkPool('decal', POOL.decal, function () {
      var geo = new THREE.PlaneGeometry(1, 1);
      var mat = new THREE.MeshBasicMaterial({ map: G.tex.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, color: 0xffffff });
      return new THREE.Mesh(geo, mat);
    });
    /* ejected brass */
    mkPool('shell', POOL.shell, function () {
      var geo = new THREE.CylinderGeometry(0.022, 0.022, 0.075, 6);
      var mat = new THREE.MeshPhongMaterial({ color: 0xc9a13c, specular: 0x443311, shininess: 60 });
      return new THREE.Mesh(geo, mat);
    });

    /* muzzle light: one only, moved around */
    F.flashLight = new THREE.PointLight(0xffb45a, 0, 26, 2.2);
    scene.add(F.flashLight);
    F.flashPower = 0;

    /* free lists so allocation stays flat */
    for (var k in F.p) F.free(k);
    F.built = true;
  };

  F.free = function (name) {
    var arr = F.p[name];
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      arr[i].live = false;
      arr[i].m.visible = false;
    }
  };
  F.take = function (name) {
    var arr = F.p[name];
    for (var i = 0; i < arr.length; i++) if (!arr[i].live) return arr[i];
    return null;
  };

  /* ------------------------------------------------------------------ emitters */
  F.spark = function (x, y, z, spd, life, size, colour) {
    var o = F.take('spark');
    if (!o) return;
    o.live = true; o.m.visible = true;
    o.m.position.set(x, y, z);
    var a = Math.random() * 6.283, e = Math.random() * Math.PI;
    o.vx = Math.sin(e) * Math.cos(a) * spd;
    o.vy = Math.cos(e) * spd;
    o.vz = Math.sin(e) * Math.sin(a) * spd;
    o.life = o.max = life; o.s = size;
    o.m.material.color.setHex(colour || 0xffffff);
    o.m.scale.set(size, size, 1);
  };

  F.sparks = function (x, y, z, n, spd, life, size, colour) {
    for (var i = 0; i < n; i++) F.spark(x, y, z, spd * (0.4 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8), colour);
  };

  F.puff = function (x, y, z, spd, life, size, grey) {
    var o = F.take('smoke');
    if (!o) return;
    o.live = true; o.m.visible = true;
    o.m.position.set(x, y, z);
    o.vx = G.rand(-spd, spd); o.vy = G.rand(spd * 0.4, spd * 1.6); o.vz = G.rand(-spd, spd);
    o.life = o.max = life; o.s = size;
    o.m.material.opacity = 0.55;
    o.m.material.color.setHex(grey || 0xbdb6a8);
    o.m.scale.set(size, size, 1);
  };

  F.gib = function (x, y, z, spd, size, life) {
    var o = F.take('gib');
    if (!o) return;
    o.live = true; o.m.visible = true;
    o.m.position.set(x, y, z);
    var a = Math.random() * 6.283, e = Math.random() * Math.PI * 0.8;
    o.vx = Math.sin(e) * Math.cos(a) * spd;
    o.vy = Math.abs(Math.cos(e)) * spd * 1.1 + 1;
    o.vz = Math.sin(e) * Math.sin(a) * spd;
    o.life = o.max = life;
    o.s = size * (0.5 + Math.random() * 0.9);
    o.rot = Math.random() * 6.283;
    var sc = o.s;
    o.m.scale.set(sc, sc * (0.6 + Math.random() * 0.8), sc);
  };

  F.tracer = from2to;
  function from2to(x0, y0, z0, x1, y1, z1, life, width) {
    var o = F.take('tracer');
    if (!o) return;
    o.live = true; o.m.visible = true;
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
    var len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    o.m.position.set(mx, my, mz);
    o.m.lookAt(new THREE.Vector3(x1, y1, z1));
    var w = width || 0.028;
    o.m.scale.set(w, w, Math.max(0.4, len));
    o.life = o.max = life;
    o.m.material.opacity = 0.9;
  }

  F.decal = function (x, y, z, nx, ny, nz, size, gore) {
    var o = F.take('decal');
    if (!o) return;
    o.live = true; o.m.visible = true;
    o.m.material.map = gore ? G.tex.gore : G.tex.scorch;
    o.m.material.color.setHex(gore ? 0x8f2a1c : 0x2a2018);
    o.m.material.opacity = gore ? 0.85 : 0.7;
    o.m.position.set(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03);
    o.m.lookAt(new THREE.Vector3(x + nx, y + ny, z + nz));
    o.m.scale.set(size, size, 1);
    o.life = o.max = 60;
    return o;
  };

  F.shell = function (x, y, z, vx, vy, vz) {
    var o = F.take('shell');
    if (!o) return;
    o.live = true; o.m.visible = true;
    o.m.position.set(x, y, z);
    o.vx = vx; o.vy = vy; o.vz = vz;
    o.life = o.max = 22;
    o.rot = Math.random() * 6.283;
    o.s = 1;
  };

  F.flash = function (power) { F.flashPower = Math.max(F.flashPower, power); };

  /* ------------------------------------------------------------------ bursts used by the game */
  F.burstHit = function (x, y, z, nx, ny, nz, hard) {
    F.sparks(x, y, z, hard ? 14 : 7, hard ? 9 : 4, 0.28, 0.16, hard ? 0xffd27a : 0xffa040);
    for (var i = 0; i < (hard ? 3 : 2); i++) F.puff(x, y, z, 0.7, 0.7, 0.6, 0x8f887a);
    F.decal(x, y, z, nx, ny, nz, 0.6 + Math.random() * 0.5, false);
    G.audio.impact({ x: x, z: z }, !hard);
  };
  F.burstGore = function (x, y, z, n, big) {
    for (var i = 0; i < n; i++) F.gib(x, y, z, big ? 11 : 6.5, big ? 0.34 : 0.2, 5 + Math.random() * 3);
    for (var j = 0; j < (big ? 6 : 3); j++) F.puff(x, y + 0.3, z, 1.6, 1.5, 1.6, 0xa79b8c);
    F.decal(x, 0.03, z, 0, 1, 0, 1.6 + (big ? 1.8 : 0), true);
    G.audio.splat({ x: x, z: z });
  };
  F.burstExplode = function (x, y, z, big, sound) {
    F.sparks(x, y, z, big ? 46 : 26, big ? 22 : 13, big ? 0.85 : 0.45, big ? 0.8 : 0.45, 0xffd070);
    for (var i = 0; i < (big ? 10 : 5); i++) F.puff(x, y, z, 2.4, 1.9, big ? 2.6 : 1.4, 0xb8ada0);
    F.gib(x, y, z, big ? 14 : 8, big ? 0.4 : 0.24, 4.5);
    F.flash(big ? 5.5 : 2.4);
    if (sound !== false) G.audio.explosion({ x: x, z: z }, big);
  };
  F.splash = function (x, z) {
    for (var i = 0; i < 12; i++) F.spark(x + G.rand(-0.5, 0.5), 0.1, z + G.rand(-0.5, 0.5), 5, 0.4, 0.14, 0xbfe6ee);
    F.puff(x, 0.4, z, 0.6, 0.7, 1.1, 0x9fc9cf);
  };

  /* ------------------------------------------------------------------ per frame */
  F.update = function (dt) {
    var g = 26, i, o, arr;
    /* sparks & smoke: cheap, no collision */
    for (i = 0; i < F.p.spark.length; i++) {
      o = F.p.spark[i];
      if (!o.live) continue;
      o.life -= dt;
      if (o.life <= 0) { o.live = false; o.m.visible = false; continue; }
      o.m.position.x += o.vx * dt; o.m.position.y += o.vy * dt; o.m.position.z += o.vz * dt;
      o.vy -= g * 0.35 * dt;
      var k = o.life / o.max;
      o.m.scale.set(o.s * k, o.s * k, 1);
      o.m.material.opacity = k;
    }
    for (i = 0; i < F.p.smoke.length; i++) {
      o = F.p.smoke[i];
      if (!o.live) continue;
      o.life -= dt;
      if (o.life <= 0) { o.live = false; o.m.visible = false; continue; }
      o.m.position.x += o.vx * dt; o.m.position.y += o.vy * dt; o.m.position.z += o.vz * dt;
      o.vy *= (1 - 0.6 * dt);
      var kk = 1 - o.life / o.max;
      o.m.scale.set(o.s * (1 + kk * 2.2), o.s * (1 + kk * 2.2), 1);
      o.m.material.opacity = 0.55 * (1 - kk);
    }
    /* gibs, shells: gravity + bounce off the floor */
    function solidBits(name) {
      arr = F.p[name];
      for (i = 0; i < arr.length; i++) {
        o = arr[i];
        if (!o.live) continue;
        o.life -= dt;
        if (o.life <= 0) { o.live = false; o.m.visible = false; continue; }
        o.vy -= g * dt;
        o.m.position.x += o.vx * dt; o.m.position.y += o.vy * dt; o.m.position.z += o.vz * dt;
        if (o.m.position.y < 0.05) {
          var floorY = G.groundAt(o.m.position.x, o.m.position.z, o.m.position.y, 0.4, 4);
          if (o.m.position.y < floorY + 0.05) {
            o.m.position.y = floorY + 0.05;
            o.vy = Math.abs(o.vy) * 0.32; o.vx *= 0.45; o.vz *= 0.45;
            if (Math.abs(o.vy) < 0.6) o.vy = 0;
          }
        }
        o.rot += dt * 12;
        o.m.rotation.set(o.rot, o.rot * 0.7, o.rot * 0.4);
      }
    }
    solidBits('gib');
    solidBits('shell');
    /* tracers fade rather than fall */
    arr = F.p.tracer;
    for (i = 0; i < arr.length; i++) {
      o = arr[i];
      if (!o.live) continue;
      o.life -= dt;
      if (o.life <= 0) { o.live = false; o.m.visible = false; continue; }
      o.m.material.opacity = G.clamp(o.life / o.max, 0, 1) * 0.9;
    }
    /* muzzle light decay */
    F.flashPower = G.damp(F.flashPower, 0, 16, dt);
    F.flashLight.intensity = F.flashPower;
  };

  F.muzzle = function (x, y, z, big) {
    F.flash(big ? 6 : 4.2);
    F.sparks(x, y, z, big ? 12 : 6, big ? 26 : 16, 0.09, big ? 0.5 : 0.3, 0xffe2a0);
  };

  /* camera shake lives in view state so the player code owns the camera */
  G.view.shake = { x: 0, y: 0, z: 0 };
  F.shake = function (amount) {
    G.state.shake = Math.min(1.4, G.state.shake + amount);
  };
})(window.G);
