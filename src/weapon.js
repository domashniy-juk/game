/* THE WEAPON: one big belt-fed machine gun held in the view.
   Full-auto, tracers, brass, muzzle flash, camera kick. */
(function (G) {
  'use strict';
  var W = (G.weapon = { built: false, group: null, cool: 0, shot: 0, dryAt: -9 });

  function M(col, shine) {
    return new THREE.MeshPhongMaterial({
      map: G.textures.tiled('metal', 2, 2),
      color: col,
      specular: 0x2a2620,
      shininess: shine === undefined ? 20 : shine
    });
  }

  /* ------------------------------------------------------------------ the held gun */
  W.build = function (camera) {
    var grp = new THREE.Group();
    camera.add(grp);

    var steel = M(0x55503f, 30);
    var dark = M(0x2f2c26, 12);
    var brass = M(0x8f7a36, 36);

    function B(w, h, d, x, y, z, m) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      grp.add(mesh);
      return mesh;
    }

    B(0.34, 0.22, 1.10, 0.00, 0.00, -0.10, steel);   /* receiver */
    B(0.20, 0.14, 0.50, 0.00, 0.02, -0.74, dark);    /* receiver top */
    B(0.22, 0.18, 0.30, 0.16, 0.10, 0.16, dark);     /* belt box   */
    B(0.10, 0.34, 0.16, 0.02, -0.24, 0.20, dark);    /* pistol grip */
    B(0.08, 0.12, 0.54, 0.00, -0.05, 0.62, dark);    /* stock       */
    B(0.05, 0.16, 0.05, 0.00, 0.18, -0.52, dark);    /* front sight */
    B(0.16, 0.05, 0.06, 0.00, 0.08, -0.60, dark);    /* sight rail  */

    var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.95, 10), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.82);
    grp.add(barrel);

    var band = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 10), brass);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.02, -0.98);
    grp.add(band);

    /* the belt: links vanish as the rounds get eaten */
    var links = [];
    for (var i = 0; i < 10; i++) {
      var link = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), i % 2 ? brass : dark);
      link.position.set(0.22, 0.16 - i * 0.014, 0.32 + i * 0.14);
      link.rotation.z = 0.3;
      grp.add(link);
      links.push(link);
    }
    grp.traverse(function (o) {
      if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; }
    });
    grp.position.set(0.22, -0.26, -0.34);
    W.group = grp;
    W.links = links;
    W.built = true;
  };

  /* ------------------------------------------------------------------ idle sway, recoil, reload dip */
  W.update = function (dt) {
    if (!W.group) return;
    W.cool = Math.max(0, W.cool - dt);
    W.kick = G.damp(W.kick || 0, 0, 11, dt);

    var run = G.clamp(G.player.speed() / G.cfg.runSpeed, 0, 1.2);
    var bobY = Math.sin(G.state.time * 7.4) * 0.012 * run;
    var sway = Math.cos(G.state.time * 3.7) * 0.010 * run;

    var dip = 0;
    if (G.state.reloadT > 0) {
      var p = 1 - G.clamp(G.state.reloadT / G.cfg.reloadTime, 0, 1);
      dip = Math.sin(p * Math.PI) * 0.14;
    }
    W.group.position.set(0.22 + sway, -0.26 + bobY - dip, -0.34 + W.kick * 0.10);
    W.group.rotation.set(-W.kick * 0.5 - dip * 2.0, sway * 2, sway);

    var left = Math.ceil(G.clamp(G.state.ammo / G.cfg.beltSize, 0, 1) * W.links.length);
    for (var i = 0; i < W.links.length; i++) W.links[i].visible = i < left;
  };

  /* ------------------------------------------------------------------ firing */
  W.canFire = function () {
    if (!G.inputState.firing) return false;
    if (G.state.reloadT > 0 || G.state.paused || G.state.gameOver) return false;
    return W.cool <= 0;
  };

  /* world point a little in front of the eye, over the gun */
  function muzzlePoint() {
    var V = G.view;
    var dist = 1.4;
    var cp = Math.cos(V.pitch), sp = Math.sin(V.pitch);
    return {
      x: G.playerPos.x - Math.sin(V.yaw) * cp * dist + Math.cos(V.yaw) * 0.26,
      y: G.playerPos.y + V.height - 0.22 + sp * dist,
      z: G.playerPos.z - Math.cos(V.yaw) * cp * dist - Math.sin(V.yaw) * 0.26
    };
  }

  /* distance to the first hit along a ray against an enemy's sphere */
  function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
    var vx = cx - ox, vy = cy - oy, vz = cz - oz;
    var along = vx * dx + vy * dy + vz * dz;
    if (along < 0) return -1;
    var px = ox + dx * along - cx;
    var py = oy + dy * along - cy;
    var pz = oz + dz * along - cz;
    var perp2 = px * px + py * py + pz * pz;
    if (perp2 > r * r) return -1;
    return along - Math.sqrt(r * r - perp2);
  }

  /* one round of the machine gun */
  W.fire = function () {
    if (G.state.ammo <= 0) {
      if (!W.dryAt || G.state.time - W.dryAt > 0.35) {
        G.audio.dryFire();
        W.dryAt = G.state.time;
      }
      W.cool = 0.2;
      return false;
    }
    var s = G.state, C = G.cfg;
    s.ammo -= 1;
    W.shot += 1;
    W.cool = C.fireDelay;
    W.kick = 1;
    s.fireCooldown = W.cool;

    /* aim ray, loosened a little like a real MG */
    var d = G.player.aimDir();
    var dx = d.x + (Math.random() - 0.5) * C.spread;
    var dy = d.y + (Math.random() - 0.5) * C.spread;
    var dz = d.z + (Math.random() - 0.5) * C.spread;
    var n = Math.hypot(dx, dy, dz) || 1;
    dx /= n; dy /= n; dz /= n;

    var ox = G.playerPos.x;
    var oy = G.playerPos.y + G.view.height;
    var oz = G.playerPos.z;

    /* first: anything with a body in the way */
    var eHit = null, bt = 0;
    for (var i = 0; i < G.world.enemies.length; i++) {
      var e = G.world.enemies[i];
      if (!e || e.dead) continue;
      var cy = e.type === 'runner' ? e.y + 1.5 : e.y;
      var t = raySphere(ox, oy, oz, dx, dy, dz, e.x, cy, e.z, e.r + 0.25);
      if (t > 0 && (!bt || t < bt)) { bt = t; eHit = e; }
    }
    /* then the walls */
    var wall = G.rayBox(ox, oy, oz, dx, dy, dz, C.bulletRange);
    var wt = wall ? wall.t : Infinity;

    var mz = muzzlePoint();
    if (eHit && bt <= wt) {
      var hx = ox + dx * bt, hy = oy + dy * bt, hz = oz + dz * bt;
      G.fx.tracer(mz.x, mz.y, mz.z, hx, hy, hz, 0.08, 0.035);
      G.enemies.takeHit({ e: eHit, x: hx, y: hy, z: hz });
    } else if (wall) {
      var wx = ox + dx * wall.t, wy = oy + dy * wall.t, wz = oz + dz * wall.t;
      G.fx.tracer(mz.x, mz.y, mz.z, wx, wy, wz, 0.08, 0.03);
      G.fx.burstHit(wx, wy, wz, wall.nx, wall.ny, wall.nz, false);
      G.fx.decal(wx, wy, wz, wall.nx, wall.ny, wall.nz, 0.6, false);
      G.audio.impact({ x: wx, z: wz }, false);
    }

    /* muzzle flash + brass + kick */
    G.fx.muzzle(mz.x, mz.y, mz.z, false);
    G.fx.flash(0.9);
    G.fx.sparks(mz.x, mz.y, mz.z, 6, 10, 0.12, 0.1, 0xffcf6a);
    G.fx.puff(mz.x, mz.y, mz.z, 1.2, 0.5, 0.5, 0x8f887a);
    G.fx.shell(mz.x + 0.3, mz.y + 0.1, mz.z, 2.2, 1.4, 0.6);
    G.audio.shoot(W.shot % 2);
    G.player.shake(0.18);
    G.player.kickCamera(0.02, (Math.random() - 0.5) * 0.01);
    return true;
  };

  W.reload = function () {
    var s = G.state;
    if (s.reloadT > 0) return false;
    if (s.ammo >= G.cfg.beltSize || s.spare <= 0) return false;
    s.reloadT = G.cfg.reloadTime;
    s.spare -= 1;
    G.audio.reload();
    G.say('BELT: NEW', 'sys');
    return true;
  };
})(window.G);
