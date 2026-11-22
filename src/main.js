/* the frame: boot, wave logic and the loop that drives every other module */
(function (G) {
  'use strict';
  var M = (G.main = { ready: false });

  /* ------------------------------------------------------------------ hard failure */
  function fail(t) {
    var err = document.getElementById('err');
    if (!err) {
      err = document.createElement('div');
      err.id = 'err';
      document.body.appendChild(err);
    }
    err.textContent = 'BOOT FAILED: ' + t;
    err.style.display = 'block';
  }
  if (!window.THREE) { fail('vendor/three.min.js did not load'); return; }

  var TH = window.THREE;
  var C = G.cfg, st = G.state, W = G.world, L = G.level, E = G.enemies, WP = G.weapon, FX = G.fx, AU = G.audio;

  var renderer = null, scene = null, camera = null, sky = null;
  var menuEl = null, viewCanvas = null, hudCanvas = null;
  var last = 0, frames = 0, fpsT = 0;
  var mdx = 0, mdy = 0;
  var pickupMeshes = [];

  /* state fields other modules expect but core did not declare */
  st.spawned = false;
  st.aimHeld = false;
  st.lock = false;
  st.inputState = st.inputState || G.inputState;
  st.paused = false;
  st.started = false;
  st.deadT = 0;
  if (!G.wrapPi) G.wrapPi = G.wrapPI; /* core spells it wrapPI, player.js calls G.wrapPi */
  st.mousePitch = false;

  /* ------------------------------------------------------------------ waves */
  /* stepping into a zone arms its wave and slams the gate behind you */
  G.waves = [
    { zone: { x0: -25, z0: 46, x1: 25, z1: 63 },
      spawn: [
        { t: 'runner', x: -12, y: 0, z: 56, d: 0.4 },
        { t: 'runner', x: 14, y: 0, z: 58, d: 1.3 },
        { t: 'flyer', x: -4, y: 11, z: 50, d: 1.2 },
        { t: 'flyer', x: 10, y: 10, z: 60, d: 2.1 }
      ],
      arm: function () { L.setGate('gate1', false); L.setGate('gateExit', false); },
      clear: function () { L.setGate('gate1', true); G.say('THE GATE DROPS', 'yell'); } },
    { zone: { x0: -28, z0: -10, x1: 28, z1: 42 },
      spawn: [
        { t: 'runner', x: -18, y: 0, z: 30, d: 0.3 },
        { t: 'runner', x: 16, y: 0, z: 22, d: 1.1 },
        { t: 'runner', x: 2, y: 0, z: -4, d: 1.9 },
        { t: 'flyer', x: -8, y: 16, z: 12, d: 1.0 },
        { t: 'flyer', x: 12, y: 15, z: 26, d: 2.4 }
      ],
      arm: function () { L.setGate('gate1', false); },
      clear: function () { L.setGate('gateEast', true); L.setGate('gate2', true); G.say('BOTH EXITS OPEN', 'yell'); } },
    { zone: { x0: 31, z0: -11, x1: 52, z1: 25 },
      spawn: [
        { t: 'runner', x: 46, y: 0, z: 20, d: 0.4 },
        { t: 'flyer', x: 38, y: 7, z: 14, d: 0.8 },
        { t: 'flyer', x: 47, y: 9, z: 2, d: 1.5 },
        { t: 'flyer', x: 34, y: 8, z: 22, d: 2.2 }
      ],
      arm: function () { L.setGate('gateEast', false); },
      clear: function () { L.setGate('gateEast', true); G.say('POOL ROOM CLEARED', 'yell'); } },
    { zone: { x0: -32, z0: -63, x1: 32, z1: -14 },
      spawn: [
        { t: 'runner', x: -16, y: 0, z: -30, d: 0.4 },
        { t: 'runner', x: 14, y: 0, z: -24, d: 1.2 },
        { t: 'flyer', x: -20, y: 9, z: -20, d: 1.5 },
        { t: 'boss', x: 0, y: 14, z: -44, d: 1.0 }
      ],
      arm: function () { L.setGate('gate2', false); },
      clear: function () {
        L.setGate('gate2', true);
        st.cleared = true;
        st.win = true;
        L.setGate('gateFar', true); /* the far door: the way out once the boss goes down */
        AU.mech({ x: G.playerPos.x, z: G.playerPos.z }, true);
        G.say('THE HORDE IS DOWN', 'yell');
        G.say('THE FAR DOOR STANDS OPEN', 'sys');
      } }
  ];
  var armedFlag = [false, false, false, false];
  var clearedFlag = [false, false, false, false];

  function armWave(i) {
    G.waves[i].arm();
    E.spawnWave(i);
    G.state.spawned = true;
    G.say('THE GATE SLAMS BEHIND YOU', 'yell');
    AU.mech({ x: G.playerPos.x, z: G.playerPos.z }, true);
  }

  function checkWaves() {
    if (st.cleared || st.gameOver) return;
    var p = G.playerPos;
    /* did the current room just empty out? */
    var empty = E.list.length === 0 && W.projectiles.length === 0;
    for (var i = 0; i < G.waves.length; i++) {
      if (armedFlag[i] && !clearedFlag[i] && empty) {
        clearedFlag[i] = true;
        G.waves[i].clear();
      }
    }
    /* entering a new zone (with everything before it cleared) arms it */
    for (i = 0; i < G.waves.length; i++) {
      if (armedFlag[i]) continue;
      if (i > 0 && !clearedFlag[i - 1]) continue;
      var z = G.waves[i].zone;
      if (p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1) {
        armedFlag[i] = true;
        G.state.wave = i;
        armWave(i);
        return;
      }
    }
  }

  /* ------------------------------------------------------------------ pickups */
  function buildPickups() {
    for (var i = 0; i < pickupMeshes.length; i++) scene.remove(pickupMeshes[i]);
    pickupMeshes.length = 0;
    W.pickups.length = 0;
    var spots = L.pickupSpots || [];
    for (i = 0; i < spots.length; i++) {
      var s = spots[i];
      var grp = new TH.Group();
      var box = new TH.Mesh(new TH.BoxGeometry(0.8, 0.5, 0.5),
        new TH.MeshPhongMaterial({ color: 0x8c7a4a, specular: 0x2a2418, shininess: 24 }));
      box.position.y = 0.25;
      box.castShadow = true;
      grp.add(box);
      if (s.kind === 'med') {
        var cm = new TH.MeshPhongMaterial({ color: 0xffffff, emissive: 0x222222 });
        var bar1 = new TH.Mesh(new TH.BoxGeometry(0.5, 0.08, 0.16), cm);
        var bar2 = new TH.Mesh(new TH.BoxGeometry(0.16, 0.08, 0.5), cm);
        bar1.position.y = 0.54;
        bar2.position.y = 0.54;
        grp.add(bar1);
        grp.add(bar2);
      }
      grp.position.set(s.x, s.y, s.z);
      scene.add(grp);
      pickupMeshes.push(grp);
      W.pickups.push({ x: s.x, y: s.y, z: s.z, kind: s.kind, taken: false, ph: i * 1.3 });
    }
  }

  function tickPickups(dt) {
    for (var i = 0; i < W.pickups.length; i++) {
      var pu = W.pickups[i];
      if (pu.taken) continue;
      pu.ph += dt;
      var mesh = pickupMeshes[i];
      if (mesh) {
        mesh.rotation.y = pu.ph * 1.4;
        mesh.position.y = pu.y + Math.sin(pu.ph * 2.4) * 0.12;
      }
      var dx = G.playerPos.x - pu.x, dz = G.playerPos.z - pu.z;
      if (dz * dz + dx * dx < 1.69 && Math.abs((G.playerPos.y + 1.1) - pu.y) < 2.2) {
        pu.taken = true;
        if (mesh) scene.remove(mesh);
        AU.coin();
        if (pu.kind === 'med') {
          G.player.heal('med');
          G.say('MED PACK: JUICE UP', 'yell');
        } else {
          st.spare = Math.min(9, st.spare + 1);
          G.say('SPARE LINK: ' + Math.round(st.spare), 'sys');
        }
      }
    }
  }

  /* ------------------------------------------------------------------ start / restart */
  function beginRun() {
    G.reset();
    G.level.reset();
    G.player.reset();
    E.clearAll();
    buildPickups();
    for (var fk in FX.p) FX.free(fk);
    hideMenu();
    armedFlag = [false, false, false, false];
    clearedFlag = [false, false, false, false];
    st.paused = false;
    st.deadT = 0;
    st.started = true;
    st.phase = 'play';
    AU.init();
    AU.ambient();
    armedFlag[0] = true;
    armWave(0);
  }
  G.beginRun = beginRun;

  function showMenu(t) {
    st.phase = 'menu';
    menuEl.classList.remove('hidden');
    var cta = menuEl.querySelector('.cta');
    if (cta) cta.textContent = t || 'CLICK HERE TO PLAY AGAIN';
  }
  function hideMenu() {
    menuEl.classList.add('hidden');
  }

  G.toggleMute = function () {
    st.muted = !st.muted;
    AU.setMuted(st.muted);
    G.say(st.muted ? 'SILENT FILM' : 'THE GUN SINGS AGAIN', 'sys');
  };

  /* pointer lock can be refused (no gesture, iframe rules); never let it throw */
  function grabMouse() {
    try {
      var p = viewCanvas.requestPointerLock();
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* the next click will try again */ }
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    menuEl = document.getElementById('menu');
    viewCanvas = document.getElementById('view');
    hudCanvas = document.getElementById('hud');
    if (!viewCanvas || !hudCanvas) { fail('missing canvas elements'); return; }

    renderer = new TH.WebGLRenderer({ canvas: viewCanvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (renderer.outputColorSpace !== undefined && TH.SRGBColorSpace !== undefined) {
      renderer.outputColorSpace = TH.SRGBColorSpace;
    }
    scene = new TH.Scene();
    scene.fog = new TH.FogExp2(0xc2a678, 0.0065);
    camera = new TH.PerspectiveCamera(C.fovBase, 1, 0.05, 400);
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    /* sky dome */
    G.textures.build();
    sky = new TH.Mesh(new TH.SphereGeometry(340, 20, 14),
      new TH.MeshBasicMaterial({ map: G.tex.sky, side: TH.BackSide, fog: false }));
    scene.add(sky);

    var hemi = new TH.HemisphereLight(0xa8bcd8, 0x6a5230, 0.55);
    scene.add(hemi);
    var sunLight = new TH.DirectionalLight(0xffe2b8, 0.85);
    sunLight.position.set(60, 140, 40);
    scene.add(sunLight);

    L.build(scene);
    FX.build(scene);
    WP.build(camera);
    buildPickups();

    G.hud.init(hudCanvas);
    sizeCanvases();
    G.player.attach(viewCanvas);

    /* clicking the card starts (or restarts) the run and grabs the mouse */
    menuEl.addEventListener('click', function () {
      if (st.phase !== 'play') beginRun();
      grabMouse();
    }, false);
    /* lose the lock while playing: treat it as a pause, the view stays put */
    document.addEventListener('pointerlockchange', function () {
      if (!document.pointerLockElement && st.phase === 'play' && st.started && !st.paused) {
        st.paused = true;
        G.say('CLICK BACK IN', 'sys');
      }
    }, false);
    /* the mouse still has to drive the look: player.js only tracks the lock */
    document.addEventListener('mousemove', function (ev) {
      if (st.phase === 'play' && !st.paused && st.lock) {
        mdx += ev.movementX || 0;
        mdy += ev.movementY || 0;
      }
    }, false);
    window.addEventListener('keydown', function (ev) {
      if (ev.code === 'Escape' || ev.code === 'KeyP') {
        if (st.phase === 'play') {
          st.paused = !st.paused;
          G.say(st.paused ? 'PAUSED' : 'BACK IN THE GAME', 'sys');
        }
      } else if (ev.code === 'Enter') {
        if (st.phase === 'play' && (st.gameOver || st.cleared)) showMenu('CLICK TO PLAY AGAIN');
      }
    }, false);
    window.addEventListener('resize', sizeCanvases, false);

    var note = document.querySelector('.tiny');
    if (note) {
      var gateCount = 0;
      for (var gk in G.level.gates) gateCount++;
      note.textContent = 'loaded: ' + gateCount + ' gates, ' + G.world.colliders.length + ' blocks';
    }

    st.phase = 'menu';
    M.ready = true;
    loop();
  }

  function sizeCanvases() {
    var w = viewCanvas.clientWidth || window.innerWidth;
    var h = viewCanvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, true);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    G.hud.size(w, h, Math.min(window.devicePixelRatio || 1, 2));
  }

  /* ------------------------------------------------------------------ the loop */
  var clock = (window.performance && performance.now) ? performance : { now: function () { return Date.now(); } };
  function loop() {
    requestAnimationFrame(loop);
    var now = clock.now();
    var dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) return;
    if (dt > 0.1) dt = 0.1;
    frame(dt);
  }

  /* one step of the whole game: exported so the loop can also be driven by hand */
  function frame(dt) {
    /* fps bookkeeping for the HUD */
    frames++;
    fpsT += dt;
    if (fpsT >= 1) {
      st.fps = Math.round(frames / fpsT);
      if (st.fps < st.fpsMin) st.fpsMin = st.fps;
      st.fpsAvg = Math.round(st.fpsAvg * 0.8 + st.fps * 0.2);
      frames = 0;
      fpsT = 0;
    }

    if (st.phase === 'menu') {
      st.time += dt;
      if (!st.started) {
        /* slow orbit over the courtyard for the title shot */
        var a = st.time * 0.12;
        camera.position.set(Math.sin(a) * 24, 10 + Math.sin(st.time * 0.3) * 4, 52 - Math.cos(a) * 18);
        camera.lookAt(0, 6, 44);
      }
      G.level.update(dt);
      renderer.render(scene, camera);
      return;
    }

    if (st.gameOver) {
      /* corpse cam: the world keeps ticking, the player does not */
      st.time += dt;
      st.deadT += dt;
      st.hitFlash = 0.35 + 0.18 * Math.sin(st.time * 3);
      st.dmgFlash = 0.72;
      E.update(dt);
      G.level.update(dt);
      FX.update(dt);
      G.player.applyCamera(camera, dt);
      if (st.deadT > 1.6 && st.phase === 'play') {
        st.phase = 'menu';
        if (document.pointerLockElement) document.exitPointerLock();
        showMenu("IT'S OVER — CLICK TO PLAY AGAIN");
      }
      G.hud.draw(dt);
      renderer.render(scene, camera);
      return;
    }

    if (st.paused) {
      renderer.render(scene, camera);
      return;
    }

    st.time += dt;

    /* look first so aim direction this frame is current */
    if (mdx || mdy) {
      G.player.look(mdx, mdy, st.lock);
      mdx = 0;
      mdy = 0;
    }
    G.player.update(dt);
    E.update(dt);
    G.level.update(dt);
    FX.update(dt);
    WP.update(dt);
    G.player.applyCamera(camera, dt);
    G.player.tickVitals(dt);

    /* shooting: the belt eats links, a dead belt eats a spare */
    st.firing = !!G.inputState.firing;
    if (st.firing && WP.canFire()) {
      if (st.ammo <= 0) {
        if (st.spare > 0) {
          WP.reload();
          G.say('OUT OF LINKS: RELOADING', 'yell');
        } else {
          WP.fire();
        }
      } else {
        WP.fire();
      }
    }
    if (G.inputState.reload) {
      G.inputState.reload = false;
      if (st.reloadT <= 0 && st.ammo < C.beltSize && st.spare > 0) {
        WP.reload();
        G.say('THUMB ON THE COCKING PIECE', 'sys');
      }
    }
    if (st.reloadT > 0) {
      st.reloadT -= dt;
      if (st.reloadT <= 0) {
        st.reloadT = 0;
        st.ammo = C.beltSize;
        G.say('CLACK-CLACK: BELT FULL', 'sys');
      }
    }

    /* E uses whatever is in the crosshair */
    if (G.inputState.use) {
      G.inputState.use = false;
      if (L.aimedSwitch && L.aimedSwitch()) {
        L.setGate('secret', true);
        AU.mech({ x: G.playerPos.x, z: G.playerPos.z }, true);
        G.say('HIDDEN DOOR: THE WALL MOVES', 'yell');
        st.cheats++;
      } else {
        G.say('NOTHING TO USE HERE', 'sys');
      }
    }

    checkWaves();
    tickPickups(dt);

    /* call-outs fade, combo decays */
    for (var mi = st.messages.length - 1; mi >= 0; mi--) {
      st.messages[mi].life -= dt;
      if (st.messages[mi].life <= 0) st.messages.splice(mi, 1);
    }
    if (st.comboT > 0) {
      st.comboT -= dt;
      if (st.comboT <= 0) st.combo = 0;
    }

    G.hud.draw(dt);
    renderer.render(scene, camera);
  }
  M.frame = frame; /* drive the game by hand: G.main.frame(0.05) */

  try {
    boot();
  } catch (e) {
    fail(e.message + (e.stack ? '\n' + e.stack : ''));
  }
})(window.G);
