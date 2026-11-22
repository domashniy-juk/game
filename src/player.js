/* the player: stride, jump, crouch, camera (auto-levelling), damage, footsteps */
(function (G) {
  'use strict';
  var P = (G.player = {});
  var V = (G.view = { yaw: 0, pitch: 0, mousePitch: 0, roll: 0, height: 0, bob: 0, bobPhase: 0, shakeX: 0, shakeY: 0, tiltX: 0, tiltZ: 0, pitchKick: 0, kick: 0 });
  var C = G.cfg;
  G.playerPos.y = C.height ? C.height : C.eye;

  var keys = { f: 0, b: 0, l: 0, r: 0 };
  var vel = { x: 0, z: 0, y: 0 };
  var grounded = true, vy = 0, crouchF = 0, sprint = false, jumpT = 0;
  var stepT = 0, bobSpd = 0;

  /* ------------------------------------------------------------------ input */
  var CODES = {
    KeyW: 'f', KeyS: 'b', KeyA: 'l', KeyD: 'r',
    ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump',
    KeyC: 'crouch', ControlLeft: 'crouch', KeyE: 'use', KeyR: 'reload', KeyM: 'mute', Enter: 'confirm'
  };
  G.inputState = { use: false, reload: false, confirm: false, firing: false };

  P.attach = function (canvas) {
    window.addEventListener('keydown', function (ev) {
      var k = CODES[ev.code];
      if (!k) return;
      ev.preventDefault();
      if (k === 'f') keys.f = 1;
      else if (k === 'b') keys.b = 1;
      else if (k === 'l') keys.l = 1;
      else if (k === 'r') keys.r = 1;
      else if (k === 'sprint') sprint = true;
      else if (k === 'jump') jumpT = 1;
      else if (k === 'crouch') crouchF = 1;
      else if (k === 'use') G.inputState.use = true;
      else if (k === 'reload') G.inputState.reload = true;
      else if (k === 'mute') G.toggleMute();
      else if (k === 'confirm') G.inputState.confirm = true;
    }, false);
    window.addEventListener('keyup', function (ev) {
      var k = CODES[ev.code];
      if (!k) return;
      if (k === 'f' || k === 'b' || k === 'l' || k === 'r') keys[k] = 0;
      else if (k === 'sprint') sprint = false;
      else if (k === 'crouch') crouchF = 0;
    }, false);
    canvas.addEventListener('mousedown', function (ev) {
      if (ev.button === 0) G.inputState.firing = true;
    }, false);
    window.addEventListener('mouseup', function (ev) {
      if (ev.button === 0) G.inputState.firing = false;
    }, false);
    document.addEventListener('pointerlockchange', function () {
      G.state.lock = !!document.pointerLockElement;
    }, false);
    document.addEventListener('pointerlockerror', function () { G.state.lock = false; }, false);
  };

  /* mouse look: applied on demand so pausing freezes the view */
  P.look = function (dx, dy, locked) {
    if (!locked) return;
    V.yaw = G.wrapPi(V.yaw - dx * C.mouseSens);
    V.mousePitch = G.clamp(V.mousePitch - dy * C.mouseSens, -C.maxPitch, C.maxPitch);
  };

  /* ------------------------------------------------------------------ stride */
  P.reset = function () {
    V.yaw = 0; V.mousePitch = 0; V.pitch = 0; V.roll = 0; V.height = C.eye;
    G.playerPos.x = 0; G.playerPos.z = 52; G.playerPos.y = 0;
    vel.x = vel.z = vy = 0; crouchF = 0; keys.f = keys.b = keys.l = keys.r = 0;
  };

  P.update = function (dt) {
    var st = G.state;
    /* want-to-move vector in yaw space */
    var ax = (keys.r - keys.l), az = (keys.f - keys.b);
    var mag = Math.hypot(ax, az);
    if (mag > 1) { ax /= mag; az /= mag; }
    var top = sprint ? C.runSpeed : C.walkSpeed;
    var fx = -Math.sin(V.yaw), fz = -Math.cos(V.yaw);
    var rx = Math.cos(V.yaw), rz = -Math.sin(V.yaw);
    var dx = (fx * az + rx * ax), dz = (fz * az + rz * ax);
    var wantX = dx * top, wantZ = dz * top;
    var rate = (grounded ? 11 : 4.5);
    vel.x = G.damp(vel.x, wantX, rate, dt);
    vel.z = G.damp(vel.z, wantZ, rate, dt);

    /* jump / gravity */
    if (jumpT > 0 && grounded) { grounded = false; vy = C.jumpVel; jumpT = 0; }
    if (jumpT === 0 && !grounded) {
      vy -= C.gravity * dt;
      var ny = G.playerPos.y + vy * dt;
      var floor = G.groundAt(G.playerPos.x, G.playerPos.z, G.playerPos.y, C.stepHeight || 0.7, 6);
      if (vy < 0 && ny <= floor) { G.playerPos.y = floor; grounded = true; vy = 0; }
      else G.playerPos.y = ny;
      if (G.playerPos.y < 0) { G.playerPos.y = 0; grounded = true; vy = 0; }
    }

    /* crouch shifts the eye height and shortens the stride */
    var cTarget = crouchF ? 0.62 : 1;
    crouchF = crouchF;
    V.height = G.damp(V.height, C.eye * (crouchTargetNow()) - (grounded ? 0 : 0.05), 12, dt);

    /* horizontal move with wall slide + step up */
    var mx = vel.x * dt, mz = vel.z * dt;
    var res = G.moveXZ({ x: G.playerPos.x, z: G.playerPos.z }, mx, mz, C.playerR, G.playerPos.y, G.playerPos.y + V.height, C.stepHeight || 0.7);
    G.playerPos.x = res.x;
    G.playerPos.z = res.z;
    /* never leave the level */
    var b = G.world.bounds;
    G.playerPos.x = G.clamp(G.playerPos.x, b.min.x + 1.5, b.max.x - 1.5);
    G.playerPos.z = G.clamp(G.playerPos.z, b.min.z + 1.5, b.max.z - 1.5);
    /* stick to the ground when walking (not jumping) */
    if (grounded) {
      var g2 = G.groundAt(G.playerPos.x, G.playerPos.z, G.playerPos.y, 0.85, 6);
      if (g2 > G.playerPos.y) G.playerPos.y = Math.min(g2, G.playerPos.y + (C.stepHeight || 0.7));
      else if (g2 >= G.playerPos.y - 1.6) G.playerPos.y = g2;
      else grounded = false;
    }

    /* footsteps + head bob */
    var spd = Math.hypot(vel.x, vel.z);
    bobSpd = spd;
    stepT -= dt;
    if (grounded && spd > 1.2 && stepT <= 0) {
      G.audio.step(spd > C.runSpeed * 0.7);
      stepT = G.clamp(0.62 - spd * 0.035, 0.22, 0.7);
    }
    var bobAmp = G.clamp(spd / top, 0, 1.35);
    V.bobPhase += dt * (6.5 + spd * 0.55);
    V.bob = Math.sin(V.bobPhase) * 0.055 * bobAmp;
    var side = Math.sin(V.yaw) * spd * 0.008;
    V.roll = G.damp(V.roll, -side * 8, 6, dt);

    /* auto-levelling: aim pitch is honoured while aiming, otherwise it eases to the horizon */
    var aiming = G.state.firing || G.state.aimHeld > 0;
    if (!aiming) {
      G.state.levelT = (G.state.levelT || 0) + dt;
      if (G.state.levelT > 0.55) V.mousePitch = G.damp(V.mousePitch, 0, 1.6, dt);
    } else G.state.levelT = 0;
    V.pitch = G.clamp(V.mousePitch + V.pitchKick, -C.maxPitch, C.maxPitch);
    V.pitchKick = G.damp(V.pitchKick, 0, 7, dt);
  };

  function crouchTargetNow() { return crouchF ? 0.66 : 1; }

  /* ------------------------------------------------------------------ damage */
  P.hurt = function (amount, msg, heavy) {
    var st = G.state;
    if (st.gameOver) return;
    /* armour eats it first, then health, like the classic faceplate bars */
    var a = Math.min(st.armor, amount * 2.4);
    st.armor -= a;
    var rem = Math.max(0, amount * 2.4 - a);
    st.health -= rem * 0.55 + amount * 0.35;
    st.hitFlash = 1;
    st.dmgFlash = Math.min(1, st.dmgFlash + (heavy ? 0.9 : 0.45));
    P.shake(heavy ? 1.25 : 0.45);
    V.pitchKick += (heavy ? -0.16 : -0.04) * (0.5 + Math.random());
    V.tiltX += G.rand(-0.2, 0.2) * (heavy ? 1 : 0.35);
    G.audio.pain(heavy);
    if (msg) G.yell(msg);
    if (st.health <= 0) {
      st.health = 0;
      st.gameOver = true;
      G.yell("IT'S OVER");
      G.audio.wail();
    }
  };
  P.shake = function (a) {
    G.state.shakeAmp = Math.min(1.6, (G.state.shakeAmp || 0) + a);
  };
  P.kickCamera = function (up, side) {
    V.pitchKick += up;
    V.yaw += side;
  };
  P.heal = function (which) {
    var st = G.state;
    if (which === 'armor') { st.armor = 100; G.say('ARMOR: MAX', 'sys'); }
    else { st.health = 100; st.armor = Math.max(st.armor, 70); }
  };

  /* slow drain so the pickups matter */
  P.tickVitals = function (dt) {
    var st = G.state;
    st.health -= dt * 0.35;
    st.armor -= dt * 0.55;
    if (st.health < 0 && !st.gameOver) { st.health = 0; st.gameOver = true; G.yell("NO JU-HU LEFT"); }
  };

  /* ------------------------------------------------------------------ per-frame camera */
  P.applyCamera = function (cam, dt) {
    var sh = G.state.shakeAmp || 0;
    if (sh > 0.001) {
      G.state.shakeAmp = Math.max(0, sh - dt * 2.6);
      V.shakeX = (Math.random() - 0.5) * sh * 0.45;
      V.shakeY = (Math.random() - 0.5) * sh * 0.4;
      V.shakeZ = (Math.random() - 0.5) * sh * 0.3;
      V.tiltX = G.damp(V.tiltX, 0, 8, dt);
      V.tiltZ = G.damp(V.tiltZ, 0, 8, dt);
    } else { V.shakeX = V.shakeY = V.shakeZ = 0; }
    cam.position.set(
      G.playerPos.x + V.shakeX + V.shakeZ,
      G.playerPos.y + V.height + V.bob + V.shakeY,
      G.playerPos.z + V.shakeY * 0.4
    );
    cam.rotation.order = 'YXZ';
    cam.rotation.set(V.pitch + V.tiltX, V.yaw, V.roll + V.tiltZ);
    /* fov punch while sprinting: the classic run-cam */
    var spd = Math.hypot(vel.x, vel.z);
    var wantFov = C.fovBase + G.clamp(spd / C.runSpeed, 0, 1) * (C.fovRun - C.fovBase);
    if (cam.fov !== undefined) {
      cam.fov = G.damp(cam.fov, wantFov, 5, dt);
      cam.updateProjectionMatrix();
    }
  };
  P.aimDir = function () {
    var cp = Math.cos(V.pitch), sp = Math.sin(V.pitch);
    return { x: -Math.sin(V.yaw) * cp, y: sp, z: -Math.cos(V.yaw) * cp };
  };
  P.speed = function () { return Math.hypot(vel.x, vel.z); };
  P.center = function () { return { x: G.playerPos.x, y: G.playerPos.y + V.height, z: G.playerPos.z }; };
})(window.G);
