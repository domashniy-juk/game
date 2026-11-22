/* synthesized WebAudio SFX: no audio files, all drawn from noise + oscillators */
(function (G) {
  'use strict';
  var A = (G.audio = { ctx: null, master: null, noise: null, amb: null, ready: false, started: false });

  function gainNode(dist, refMax) { /* crude positional falloff */
    if (!dist) return 1; /* the gun is at the ear: no falloff */
    var d = Math.hypot(dist.x - G.playerPos.x, dist.z - G.playerPos.z);
    var v = G.clamp(1 - d / (refMax || 90), 0.02, 1);
    return v * v;
  }

  A.init = function () {
    if (A.ready) return;
    var C = (window.AudioContext || window.webkitAudioContext);
    if (!C) return;
    var ctx = (A.ctx = new C());
    A.master = ctx.createGain();
    A.master.gain.value = 0.85;
    A.master.connect(ctx.destination);

    /* one shared noise buffer used by every percussive sound */
    var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    var r = G.rng(4242);
    for (var i = 0; i < len; i++) {
      var x = r();
      d[i] = (x * 2 - 1) * (1 - 0.65 * Math.max(0, Math.sin(i / len * Math.PI)));
    }
    A.noise = buf;
    A.ready = true;
  };

  function srcNode(ctx, rate) {
    var s = ctx.createBufferSource();
    s.buffer = A.noise;
    s.loop = true;
    s.playbackRate.value = rate || 1;
    s.start(0, Math.random() * 1.8);
    return s;
  }
  /* noise burst: envelope + optional filter sweep */
  function burst(o) {
    var ctx = A.ctx, t = ctx.currentTime + (o.t || 0);
    var s = srcNode(ctx, o.rate || 1);
    var g = ctx.createGain();
    var f = ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.value = o.freq || 2200;
    if (o.sweep) { f.frequency.setValueAtTime(o.freq, t); f.frequency.exponentialRampToValueAtTime(o.sweep, t + o.dur); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.peak || 0.5, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.2));
    s.connect(f); f.connect(g); g.connect(A.master);
    s.stop(t + (o.dur || 0.2) + 0.05);
    return { g: g, t: t };
  }
  /* pitched tone with an envelope, optionally gliding */
  function tone(o) {
    var ctx = A.ctx, t = ctx.currentTime + (o.t || 0);
    var osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.dur || 0.3));
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.peak || 0.3, t + (o.a || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.3));
    osc.connect(g); g.connect(A.master);
    osc.start(t); osc.stop(t + (o.dur || 0.3) + 0.05);
    return g;
  }
  function vol(o, dist) { /* scale a peak by distance */
    o.peak = (o.peak || 0.4) * gainNode(dist, o.ref || 90);
    return o;
  }

  /* ------------------------------------------------------------------ the set */
  A.shoot = function (side) { /* machine gun: dry clack + chest-thump, alternates */
    if (!A.ready) return;
    var k = (side % 2) ? 1.16 : 1;
    burst(vol({ rate: 1.1 * k, freq: 5200, sweep: 900, a: 0.002, dur: 0.085, peak: 0.34 }));
    tone(vol({ type: 'triangle', f0: 190 * k, f1: 60, a: 0.003, dur: 0.11, peak: 0.42 }));
    burst(vol({ rate: 0.55, freq: 380, a: 0.004, dur: 0.15, peak: 0.20 }));
  };
  A.dryFire = function () {
    if (!A.ready) return;
    tone({ type: 'square', f0: 1400, f1: 900, a: 0.002, dur: 0.05, peak: 0.12 });
  };
  A.reload = function () {
    if (!A.ready) return;
    for (var i = 0; i < 4; i++) {
      burst({ rate: 1.3 + i * 0.12, freq: 3200, sweep: 1200, a: 0.002, dur: 0.06 + i * 0.01, peak: 0.13, t: i * 0.28 });
      tone({ type: 'square', f0: 700 + i * 120, f1: 300, a: 0.004, dur: 0.09, peak: 0.10, t: i * 0.28 });
    }
  };
  A.whiz = function (p) { /* ricochet whip past the ear */
    if (!A.ready) return;
    burst(vol({ rate: 1.6, type: 'highpass', freq: 1200, sweep: 3400, a: 0.01, dur: 0.22, peak: 0.30, ref: 26 }, p));
    tone(vol({ type: 'sine', f0: 2600, f1: 700, a: 0.01, dur: 0.18, peak: 0.06, ref: 26 }, p));
  };
  A.impact = function (p, soft) { /* bullet hitting stone vs wood */
    if (!A.ready) return;
    burst(vol({ rate: soft ? 0.8 : 1.25, freq: soft ? 900 : 2600, sweep: 300, a: 0.002, dur: 0.13, peak: 0.24, ref: 40 }, p));
  };
  A.explosion = function (p, big) { /* winged one self-destructing */
    if (!A.ready) return;
    var d = vol({ rate: 0.42, freq: 420, sweep: 110, a: 0.006, dur: big ? 0.9 : 0.55, peak: big ? 0.95 : 0.6, ref: 120 }, p);
    burst(d);
    tone(vol({ type: 'sine', f0: 120, f1: 34, a: 0.006, dur: big ? 1.1 : 0.7, peak: big ? 0.9 : 0.55, ref: 120 }, p));
    for (var i = 0; i < (big ? 7 : 4); i++) {
      burst(vol({ rate: 1.5 + Math.random(), freq: 3000, sweep: 800, a: 0.002, dur: 0.09, peak: 0.2, t: 0.05 + Math.random() * 0.25, ref: 70 }, p));
    }
  };
  A.screech = function (p, big) { /* the winged scream */
    if (!A.ready) return;
    var v = vol({ type: 'sawtooth', f0: big ? 180 : 420, f1: big ? 90 : 160, a: 0.05, dur: big ? 1.1 : 0.6, peak: big ? 0.45 : 0.30, ref: 110 }, p);
    tone(v);
    tone(vol({ type: 'square', f0: big ? 900 : 1500, f1: 300, a: 0.03, dur: 0.35, peak: 0.12, ref: 80 }, p));
  };
  A.splat = function (p) { /* wet gib / enemy blown apart */
    if (!A.ready) return;
    burst(vol({ rate: 0.9, freq: 1200, sweep: 300, a: 0.004, dur: 0.28, peak: 0.35, ref: 60 }, p));
    tone(vol({ type: 'sine', f0: 300, f1: 90, a: 0.005, dur: 0.3, peak: 0.22, ref: 60 }, p));
  };
  A.dart = function (p) { /* enemy projectile hissing out */
    if (!A.ready) return;
    burst(vol({ rate: 1.9, freq: 1800, sweep: 600, a: 0.004, dur: 0.16, peak: 0.16, ref: 60 }, p));
  };
  A.coin = function () { /* grabbing a powerup */
    if (!A.ready) return;
    tone({ type: 'sine', f0: 880, f1: 1320, a: 0.004, dur: 0.14, peak: 0.22 });
    tone({ type: 'triangle', f0: 1660, f1: 2200, a: 0.004, dur: 0.2, peak: 0.12, t: 0.06 });
  };
  A.mech = function (p, long) { /* gates, lifts, big switch */
    if (!A.ready) return;
    burst(vol({ rate: 0.7, freq: 800, sweep: 260, a: 0.05, dur: long ? 1.4 : 0.6, peak: 0.3, ref: 120 }, p));
    tone(vol({ type: 'square', f0: 140, f1: 70, a: 0.05, dur: long ? 1.4 : 0.6, peak: 0.2, ref: 120 }, p));
  };
  A.step = function (hard) {
    if (!A.ready) return;
    burst({ rate: 0.5 + Math.random() * 0.3, freq: hard ? 1400 : 700, sweep: 200, a: 0.002, dur: 0.11, peak: 0.12 * (hard ? 1.4 : 1) });
  };
  A.pickupWhine = function () {
    if (!A.ready) return;
    tone({ type: 'sine', f0: 320, f1: 1200, a: 0.05, dur: 0.4, peak: 0.10 });
  };

  A.ambient = function () { /* hot desert wind + distant rumble, one long loop */
    if (!A.ready || A.started) return;
    A.started = true;
    var ctx = A.ctx;
    var s = srcNode(ctx, 0.34);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    var g = ctx.createGain(); g.gain.value = 0.10;
    var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.13;
    var lg = ctx.createGain(); lg.gain.value = 0.045;
    s.connect(f); f.connect(g);
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(A.master);
    A.amb = { s: s, g: g, lfo: lfo };
    A.amb.s2 = lfo;
  };

  /* the player taking a hit: a wet grunt under the chest */
  A.pain = function (hard) {
    if (!A.ready) return;
    tone({ type: 'sine', f0: hard ? 190 : 250, f1: 80, dur: hard ? 0.42 : 0.2, a: 0.02, peak: hard ? 0.5 : 0.3 });
    burst({ rate: hard ? 0.55 : 0.8, freq: 900, sweep: 300, a: 0.004, dur: 0.16, peak: hard ? 0.3 : 0.18 });
  };
  /* the level is lost: descending klaxon */
  A.wail = function () {
    if (!A.ready) return;
    for (var i = 0; i < 3; i++) {
      tone({ type: 'sawtooth', f0: 420 - i * 130, f1: 60, dur: 0.5, a: 0.02, peak: 0.3, t: i * 0.52 });
    }
  };

  A.setMuted = function (m) {
    if (!A.ready) return;
    A.master.gain.value = m ? 0 : 0.85;
  };
})(window.G);
