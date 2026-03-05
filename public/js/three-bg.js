/* ============================================================
   StudentLife OS — Cinematic 3D Universe Background
   Custom GLSL shaders · Galaxy spiral · Holographic rings
   Aurora nebula · Mouse parallax · Shooting stars
   ============================================================ */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  // ── RENDERER ──────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05050f, 0.008);

  const camera = new THREE.PerspectiveCamera(
    70, window.innerWidth / window.innerHeight, 0.1, 500
  );
  camera.position.set(0, 12, 55);
  camera.lookAt(0, 0, 0);


  // ── CUSTOM PARTICLE SHADER ─────────────────────────────────
  const particleVert = `
    attribute float aSize;
    attribute vec3  aColor;
    attribute float aPhase;
    uniform   float uTime;
    varying   vec3  vColor;
    varying   float vAlpha;

    void main(){
      vColor = aColor;
      vec3 pos = position;
      pos.y += sin(uTime * 0.3 + aPhase) * 0.2;
      pos.x += cos(uTime * 0.2 + aPhase * 1.3) * 0.15;

      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      float dist = length(mv.xyz);
      vAlpha = smoothstep(180.0, 5.0, dist) * 0.9;
      gl_PointSize = aSize * (280.0 / -mv.z);
      gl_Position  = projectionMatrix * mv;
    }
  `;

  const particleFrag = `
    varying vec3  vColor;
    varying float vAlpha;

    void main(){
      vec2  uv = gl_PointCoord - 0.5;
      float d  = length(uv);
      if(d > 0.5) discard;

      float halo = 1.0 - d * 2.0;
      halo = pow(halo, 2.5);

      float core = clamp(1.0 - d * 5.0, 0.0, 1.0);
      core = pow(core, 1.8);

      vec3  col   = vColor + vec3(core * 0.6);
      float alpha = (halo * 0.7 + core * 0.3) * vAlpha;
      gl_FragColor = vec4(col, alpha);
    }
  `;

  function makeShaderMat(uniforms) {
    return new THREE.ShaderMaterial({
      vertexShader:   particleVert,
      fragmentShader: particleFrag,
      uniforms,
      transparent:  true,
      depthWrite:   false,
      blending:     THREE.AdditiveBlending,
      vertexColors: true,
    });
  }

  // ── COLOUR PALETTES ──────────────────────────────────────
  const INDIGO  = new THREE.Color('#6366f1');
  const CYAN    = new THREE.Color('#06b6d4');
  const PINK    = new THREE.Color('#f472b6');
  const VIOLET  = new THREE.Color('#818cf8');
  const SKY     = new THREE.Color('#38bdf8');
  const WHITE   = new THREE.Color('#ffffff');
  const GOLD    = new THREE.Color('#fbbf24');
  const GREEN   = new THREE.Color('#34d399');

  const corePalette  = [INDIGO, CYAN, VIOLET, SKY, WHITE];
  const outerPalette = [PINK, INDIGO, CYAN, VIOLET];

  // ── GALAXY SPIRAL ────────────────────────────────────────
  (function buildGalaxy() {
    const COUNT   = 7000;
    const ARMS    = 3;
    const SPIN    = 1.4;
    const SCATTER = 0.38;
    const RADIUS  = 55;

    const pos    = new Float32Array(COUNT * 3);
    const cols   = new Float32Array(COUNT * 3);
    const sizes  = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const arm   = i % ARMS;
      const frac  = (i / COUNT);
      const r     = Math.pow(Math.random(), 0.5) * RADIUS;
      const theta = (arm / ARMS) * Math.PI * 2
                  + frac * Math.PI * 4
                  + r * SPIN * 0.04;

      const scatter = (Math.random() + Math.random() - 1.0) * r * SCATTER;
      const height  = (Math.random() - 0.5) * (2.5 - r * 0.04);

      pos[i * 3]     = Math.cos(theta) * r + scatter * Math.sin(theta);
      pos[i * 3 + 1] = height;
      pos[i * 3 + 2] = Math.sin(theta) * r - scatter * Math.cos(theta);

      phases[i] = Math.random() * Math.PI * 2;
      sizes[i]  = Math.random() * 1.8 + 0.3;

      const t  = r / RADIUS;
      const c  = t < 0.3
                   ? corePalette[Math.floor(Math.random() * corePalette.length)]
                   : outerPalette[Math.floor(Math.random() * outerPalette.length)];
      const dimmed = c.clone().multiplyScalar(Math.random() * 0.5 + 0.5);
      cols[i * 3]     = dimmed.r;
      cols[i * 3 + 1] = dimmed.g;
      cols[i * 3 + 2] = dimmed.b;
    }

    const geo   = new THREE.BufferGeometry();
    const uTime = { uTime: { value: 0 } };
    geo.setAttribute('position', new THREE.BufferAttribute(pos,    3));
    geo.setAttribute('aColor',   new THREE.BufferAttribute(cols,   3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes,  1));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
    const mat = makeShaderMat(uTime);

    const pts = new THREE.Points(geo, mat);
    pts.rotation.x = 0.25;
    pts.userData.uTime = uTime.uTime;
    scene.add(pts);
    window._galaxyMesh = pts;
  })();

  // ── NEBULA CLOUD ─────────────────────────────────────────
  (function buildNebula() {
    const COUNT = 2500;
    const pos   = new Float32Array(COUNT * 3);
    const cols  = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const nebulaCols = [INDIGO, CYAN, PINK, VIOLET];

    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 18 + Math.pow(Math.random(), 2) * 48;

      pos[i * 3]     = Math.sin(phi) * Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.cos(phi) * r * 0.4;
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;

      phase[i] = Math.random() * Math.PI * 2;
      sizes[i] = Math.random() * 3.5 + 0.8;

      const c = nebulaCols[Math.floor(Math.random() * nebulaCols.length)].clone();
      c.multiplyScalar(Math.random() * 0.4 + 0.1);
      cols[i * 3]     = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }

    const geo   = new THREE.BufferGeometry();
    const uTime = { uTime: { value: 0 } };
    geo.setAttribute('position', new THREE.BufferAttribute(pos,   3));
    geo.setAttribute('aColor',   new THREE.BufferAttribute(cols,  3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phase, 1));
    const mat = makeShaderMat(uTime);

    const pts = new THREE.Points(geo, mat);
    pts.userData.uTime = uTime.uTime;
    scene.add(pts);
    window._nebulaMesh = pts;
  })();

  // ── HOLOGRAPHIC TORUS RINGS ──────────────────────────────
  const ringVert = `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;
  const ringFrag = `
    varying vec2  vUv;
    uniform float uTime;
    uniform vec3  uColor;

    void main(){
      float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
      float t     = mod(angle / (3.14159 * 2.0) + uTime * 0.18, 1.0);
      float dash  = step(0.55, fract(t * 8.0));

      float band  = abs(vUv.y - 0.5) * 2.0;
      float glow  = pow(1.0 - band, 3.0);
      float alpha = glow * (0.15 + dash * 0.5);
      gl_FragColor = vec4(uColor + vec3(dash * 0.4), alpha);
    }
  `;

  const rings = [];
  const ringDefs = [
    { r: 12, tube: 0.06, color: INDIGO,  tilt: [0.4,  0,    0   ], speed:  0.35 },
    { r: 20, tube: 0.05, color: CYAN,    tilt: [0.9,  0.5,  0   ], speed: -0.22 },
    { r: 8,  tube: 0.08, color: PINK,    tilt: [-0.3, 0.8,  0.3 ], speed:  0.55 },
    { r: 30, tube: 0.04, color: VIOLET,  tilt: [0.2,  0.2, -0.4 ], speed: -0.14 },
    { r: 16, tube: 0.05, color: SKY,     tilt: [1.2, -0.4,  0.2 ], speed:  0.28 },
  ];

  ringDefs.forEach(def => {
    const geo = new THREE.TorusGeometry(def.r, def.tube, 3, 180);
    const mat = new THREE.ShaderMaterial({
      vertexShader:   ringVert,
      fragmentShader: ringFrag,
      uniforms: {
        uTime:  { value: 0 },
        uColor: { value: def.color },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(...def.tilt);
    mesh.userData.speed = def.speed;
    scene.add(mesh);
    rings.push(mesh);
  });

  // ── CRYSTALLINE ICOSAHEDRA ───────────────────────────────
  const crystalVert = `
    varying vec3  vNormal;
    void main(){
      vNormal     = normalMatrix * normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;
  const crystalFrag = `
    varying vec3  vNormal;
    uniform float uTime;
    uniform vec3  uColor;
    uniform float uId;
    void main(){
      vec3  n   = normalize(vNormal);
      float rim = 1.0 - abs(dot(n, vec3(0., 0., 1.)));
      rim = pow(rim, 2.5);
      float pulse = 0.6 + 0.4 * sin(uTime * 1.2 + uId * 2.3);
      gl_FragColor = vec4(uColor, rim * pulse * 0.55);
    }
  `;

  const crystals = [];
  const crystalData = [
    { pos: [-28,  8,  -20], scale: 3.5, color: INDIGO },
    { pos: [ 30, -5,  -25], scale: 2.8, color: CYAN   },
    { pos: [-15,-12,  -15], scale: 2.2, color: PINK   },
    { pos: [ 18, 14,  -18], scale: 3.0, color: VIOLET },
    { pos: [  0, -8,  -30], scale: 4.0, color: SKY    },
    { pos: [-38,  3,  -35], scale: 2.5, color: GOLD   },
    { pos: [ 42,-10,  -28], scale: 3.2, color: GREEN  },
  ];

  crystalData.forEach((d, i) => {
    const geo  = new THREE.IcosahedronGeometry(1, 1);
    const mat  = new THREE.ShaderMaterial({
      vertexShader:   crystalVert,
      fragmentShader: crystalFrag,
      uniforms: {
        uTime:  { value: 0 },
        uColor: { value: d.color },
        uId:    { value: i },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.DoubleSide,
    });
    const solid = new THREE.Mesh(geo, mat);
    const wMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: d.color, wireframe: true, transparent: true, opacity: 0.06 })
    );
    const group = new THREE.Group();
    group.add(solid, wMesh);
    group.position.set(...d.pos);
    group.scale.setScalar(d.scale);
    group.userData = {
      rotSpeed:    new THREE.Vector3(
        (Math.random() - 0.5) * 0.004,
        (Math.random() - 0.5) * 0.006,
        (Math.random() - 0.5) * 0.003
      ),
      floatAmp:    Math.random() * 2.5 + 1,
      floatSpeed:  Math.random() * 0.4 + 0.2,
      floatOffset: Math.random() * Math.PI * 2,
      baseY: d.pos[1],
      uTime: mat.uniforms.uTime,
    };
    scene.add(group);
    crystals.push(group);
  });

  // ── CENTRAL GLOWING CORE ────────────────────────────────
  (function buildCore() {
    const cVert = `
      varying vec3 vNormal;
      void main(){
        vNormal     = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `;
    const cFrag = `
      varying vec3  vNormal;
      uniform float uTime;
      void main(){
        vec3  n   = normalize(vNormal);
        float rim = 1.0 - abs(dot(n, normalize(vec3(0.3,0.5,1.0))));
        rim = pow(rim, 1.8);
        float pulse = 0.5 + 0.5 * sin(uTime * 2.0);
        vec3  col   = mix(vec3(0.39,0.40,0.95), vec3(0.03,0.71,0.83), rim);
        gl_FragColor = vec4(col, rim * 0.22 * (0.8 + 0.2 * pulse));
      }
    `;
    const sMat = new THREE.ShaderMaterial({
      vertexShader: cVert, fragmentShader: cFrag,
      uniforms: { uTime: { value: 0 } },
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(3.5, 64, 64), sMat);
    sphere.userData.uTime = sMat.uniforms.uTime;
    scene.add(sphere);
    window._coreMesh = sphere;

    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(5.5, 32, 32),
      new THREE.MeshBasicMaterial({
        color: INDIGO, transparent: true, opacity: 0.04,
        blending: THREE.AdditiveBlending, side: THREE.BackSide,
      })
    ));
  })();

  // ── GRID FLOOR ──────────────────────────────────────────
  (function buildGrid() {
    [
      { size: 120, div: 30,  col: 0x6366f1, op: 0.045 },
      { size: 120, div: 120, col: 0x818cf8, op: 0.018 },
    ].forEach(g => {
      const grid = new THREE.GridHelper(g.size, g.div, g.col, g.col);
      grid.material.transparent = true;
      grid.material.opacity     = g.op;
      grid.material.blending    = THREE.AdditiveBlending;
      grid.position.y = -20;
      scene.add(grid);
    });
  })();

  // ── SHOOTING STARS ──────────────────────────────────────
  const shootingStars = [];
  function spawnShootingStar() {
    const geo = new THREE.BufferGeometry();
    const len = Math.random() * 18 + 8;
    const pts = new Float32Array(6);
    pts[0] = (Math.random() - 0.5) * 120;
    pts[1] = (Math.random() * 30 + 10);
    pts[2] = (Math.random() - 0.5) * 40 - 10;
    const dx = (Math.random() - 0.5);
    const dy = -(Math.random() * 1.5 + 0.5);
    pts[3] = pts[0] + dx * len;
    pts[4] = pts[1] + dy * len;
    pts[5] = pts[2];
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: Math.random() > 0.5 ? CYAN : WHITE,
      transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    line.userData = { life: 0, maxLife: Math.random() * 60 + 40 };
    scene.add(line);
    shootingStars.push(line);
  }

  // ── MOUSE ────────────────────────────────────────────────
  const target = new THREE.Vector2(0, 0);
  const smooth = new THREE.Vector2(0, 0);

  document.addEventListener('mousemove', e => {
    target.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
    target.y = -(e.clientY / window.innerHeight - 0.5) * 2;
  });
  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    target.x =  (t.clientX / window.innerWidth  - 0.5) * 2;
    target.y = -(t.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // ── ANIMATION LOOP ───────────────────────────────────────
  const clock = new THREE.Clock();
  let frameCount = 0;

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    frameCount++;

    smooth.x += (target.x - smooth.x) * 0.035;
    smooth.y += (target.y - smooth.y) * 0.035;

    // Gentle cinematic camera orbit
    camera.position.x  = Math.sin(elapsed * 0.04) * 8 + smooth.x * 5;
    camera.position.y  = 12 + smooth.y * 4 + Math.sin(elapsed * 0.06) * 3;
    camera.position.z  = 55 + Math.cos(elapsed * 0.05) * 6;
    camera.lookAt(0, 0, 0);

    // Galaxy
    if (window._galaxyMesh) {
      window._galaxyMesh.rotation.y = elapsed * 0.025;
      window._galaxyMesh.userData.uTime.value = elapsed;
    }
    if (window._nebulaMesh) {
      window._nebulaMesh.rotation.y = -elapsed * 0.012;
      window._nebulaMesh.userData.uTime.value = elapsed;
    }
    if (window._coreMesh) {
      window._coreMesh.userData.uTime.value = elapsed;
      window._coreMesh.rotation.y = elapsed * 0.15;
    }

    // Rings
    rings.forEach(r => {
      r.rotation.z += r.userData.speed * 0.005;
      r.rotation.x += r.userData.speed * 0.002;
      r.material.uniforms.uTime.value = elapsed;
    });

    // Crystals
    crystals.forEach(g => {
      const d = g.userData;
      g.rotation.x += d.rotSpeed.x;
      g.rotation.y += d.rotSpeed.y;
      g.rotation.z += d.rotSpeed.z;
      g.position.y  = d.baseY + Math.sin(elapsed * d.floatSpeed + d.floatOffset) * d.floatAmp;
      d.uTime.value  = elapsed;
    });

    // Shooting stars
    if (frameCount % 120 === 0 && Math.random() > 0.3) spawnShootingStar();
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i];
      s.userData.life++;
      s.material.opacity = 1.0 - s.userData.life / s.userData.maxLife;
      s.position.x += 0.4;
      s.position.y -= 0.25;
      if (s.userData.life >= s.userData.maxLife) {
        scene.remove(s);
        shootingStars.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  animate();
})();
