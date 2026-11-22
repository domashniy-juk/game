/* HUD: 2D overlay on #hud. Health/armor, belt readout, score, radar, FPS. */
(function (G) {
  'use strict';
  var H = (G.hud = { cv: null, cx: null, w: 0, h: 0 });
  var MONO = '"Courier New", monospace';

  H.init = function (canvas) {
    H.cv = canvas;
    H.cx = canvas.getContext('2d');
  };

  H.size = function (w, h, dpr) {
    H.w = w;
    H.h = h;
    H.cv.width = Math.max(2, Math.round(w * dpr));
    H.cv.height = Math.max(2, Math.round(h * dpr));
    H.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /* ------------------------------------------------------------------ small bits */
  function txt(x, y, text, color, size, align) {
    var cx = H.cx;
    cx.font = '700 ' + size + 'px ' + MONO;
    cx.textAlign = align || 'left';
    cx.textBaseline = 'alphabetic';
    cx.fillStyle = 'rgba(0,0,0,0.7)';
    cx.fillText(text, x + 1, y + 2);
    cx.fillStyle = color;
    cx.fillText(text, x, y);
  }
  function frame(x, y, w, h) {
    var cx = H.cx;
    cx.fillStyle = 'rgba(18,13,8,0.5)';
    cx.fillRect(x, y, w, h);
    cx.strokeStyle = 'rgba(214,164,72,0.35)';
    cx.lineWidth = 1;
    cx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  /* segmented bar: 10 lamps, like a gauge */
  function bar(x, y, w, h, value, max, lit) {
    var cx = H.cx, n = 10, seg = w / n;
    for (var i = 0; i < n; i++) {
      var on = (value / max) * n > i + 0.15;
      cx.fillStyle = on ? lit : 'rgba(24,18,12,0.6)';
      cx.fillRect(x + i * seg, y, seg - 2, h);
      cx.strokeStyle = 'rgba(0,0,0,0.5)';
      cx.strokeRect(x + i * seg + 0.5, y + 0.5, seg - 3, h - 1);
    }
  }

  /* ------------------------------------------------------------------ overlays */
  function vitals(s) {
    var cx = H.cx;
    /* damage vignette */
    if (s.dmgFlash > 0.01) {
      var g = cx.createRadialGradient(H.w / 2, H.h / 2, H.h * 0.22, H.w / 2, H.h / 2, H.h * 0.8);
      g.addColorStop(0, 'rgba(150,20,10,0)');
      g.addColorStop(1, 'rgba(150,20,10,' + (0.5 * s.dmgFlash).toFixed(3) + ')');
      cx.fillStyle = g;
      cx.fillRect(0, 0, H.w, H.h);
    }
    if (s.hitFlash > 0.01) {
      cx.fillStyle = 'rgba(255,238,200,' + (0.12 * s.hitFlash).toFixed(3) + ')';
      cx.fillRect(0, 0, H.w, H.h);
    }
    /* low health: a slow red pulse at the edges */
    var low = 1 - G.clamp(s.health / 35, 0, 1);
    if (low > 0.01) {
      var pulse = low * (0.16 + 0.14 * Math.sin(G.state.time * 3.4));
      cx.fillStyle = 'rgba(160,26,16,' + pulse.toFixed(3) + ')';
      cx.fillRect(0, 0, H.w, H.h);
    }
  }

  /* ------------------------------------------------------------------ radar */
  function radar(x, y, size) {
    var cx = H.cx, L = G.level;
    if (!L.map) return;
    var b = G.world.bounds;
    var sc = (size * 0.9) / Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    var ox = x + size / 2 - ((b.min.x + b.max.x) / 2) * sc;
    var oy = y + size / 2 - ((b.min.z + b.max.z) / 2) * sc;

    frame(x - 4, y - 4, size + 8, size + 8);
    cx.save();
    cx.beginPath();
    cx.rect(x, y, size, size);
    cx.clip();
    /* rooms */
    cx.fillStyle = 'rgba(74,58,38,0.8)';
    for (var i = 0; i < L.map.rooms.length; i++) {
      var r = L.map.rooms[i];
      cx.fillRect(ox + r.x0 * sc, oy + r.z0 * sc, (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
    }
    /* gates: red while still dropped, green once open */
    for (var k in L.gates) {
      var g = L.gates[k];
      var open = g.f < 0.5;
      cx.fillStyle = open ? 'rgba(150,222,140,0.9)' : 'rgba(226,84,52,0.95)';
      cx.fillRect(ox + (g.col.min.x + 0.2) * sc - 1, oy + (g.col.min.z + 0.2) * sc - 1,
        Math.max(3, (g.col.max.x - g.col.min.x) * sc), Math.max(3, (g.col.max.z - g.col.min.z) * sc));
    }
    /* pickups then enemies */
    for (var p = 0; p < G.world.pickups.length; p++) {
      var pu = G.world.pickups[p];
      if (pu.taken) continue;
      cx.fillStyle = pu.kind === 'med' ? '#5fd08a' : '#e6c266';
      cx.fillRect(ox + pu.x * sc - 1.5, oy + pu.z * sc - 1.5, 3, 3);
    }
    for (var e = 0; e < G.world.enemies.length; e++) {
      var en = G.world.enemies[e];
      if (en.dead) continue;
      cx.fillStyle = en.type === 'boss' ? '#ffd27a' : '#e8583c';
      cx.beginPath();
      cx.arc(ox + en.x * sc, oy + en.z * sc, en.type === 'boss' ? 4 : 2.4, 0, 6.3);
      cx.fill();
    }
    /* the player and his sight line */
    var fx = -Math.sin(G.view.yaw), fz = -Math.cos(G.view.yaw);
    cx.strokeStyle = 'rgba(255,240,200,0.35)';
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(ox + G.playerPos.x * sc, oy + G.playerPos.z * sc);
    cx.lineTo(ox + (G.playerPos.x + fx * 16) * sc, oy + (G.playerPos.z + fz * 16) * sc);
    cx.stroke();
    cx.fillStyle = '#fff4d0';
    cx.beginPath();
    cx.arc(ox + G.playerPos.x * sc, oy + G.playerPos.z * sc, 2.6, 0, 6.3);
    cx.fill();
  }

  /* ------------------------------------------------------------------ the panel */
  H.draw = function (dt) {
    if (!H.cx) return;
    var cx = H.cx, s = G.state, C = G.cfg;
    cx.clearRect(0, 0, H.w, H.h);

    /* score, top left */
    frame(14, 12, 190, 46);
    txt(20, 32, 'SCORE', '#c8b892', 12);
    txt(20, 52, String(Math.round(s.score)), '#f4e6c8', 22);
    if (s.combo > 1 && s.comboT > 0) txt(120, 32, 'x' + s.combo, '#ffc25a', 15);

    /* FPS, top right */
    var f = Math.round(s.fps);
    txt(H.w - 16, 30, f + ' FPS', f >= 50 ? '#8fe08a' : (f >= 30 ? '#ffd27a' : '#e0663c'), 21, 'right');
    frame(H.w - 112, 38, 100, 12);
    H.cx.fillStyle = 'rgba(150,220,150,0.85)';
    H.cx.fillRect(H.w - 108, 42, G.clamp(f / 60, 0, 1) * 92, 6);
    txt(H.w - 16, 62, 'AVG ' + Math.round(s.fpsAvg) + '  LOW ' + Math.round(s.fpsMin), 'rgba(200,185,160,0.85)', 11, 'right');

    /* radar, left middle */
    txt(16, H.h * 0.42 - 12, 'MAP', '#b8a67c', 11);
    radar(16, H.h * 0.42, Math.min(150, Math.max(76, H.h * 0.26)));

    /* health + armour, bottom left */
    var bx = 16, by = H.h - 46;
    frame(12, by - 20, 252, 54);
    txt(18, by - 6, 'HEALTH', '#c8b892', 12);
    bar(18, by, 138, 14, G.clamp(s.health, 0, 100), 100, '#3fc46a');
    txt(150, by + 11, Math.round(G.clamp(s.health, 0, 100)) + '', '#e8f0d0', 17);
    txt(118, by - 6, 'ARMOR', '#c8b892', 12);
    bar(118, by + 16, 140, 9, G.clamp(s.armor, 0, 100), 100, '#48a6d8');

    /* belt, bottom right */
    var rx = H.w - 16;
    frame(rx - 244, H.h - 60, 240, 50);
    txt(rx - 238, H.h - 44, 'AMMO', '#c8b892', 12);
    var ammo = G.clamp(Math.round(s.ammo), 0, C.beltSize);
    txt(rx - 186, H.h - 22, String(ammo), ammo > 0 ? '#ffd27a' : '#e05a3c', 24);
    txt(rx - 120, H.h - 44, '/ ' + C.beltSize, '#a89a7c', 13);
    for (var i = 0; i < 12; i++) {
      cx.fillStyle = (ammo / 12) > i ? '#d9a13b' : 'rgba(30,24,16,0.75)';
      cx.fillRect(rx - 104 + i * 8, H.h - 34, 6, 16);
    }
    txt(rx - 104, H.h - 12, 'SPARE ' + Math.round(G.clamp(s.spare, 0, 9)), '#a89a7c', 12);
    if (s.reloadT > 0) txt(rx - 236, H.h - 12, 'RELOADING', '#ff9a5a', 14);

    /* call-outs, Sam-style, stacked above the belt */
    var my = H.h * 0.72;
    for (var m = s.messages.length - 1; m >= 0; m--) {
      var msg = s.messages[m];
      var a = G.clamp(msg.life / 0.9, 0, 1);
      cx.globalAlpha = Math.min(1, a);
      cx.font = '700 ' + (msg.kind === 'yell' ? 30 : 17) + 'px Georgia, Georgia, serif';
      cx.textAlign = 'center';
      cx.fillStyle = 'rgba(0,0,0,0.65)';
      cx.fillText(msg.t, H.w / 2 + 2, my + 2);
      cx.fillStyle = msg.kind === 'yell' ? '#ffd86a' : (msg.kind === 'hit' ? '#ffe6b0' : '#c9bda2');
      cx.fillText(msg.t, H.w / 2, my);
      my -= msg.kind === 'yell' ? 34 : 24;
    }
    cx.globalAlpha = 1;

    /* crosshair: opens while running, closes while aiming */
    var chx = H.w / 2, chy = H.h / 2;
    var spread = 4 + G.player.speed() * 0.9 - (s.firing ? 2 : 0);
    cx.strokeStyle = s.firing ? 'rgba(255,232,150,0.92)' : 'rgba(230,215,175,0.7)';
    cx.lineWidth = 2;
    cx.beginPath();
    for (var q = 0; q < 4; q++) {
      var ang = q * Math.PI / 2 + Math.PI / 4;
      cx.moveTo(chx + Math.cos(ang) * spread, chy + Math.sin(ang) * spread);
      cx.lineTo(chx + Math.cos(ang) * (spread + 9), chy + Math.sin(ang) * (spread + 9));
    }
    cx.stroke();
    cx.fillStyle = 'rgba(255,244,200,0.85)';
    cx.fillRect(chx - 1, chy - 1, 2, 2);

    vitals(s);

    /* status words */
    if (G.state.paused && !G.state.over) txt(H.w / 2, H.h * 0.22, 'PAUSED', 'rgba(240,226,200,0.9)', 26, 'center');
  };

  H.reset = function () { H.cx && H.cx.clearRect(0, 0, H.w, H.h); };
})(window.G);
