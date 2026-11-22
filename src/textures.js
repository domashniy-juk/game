/* procedural textures: everything is drawn with canvas, no external art */
(function (G) {
  'use strict';
  G.tex = {};

  /* ------------------------------------------------------------------ canvas helpers */
  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c: c, x: c.getContext('2d') };
  }
  function img(t) {
    var tex = new THREE.CanvasTexture(t.c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.generateMipmaps = true;
    if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  function spr(t) { /* sprite atlas piece: no wrapping */
    var tex = img(t);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }
  function px(t, put) {
    var w = t.c.width, h = t.c.height, d = t.x.getImageData(0, 0, w, h), a = d.data, r = G.rng(put.seed || 7);
    var base = put.base, amp = put.amp === undefined ? 16 : put.amp;
    for (var i = 0; i < a.length; i += 4) {
      var n = (r() - 0.5) * 2 * amp;
      a[i] = G.clamp(base[0] + n, 0, 255);
      a[i + 1] = G.clamp(base[1] + n * (put.gb === undefined ? 0.9 : put.gb), 0, 255);
      a[i + 2] = G.clamp(base[2] + n, 0, 255);
      a[i + 3] = 255;
    }
    t.x.putImageData(d, 0, 0);
  }
  function shade(hex) {
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ------------------------------------------------------------------ glyph language (made-up, temple-ish) */
  function glyph(x, kind, cx, cy, s, r) {
    x.save(); x.translate(cx, cy);
    x.beginPath();
    var k = kind % 9;
    if (k === 0) { x.arc(0, 0, s * 0.42, 0, 7); x.moveTo(s * 0.7, 0); x.lineTo(-s * 0.7, 0); }
    else if (k === 1) { x.moveTo(-s * 0.5, s * 0.4); for (var i = 0; i < 4; i++) x.lineTo(-s * 0.5 + s * (i + 0.5) / 3.5, (i % 2 ? -0.4 : 0.4) * s); }
    else if (k === 2) { x.moveTo(0, -s * 0.45); x.lineTo(s * 0.4, 0); x.lineTo(0, s * 0.45); x.lineTo(-s * 0.4, 0); x.closePath(); x.moveTo(0, -s * 0.2); x.arc(0, 0, s * 0.2, 0, 7); }
    else if (k === 3) { x.arc(0, s * 0.1, s * 0.25, 0, 7); for (var a = 0; a < 7; a += 0.9) { x.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3 + s * 0.1); x.lineTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55 + s * 0.1); } }
    else if (k === 4) { x.rect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.25); x.moveTo(-s * 0.25, -s * 0.15); x.lineTo(-s * 0.25, s * 0.45); x.moveTo(s * 0.25, -s * 0.15); x.lineTo(s * 0.25, s * 0.45); }
    else if (k === 5) { x.moveTo(-s * 0.5, s * 0.35); x.lineTo(-s * 0.1, -s * 0.35); x.lineTo(s * 0.5, -s * 0.05); x.lineTo(s * 0.1, s * 0.45); x.closePath(); }
    else if (k === 6) { x.rect(-s * 0.45, -s * 0.45, s * 0.9, s * 0.9); x.moveTo(-s * 0.45, 0); x.lineTo(s * 0.45, 0); x.moveTo(0, -s * 0.45); x.lineTo(0, s * 0.45); }
    else if (k === 7) { for (var q = 0; q < 3; q++) { x.moveTo(-s * 0.5, -s * 0.3 + q * s * 0.3); x.quadraticCurveTo(0, -s * 0.55 + q * s * 0.3, s * 0.5, -s * 0.3 + q * s * 0.3); } }
    else { x.moveTo(0, -s * 0.5); x.lineTo(s * 0.18, -s * 0.1); x.lineTo(s * 0.5, 0); x.lineTo(s * 0.18, s * 0.12); x.lineTo(0, s * 0.5); x.lineTo(-s * 0.18, s * 0.12); x.lineTo(-s * 0.5, 0); x.lineTo(-s * 0.18, -s * 0.1); x.closePath(); }
    x.stroke();
    x.restore();
  }
  function glyphRows(x, x0, y0, w, h, size, ink, r) {
    x.strokeStyle = ink; x.lineWidth = Math.max(1, size * 0.11); x.lineCap = 'round';
    var cols = Math.max(2, Math.floor(w / size)), rows = Math.max(1, Math.floor(h / size));
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
      if (r() < 0.12) continue;
      glyph(x, (r() * 9) | 0, x0 + (i + 0.5) * (w / cols), y0 + (j + 0.5) * (h / rows), size * 0.82, r);
    }
  }

  /* ------------------------------------------------------------------ surface generators */
  function wallTex(size, blocksTall, tint) {
    var t = cv(size, size), x = t.x, r = G.rng(11 + blocksTall * 3), base = shade(tint);
    px(t, { base: base, amp: 26, seed: 31 + blocksTall });
    var bw = size / 2.4, bh = size / blocksTall;
    for (var row = 0; row < blocksTall; row++) {
      var off = (row % 2) * bw * 0.5;
      for (var col = -1; col < 4; col++) {
        var bx = col * bw + off, by = row * bh;
        var d = (r() - 0.5) * 34;
        x.fillStyle = 'rgba(' + G.clamp(base[0] + d, 0, 255) + ',' + G.clamp(base[1] + d * 0.9, 0, 255) + ',' + G.clamp(base[2] + d * 0.7, 0, 255) + ',.55)';
        x.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
        /* mortar / grout + chipped edges */
        x.strokeStyle = 'rgba(24,18,10,.5)'; x.lineWidth = 3;
        x.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);
        x.strokeStyle = 'rgba(255,246,220,.16)'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(bx + 3, by + bh - 3); x.lineTo(bx + bw - 3, by + bh - 3); x.stroke();
        for (var c = 0; c < 3; c++) { /* chips */
          var cx = bx + r() * bw, cy = by + r() * bh;
          x.fillStyle = 'rgba(30,24,14,' + (0.10 + r() * 0.22) + ')';
          x.beginPath(); x.arc(cx, cy, 1 + r() * 6, 0, 7); x.fill();
        }
      }
    }
    grime(x, size, r, 0.35);
    return t;
  }
  function grime(x, size, r, amt) {
    for (var i = 0; i < size * 0.6; i++) {
      var gx = r() * size, gy = r() * size, rad = 6 + r() * size * 0.16;
      var g = x.createRadialGradient(gx, gy, 0, gx, gy, rad);
      var dark = r() < 0.72;
      g.addColorStop(0, dark ? 'rgba(26,20,12,' + (0.10 * amt) + ')' : 'rgba(240,226,190,' + (0.07 * amt) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
    }
  }
  function floorTex(size, tileCount, tint) {
    var t = cv(size, size), x = t.x, r = G.rng(77), base = shade(tint);
    px(t, { base: base, amp: 18, seed: 77 });
    var ts = size / tileCount;
    for (var i = 0; i < tileCount; i++) for (var j = 0; j < tileCount; j++) {
      var d = (r() - 0.5) * 40;
      x.fillStyle = 'rgba(' + G.clamp(base[0] + d, 0, 255) + ',' + G.clamp(base[1] + d * 0.95, 0, 255) + ',' + G.clamp(base[2] + d * 0.85, 0, 255) + ',.75)';
      x.fillRect(i * ts + 2, j * ts + 2, ts - 4, ts - 4);
      x.strokeStyle = 'rgba(18,14,8,.55)'; x.lineWidth = 2.5;
      x.strokeRect(i * ts + 2, j * ts + 2, ts - 4, ts - 4);
      x.strokeStyle = 'rgba(255,240,210,.14)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(i * ts + 3, j * ts + ts - 3); x.lineTo(i * ts + ts - 3, j * ts + ts - 3); x.stroke();
    }
    /* foot wear in the middle of tiles + cracks */
    for (var k = 0; k < 40; k++) {
      var cx = r() * size, cy = r() * size;
      x.fillStyle = 'rgba(20,16,10,' + (0.05 + r() * 0.10) + ')';
      x.beginPath(); x.ellipse(cx, cy, 8 + r() * 26, 6 + r() * 18, r() * 3, 0, 7); x.fill();
    }
    x.strokeStyle = 'rgba(16,12,8,.4)';
    for (var l = 0; l < 10; l++) {
      x.lineWidth = 1 + r() * 2; x.beginPath();
      var px2 = r() * size, py = r() * size; x.moveTo(px2, py);
      for (var m = 0; m < 4; m++) { px2 += (r() - 0.5) * size * 0.2; py += (r() - 0.5) * size * 0.2; x.lineTo(px2, py); }
      x.stroke();
    }
    grime(x, size, r, 0.5);
    return t;
  }
  function marbleTex(size, tint) {
    var t = cv(size, size), x = t.x, r = G.rng(199), base = shade(tint);
    px(t, { base: base, amp: 8, seed: 199 });
    for (var i = 0; i < 40; i++) {
      x.strokeStyle = 'rgba(' + (90 + r() * 60 | 0) + ',' + (95 + r() * 55 | 0) + ',' + (110 + r() * 60 | 0) + ',' + (0.10 + r() * 0.25) + ')';
      x.lineWidth = 0.6 + r() * 3.4;
      x.beginPath();
      var sx = r() * size, sy = r() * size; x.moveTo(sx, sy);
      for (var k = 0; k < 6; k++) { sx += (r() - 0.5) * size * 0.34; sy += (r() - 0.35) * size * 0.3; x.quadraticCurveTo(sx + 20, sy - 20, sx, sy); }
      x.stroke();
    }
    grime(x, size, r, 0.25);
    return t;
  }
  function pillarTex(size, tint) {
    var t = cv(size, size), x = t.x, base = shade(tint);
    px(t, { base: base, amp: 20, seed: 55 });
    /* fluting */
    for (var i = 0; i < 12; i++) {
      var gx = (i + 0.5) * (size / 12);
      var g = x.createLinearGradient(gx - size / 24, 0, gx + size / 24, 0);
      g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(0.5, 'rgba(255,248,225,.18)'); g.addColorStop(1, 'rgba(0,0,0,.22)');
      x.fillStyle = g; x.fillRect(gx - size / 24, 0, size / 12, size);
    }
    /* carved bands with the made-up glyph language */
    x.fillStyle = 'rgba(28,20,10,.30)';
    var bands = [[0.06, 0.14], [0.44, 0.14], [0.82, 0.12]];
    for (var b = 0; b < bands.length; b++) {
      var y0 = size * bands[b][0], h = size * bands[b][1];
      x.fillRect(0, y0, size, h);
      glyphRows(x, 4, y0 + 3, size - 8, h - 6, h * 0.9, 'rgba(20,14,6,.75)', G.rng(9 + b * 17));
      x.strokeStyle = 'rgba(255,244,214,.22)'; x.lineWidth = 2;
      x.strokeRect(1, y0 + 1, size - 2, h - 2);
    }
    grime(x, size, G.rng(4), 0.4);
    return t;
  }
  function obeliskTex(size, tint) {
    var t = cv(size, size), x = t.x, base = shade(tint), r = G.rng(303);
    px(t, { base: base, amp: 22, seed: 303 });
    /* stacked blocks + glyph column down the middle */
    var rows = 9;
    for (var i = 0; i < rows; i++) {
      var y = i * (size / rows);
      x.fillStyle = 'rgba(30,22,12,.34)'; x.fillRect(0, y, size, 4);
      x.strokeStyle = 'rgba(255,246,220,.14)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, y + 5); x.lineTo(size, y + 5); x.stroke();
    }
    x.fillStyle = 'rgba(60,44,22,.28)';
    x.fillRect(size * 0.30, 0, size * 0.40, size);
    glyphRows(x, size * 0.30, 6, size * 0.40, size - 12, size * 0.11, 'rgba(18,12,4,.8)', r);
    /* lightning scars */
    x.strokeStyle = 'rgba(20,16,10,.35)';
    for (var k = 0; k < 3; k++) {
      x.lineWidth = 1 + r() * 2; x.beginPath();
      var sx = r() * size; x.moveTo(sx, 0);
      for (var m = 0; m < 5; m++) { sx += (r() - 0.5) * size * 0.25; x.lineTo(sx, (m + 1) * size / 5); }
      x.stroke();
    }
    grime(x, size, r, 0.45);
    return t;
  }
  function muralTex(size, tint) {
    var t = cv(size, size), x = t.x, r = G.rng(808), base = shade(tint);
    px(t, { base: base, amp: 14, seed: 808 });
    /* painted panel: border frame + registers of glyphs + big central figure */
    x.strokeStyle = 'rgba(120,26,16,.75)'; x.lineWidth = size * 0.03;
    x.strokeRect(size * 0.06, size * 0.06, size * 0.88, size * 0.88);
    x.strokeStyle = 'rgba(216,160,60,.7)'; x.lineWidth = size * 0.012;
    x.strokeRect(size * 0.10, size * 0.10, size * 0.80, size * 0.80);
    var reg = 3;
    for (var i = 0; i < reg; i++) {
      var y0 = size * (0.14 + i * 0.24), h = size * 0.16;
      x.fillStyle = 'rgba(30,10,6,.20)'; x.fillRect(size * 0.12, y0, size * 0.76, h);
      glyphRows(x, size * 0.12, y0, size * 0.76, h, h * 0.9, 'rgba(16,8,4,.8)', G.rng(41 + i * 23));
    }
    /* central totem figure */
    x.strokeStyle = 'rgba(20,10,4,.85)'; x.lineWidth = size * 0.018;
    var cx2 = size * 0.5, cy2 = size * 0.5;
    x.beginPath(); x.arc(cx2, cy2 - size * 0.14, size * 0.09, 0, 7);
    x.moveTo(cx2 - size * 0.22, cy2 - size * 0.02); x.lineTo(cx2 + size * 0.22, cy2 - size * 0.02);
    x.moveTo(cx2, cy2 - size * 0.05); x.lineTo(cx2, cy2 + size * 0.18);
    x.moveTo(cx2 - size * 0.12, cy2 + size * 0.30); x.lineTo(cx2, cy2 + size * 0.18); x.lineTo(cx2 + size * 0.12, cy2 + size * 0.30);
    for (var s2 = 0; s2 < 8; s2++) { var a2 = s2 * 0.785; x.moveTo(cx2 + Math.cos(a2) * size * 0.26, cy2 - size * 0.14 + Math.sin(a2) * size * 0.26); x.lineTo(cx2 + Math.cos(a2) * size * 0.34, cy2 - size * 0.14 + Math.sin(a2) * size * 0.34); }
    x.stroke();
    grime(x, size, r, 0.8);
    /* flaked paint */
    for (var k2 = 0; k2 < 60; k2++) {
      x.fillStyle = 'rgba(210,190,150,' + (0.1 + r() * 0.3) + ')';
      x.beginPath(); x.arc(r() * size, r() * size, 1 + r() * 8, 0, 7); x.fill();
    }
    return t;
  }
  function metalTex(size, tint) {
    var t = cv(size, size), x = t.x, base = shade(tint), r = G.rng(606);
    px(t, { base: base, amp: 12, seed: 606 });
    var plate = size / 3;
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 3;
      x.strokeRect(i * plate + 3, j * plate + 3, plate - 6, plate - 6);
      x.strokeStyle = 'rgba(220,210,190,.16)'; x.lineWidth = 1.5;
      x.strokeRect(i * plate + 6, j * plate + 6, plate - 12, plate - 12);
      for (var k = 0; k < 4; k++) { /* rivets */
        var rx = i * plate + 12 + (k % 2) * (plate - 24), ry = j * plate + 12 + (k < 2 ? 0 : plate - 24);
        var g = x.createRadialGradient(rx, ry, 1, rx, ry, 7);
        g.addColorStop(0, 'rgba(230,220,200,.5)'); g.addColorStop(1, 'rgba(10,8,6,.5)');
        x.fillStyle = g; x.beginPath(); x.arc(rx, ry, 6, 0, 7); x.fill();
      }
    }
    for (var s3 = 0; s3 < 26; s3++) { /* rust runs */
      var sx = r() * size, sy = r() * size, wdt = 3 + r() * 8, hgt = 20 + r() * size * 0.4;
      var g2 = x.createLinearGradient(sx, sy, sx, sy + hgt);
      g2.addColorStop(0, 'rgba(120,52,20,.45)'); g2.addColorStop(1, 'rgba(60,26,10,0)');
      x.fillStyle = g2; x.fillRect(sx, sy, wdt, hgt);
    }
    return t;
  }
  function waterTex(size) {
    var t = cv(size, size), x = t.x, r = G.rng(1212), base = shade(G.pal.water);
    px(t, { base: base, amp: 12, seed: 1212 });
    for (var i = 0; i < 90; i++) { /* caustic ribbons */
      x.strokeStyle = 'rgba(200,240,240,' + (0.05 + r() * 0.16) + ')';
      x.lineWidth = 1 + r() * 3;
      x.beginPath();
      var sx = r() * size, sy = r() * size; x.moveTo(sx, sy);
      for (var k = 0; k < 5; k++) { sx += (r() - 0.5) * size * 0.3; sy += (r() - 0.5) * size * 0.3; x.quadraticCurveTo(sx + 14, sy + 8, sx, sy); }
      x.stroke();
    }
    for (var j = 0; j < 30; j++) { /* dark depth pockets */
      var cx = r() * size, cy = r() * size, rad = 12 + r() * 60;
      var g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(6,26,32,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill();
    }
    return t;
  }
  function skyTex(w, h) {
    var t = cv(w, h), x = t.x, r = G.rng(909);
    var g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, '#3d6f9e'); g.addColorStop(0.34, '#8fb6d6'); g.addColorStop(0.52, '#cfd8cf');
    g.addColorStop(0.60, '#e8d6a8'); g.addColorStop(0.70, '#c8a974'); g.addColorStop(1.0, '#6d5f45');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    /* sun bloom near the horizon */
    var sx = w * 0.22, sy = h * 0.585;
    var sg = x.createRadialGradient(sx, sy, 0, sx, sy, w * 0.16);
    sg.addColorStop(0, 'rgba(255,250,225,.95)'); sg.addColorStop(0.25, 'rgba(255,224,150,.55)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = sg; x.fillRect(0, 0, w, h);
    /* clouds */
    for (var i = 0; i < 260; i++) {
      var cx = r() * w, cy = h * (0.10 + r() * 0.42), rad = 12 + r() * 90;
      var cg = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      cg.addColorStop(0, 'rgba(255,255,250,' + (0.14 + r() * 0.32) + ')');
      cg.addColorStop(0.6, 'rgba(226,224,214,' + (0.05 + r() * 0.12) + ')');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = cg; x.beginPath(); x.ellipse(cx, cy, rad, rad * 0.5, 0, 0, 7); x.fill();
    }
    /* far mesa silhouettes */
    x.fillStyle = 'rgba(96,78,52,.85)';
    for (var k = 0; k < 3; k++) {
      x.beginPath(); x.moveTo(0, h * (0.66 + k * 0.02));
      for (var px2 = 0; px2 <= w; px2 += w / 40) {
        var yy = h * (0.62 + k * 0.03) + Math.sin(px2 * 0.02 + k) * h * 0.01 - r() * h * 0.02;
        x.lineTo(px2, yy);
      }
      x.lineTo(w, h); x.lineTo(0, h); x.fill();
    }
    return t;
  }
  /* ------------------------------------------------------------------ sprites */
  function flameTex(size) {
    var t = cv(size, size), x = t.x, r = G.rng(7);
    var cx = size / 2;
    for (var i = 0; i < 40; i++) {
      var w2 = size * (0.05 + r() * 0.30), h2 = size * (0.12 + r() * 0.42);
      var fx = cx + (r() - 0.5) * size * 0.22, fy = size * (0.35 + r() * 0.5);
      var g = x.createRadialGradient(fx, fy, 0, fx, fy, Math.max(w2, h2));
      var hue = r();
      g.addColorStop(0, hue < 0.5 ? 'rgba(255,255,220,.95)' : 'rgba(255,220,120,.9)');
      g.addColorStop(0.45, 'rgba(255,150,40,.6)');
      g.addColorStop(1, 'rgba(180,40,10,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(fx, fy, w2, h2, 0, 0, 7); x.fill();
    }
    /* core tongue */
    var cg = x.createLinearGradient(cx, size * 0.95, cx, size * 0.05);
    cg.addColorStop(0, 'rgba(255,240,190,.95)'); cg.addColorStop(0.4, 'rgba(255,170,60,.8)'); cg.addColorStop(1, 'rgba(255,120,20,0)');
    x.fillStyle = cg;
    x.beginPath(); x.moveTo(cx - size * 0.16, size * 0.92);
    x.quadraticCurveTo(cx - size * 0.30, size * 0.5, cx - size * 0.04, size * 0.10);
    x.quadraticCurveTo(cx + size * 0.34, size * 0.45, cx + size * 0.17, size * 0.92);
    x.closePath(); x.fill();
    return t;
  }
  function smokeTex(size) {
    var t = cv(size, size), x = t.x, r = G.rng(13);
    for (var i = 0; i < 60; i++) {
      var cx = size * (0.2 + r() * 0.6), cy = size * (0.2 + r() * 0.6), rad = size * (0.06 + r() * 0.24);
      var g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(210,205,198,' + (0.20 + r() * 0.3) + ')');
      g.addColorStop(1, 'rgba(120,116,110,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill();
    }
    return t;
  }
  function sparkTex(size) {
    var t = cv(size, size), x = t.x, cx = size / 2;
    var g = x.createRadialGradient(cx, cx, 0, cx, cx, cx);
    g.addColorStop(0, 'rgba(255,255,250,1)'); g.addColorStop(0.25, 'rgba(255,236,150,.9)');
    g.addColorStop(0.6, 'rgba(255,150,50,.35)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    x.strokeStyle = 'rgba(255,244,190,.85)';
    for (var i = 0; i < 6; i++) {
      var a = i * 1.047, len = cx * (0.5 + G.rng(90 + i)() * 0.6);
      x.lineWidth = 1 + i % 2;
      x.beginPath(); x.moveTo(cx, cx); x.lineTo(cx + Math.cos(a) * len, cx + Math.sin(a) * len); x.stroke();
    }
    return t;
  }
  function scorchTex(size) {
    var t = cv(size, size), x = t.x, r = G.rng(451), cx = size / 2;
    for (var i = 0; i < 90; i++) {
      var a = r() * 6.283, d = r() * cx * 0.85, rad = size * (0.02 + r() * 0.12);
      var px2 = cx + Math.cos(a) * d, py = cx + Math.sin(a) * d;
      x.fillStyle = 'rgba(14,10,6,' + (0.2 + r() * 0.5) + ')';
      x.beginPath(); x.arc(px2, py, rad, 0, 7); x.fill();
    }
    var g = x.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.9);
    g.addColorStop(0, 'rgba(10,7,4,.55)'); g.addColorStop(0.5, 'rgba(20,14,8,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return t;
  }
  function goreTex(size) {
    var t = cv(size, size), x = t.x, r = G.rng(666), cx = size / 2;
    for (var i = 0; i < 70; i++) {
      var a = r() * 6.283, d = r() * cx * 0.8;
      x.fillStyle = 'rgba(' + (120 + r() * 90 | 0) + ',' + (18 + r() * 26 | 0) + ',' + (12 + r() * 16 | 0) + ',' + (0.3 + r() * 0.6) + ')';
      x.beginPath(); x.ellipse(cx + Math.cos(a) * d, cx + Math.sin(a) * d, 3 + r() * 14, 3 + r() * 10, r() * 3, 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(240,230,210,.5)';
    for (var k = 0; k < 8; k++) { x.beginPath(); x.arc(cx + (r() - 0.5) * cx, cx + (r() - 0.5) * cx, 1.5 + r() * 3, 0, 7); x.fill(); }
    return t;
  }

  G.textures = {
    build: function () {
      var T = G.tex, S = 512;
      T.wall = img(wallTex(S, 6, 0xa89168));
      T.wallDark = img(wallTex(S, 3, 0x7d6647));
      T.wallRough = img(wallTex(S, 9, 0x93805c));
      T.floor = img(floorTex(S, 5, 0x9d8a68));
      T.marble = img(marbleTex(S, 0xcdbfa6));
      T.marbleBlue = img(marbleTex(S, 0x93a5b8));
      T.pillar = img(pillarTex(S, 0xb19a72));
      T.obelisk = img(obeliskTex(S, 0xa08a63));
      T.mural = img(muralTex(S, 0x9e5a34));
      T.muralBlue = img(muralTex(S, 0x5b6f8c));
      T.metal = img(metalTex(S, 0x53483a));
      T.water = img(waterTex(S));
      T.sky = spr(skyTex(1536, 768));
      T.sky.magFilter = THREE.LinearFilter;
      T.flame = spr(flameTex(256));
      T.smoke = spr(smokeTex(256));
      T.spark = spr(sparkTex(128));
      T.scorch = spr(scorchTex(256));
      T.gore = spr(goreTex(256));
      return T;
    },
    /* cloned texture with a given tiling, cached so we make few materials */
    tiled: function (key, rx, ry) {
      var T = G.tex, k = key + '@' + rx + 'x' + ry;
      if (T[k]) return T[k];
      var c = T[key].clone();
      c.repeat.set(rx, ry);
      c.needsUpdate = true;
      T[k] = c;
      return c;
    }
  };
})(window.G);
