/* ============ ליבה אנימטיבית ============ */
const cv = document.getElementById('core');
const ctx = cv.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);
let use3D = false; /* נהפוך ל-true אם הדמות התלת-מימדית נטענת בהצלחה */
function sizeCanvas(){
  const s = Math.min(window.innerWidth * 0.7, window.innerHeight * 0.45, 420);
  cv.style.width = cv.style.height = s + 'px';
  cv.width = cv.height = s * DPR;
}
sizeCanvas();
addEventListener('resize', sizeCanvas);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let t = 0;
const particles = Array.from({length: 46}, (_, i) => ({
  a: Math.random() * Math.PI * 2,
  r: 0.62 + Math.random() * 0.33,
  sp: (0.002 + Math.random() * 0.006) * (i % 2 ? 1 : -1),
  sz: 0.8 + Math.random() * 1.6
}));

function draw(){
  const W = cv.width, C = W / 2, R = W * 0.36;
  ctx.clearRect(0, 0, W, W);
  t += reduced ? 0.15 : 1;

  const energy = mode === State.SPEAK ? 0.6 + audioLevel
               : mode === State.LISTEN ? 0.45 + audioLevel
               : mode === State.THINK ? 0.5 + 0.25 * Math.sin(t * 0.09)
               : 0.22 + 0.06 * Math.sin(t * 0.025);
  const active = mode !== State.IDLE;

  const g = ctx.createRadialGradient(C, C, R * 0.1, C, C, R * 1.5);
  g.addColorStop(0, `rgba(79,216,255,${0.16 * energy + 0.05})`);
  g.addColorStop(1, 'rgba(79,216,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);

  const rings = [
    { r: R * 0.98, w: 1.2, seg: 3, gap: 0.5, sp: 0.004, op: 0.55 },
    { r: R * 0.84, w: 2.2, seg: 2, gap: 0.9, sp: -0.007, op: 0.8 },
    { r: R * 0.70, w: 1.0, seg: 6, gap: 0.25, sp: 0.011, op: 0.45 },
  ];
  rings.forEach(rg => {
    ctx.lineWidth = rg.w * DPR;
    ctx.strokeStyle = `rgba(79,216,255,${rg.op * (0.5 + energy * 0.6)})`;
    const off = t * rg.sp;
    const arc = (Math.PI * 2) / rg.seg;
    for (let i = 0; i < rg.seg; i++) {
      ctx.beginPath();
      ctx.arc(C, C, rg.r, off + i * arc, off + i * arc + arc * (1 - rg.gap * 0.4));
      ctx.stroke();
    }
  });

  ctx.strokeStyle = `rgba(79,216,255,${0.25 + energy * 0.3})`;
  ctx.lineWidth = 1 * DPR;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + t * 0.0012;
    const long = i % 5 === 0;
    const r1 = R * 1.08, r2 = r1 + (long ? 7 : 3) * DPR;
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1);
    ctx.lineTo(C + Math.cos(a) * r2, C + Math.sin(a) * r2);
    ctx.stroke();
  }

  ctx.fillStyle = `rgba(191,238,255,${0.5 + energy * 0.4})`;
  particles.forEach(p => {
    p.a += p.sp * (active ? 1.8 : 1);
    const x = C + Math.cos(p.a) * R * p.r;
    const y = C + Math.sin(p.a) * R * p.r;
    ctx.beginPath();
    ctx.arc(x, y, p.sz * DPR * (0.7 + energy * 0.5), 0, Math.PI * 2);
    ctx.fill();
  });

  const coreR = R * 0.5 * (1 + (mode === State.SPEAK ? audioLevel * 0.25 : 0));
  const cg = ctx.createRadialGradient(C, C, 0, C, C, coreR);
  cg.addColorStop(0, `rgba(191,238,255,${0.85 * energy + 0.1})`);
  cg.addColorStop(0.55, `rgba(79,216,255,${0.4 * energy})`);
  cg.addColorStop(1, 'rgba(79,216,255,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(C, C, coreR, 0, Math.PI * 2);
  ctx.fill();

  if (mode === State.SPEAK || mode === State.LISTEN) {
    ctx.strokeStyle = 'rgba(191,238,255,.7)';
    ctx.lineWidth = 1.6 * DPR;
    ctx.beginPath();
    const wR = R * 0.42, N = 90;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const wob = Math.sin(a * 7 + t * 0.25) * audioLevel * 14 * DPR
                + Math.sin(a * 3 - t * 0.18) * audioLevel * 8 * DPR;
      const x = C + Math.cos(a) * (wR + wob);
      const y = C + Math.sin(a) * (wR + wob);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  audioLevel *= 0.92;
  if (use3D) return; /* הדמות התלת-מימדית השתלטה — עוצרים את לולאת ה-2D */
  requestAnimationFrame(draw);
}
draw();

/* לחיצה על הליבה עוצרת דיבור/חשיבה */
cv.onclick = () => cancelAll();


/* ============ דמות תלת-מימד (Three.js) — ראש הולוגרפי שמגיב לקול ============ */
function initAvatar3D(){
  if (!window.THREE) return; /* ה-CDN לא נטען — נשארים עם ה-orb הדו-ממדי */
  let renderer, scene, camera, head, wire, rim, mouth, eyeL, eyeR, halo, pointLight, ring, ringGeo, ringPos, avatarGrp;
  const stage = document.getElementById('stage3d');
  const CY = 0x4fd8ff, ICE = 0xbfeeff;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    const avatar = new THREE.Group();
    scene.add(avatar);
    avatarGrp = avatar; /* הפניה חיצונית ללולאה — הזזת/קנה-מידה של כל הראש */

    /* ראש — איקוסהדרון כהה עם רשת תיל תכולה מעליו (מראה הולוגרפי) */
    const headGeo = new THREE.IcosahedronGeometry(1, 2);
    head = new THREE.Mesh(headGeo, new THREE.MeshPhongMaterial({
      color: 0x0a1a2a, emissive: CY, emissiveIntensity: 0.25,
      shininess: 60, transparent: true, opacity: 0.92, flatShading: true
    }));
    head.scale.set(0.9, 1.05, 0.9);
    avatar.add(head);

    wire = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({
      color: CY, wireframe: true, transparent: true, opacity: 0.35
    }));
    wire.scale.copy(head.scale).multiplyScalar(1.02);
    avatar.add(wire);

    /* שֶלֶד Fresnel — זוהר-מתאר הולוגרפי: המתאר בוהק חזק מהחזית, מתעצם בדיבור */
    rim = new THREE.Mesh(headGeo, new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(CY) }, uPow: { value: 2.6 }, uInt: { value: 0.5 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV;\n'
        + 'void main(){ vN = normalize(normalMatrix * normal);\n'
        + '  vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz);\n'
        + '  gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uPow, uInt; varying vec3 vN; varying vec3 vV;\n'
        + 'void main(){ float f = pow(1.0 - abs(dot(vN, vV)), uPow);\n'
        + '  gl_FragColor = vec4(uColor, f * uInt); }'
    }));
    rim.scale.copy(head.scale).multiplyScalar(1.12);
    avatar.add(rim);

    /* עיניים — כדורים זוהרים */
    const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const eyeMat = () => new THREE.MeshBasicMaterial({ color: ICE });
    eyeL = new THREE.Mesh(eyeGeo, eyeMat()); eyeL.position.set(-0.32, 0.18, 0.82);
    eyeR = new THREE.Mesh(eyeGeo, eyeMat()); eyeR.position.set(0.32, 0.18, 0.82);
    avatar.add(eyeL, eyeR);

    /* פה — לוחית שנפתחת אנכית לפי עוצמת הקול */
    mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: ICE })
    );
    mouth.position.set(0, -0.42, 0.8);
    avatar.add(mouth);

    /* הילה — טבעת שמגיבה לאנרגיה */
    halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.015, 8, 80),
      new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.4 })
    );
    halo.rotation.x = Math.PI / 2.2;
    avatar.add(halo);

    /* טבעת אודיו — waveform רדיאלי שמתעוות לפי הקול (מהדהד את ה-orb הדו-ממדי) */
    const RN = 96;
    ringPos = new Float32Array(RN * 3);
    for (let i = 0; i < RN; i++){ const a = i / RN * Math.PI * 2; ringPos[i*3] = Math.cos(a)*1.5; ringPos[i*3+2] = Math.sin(a)*1.5; }
    ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
    ring = new THREE.LineLoop(ringGeo, new THREE.LineBasicMaterial({ color: ICE, transparent: true, opacity: 0 }));
    ring.rotation.x = Math.PI / 2.2;
    avatar.add(ring);

    scene.add(new THREE.AmbientLight(0x223344, 1.2));
    pointLight = new THREE.PointLight(CY, 1.4, 12);
    pointLight.position.set(1.5, 1.5, 3);
    scene.add(pointLight);

    stage.appendChild(renderer.domElement);
    document.body.classList.add('use3d');
    use3D = true;
  } catch(e){
    return; /* יצירת ההקשר נכשלה — fallback ל-orb */
  }

  function sizeStage(){
    const s = Math.min(window.innerWidth * 0.72, window.innerHeight * 0.46, 440);
    stage.style.width = stage.style.height = s + 'px';
    renderer.setSize(s, s); /* updateStyle=true — ה-CSS של הקנבס = s (במקום s×DPR שגרם לקנבס כפול ב-retina) */
  }
  sizeStage();
  addEventListener('resize', sizeStage);
  stage.onclick = () => cancelAll();

  /* --- מצב אנימציה: קפיצים, מבט, טרנזיאנטים --- */
  let blink = 0, nextBlink = 120, tt = 0;
  let eVal = 0.24, eVel = 0;                 /* אנרגיה מוחלקת בקפיץ — מעברי מצב פיזיים */
  let mY = 1, mVel = 0;                       /* קפיץ לפה */
  let gx = 0, gy = 0, gxT = 0, gyT = 0, gNext = 60; /* מבט: יעד + מיקום עיניים */
  let kick = 0, prevMode = mode;             /* אנטיציפציה/ריקוֹאיל בכניסה למצב */
  let tilt = 0, tiltNext = 300;              /* נטיית סקרנות אקראית בהמתנה */
  let perk = 0, perkVel = 0;                  /* "התעוררות" לשיא קול בהאזנה */
  const cCool = new THREE.Color(CY), cHot = new THREE.Color(ICE);
  const RN = 96;

  function loop(){
    requestAnimationFrame(loop);
    tt += reduced ? 0.2 : 1;

    /* יעד אנרגיה גולמי → מוחלק בקפיץ כמעט-קריטי (E) */
    const eTarget = mode === State.SPEAK ? 0.6 + audioLevel
                  : mode === State.LISTEN ? 0.45 + audioLevel
                  : mode === State.THINK ? 0.5 + 0.25 * Math.sin(tt * 0.09)
                  : 0.24 + 0.06 * Math.sin(tt * 0.025);
    eVel += (eTarget - eVal) * (reduced ? 0.06 : 0.12);
    eVel *= reduced ? 0.85 : 0.75;
    eVal += eVel;
    const E = eVal;
    const active = mode !== State.IDLE;
    const talk = (mode === State.SPEAK || mode === State.LISTEN) ? audioLevel : 0;

    /* כניסה למצב — אנטיציפציה: דחיפה חד-פעמית שנרגעת (#4) */
    if (mode !== prevMode){
      if (!reduced && (mode === State.SPEAK || mode === State.LISTEN)) kick = 1;
      prevMode = mode;
    }
    kick *= 0.88;
    const recoil = Math.sin(kick * Math.PI) * 0.12; /* פעימת in-out */

    /* מבט — סקאדות עיניים + אישיות לפי מצב (#3) */
    if (--gNext <= 0){
      const amp = reduced ? 0.3 : 1;
      gxT = (Math.random() * 2 - 1) * 0.12 * amp;
      gyT = ((Math.random() * 2 - 1) * 0.08 + (mode === State.LISTEN ? 0.05 : mode === State.THINK ? 0.06 : 0)) * amp;
      if (Math.random() < 0.3) { gxT = 0; gyT = 0; }        /* לפעמים חוזר לקשר עין */
      gNext = 30 + Math.random() * (mode === State.THINK ? 40 : 130); /* בחשיבה מרפרף יותר */
    }
    gx += (gxT - gx) * 0.2; gy += (gyT - gy) * 0.2;

    /* התעוררות לשיא קול בהאזנה (#11) */
    if (mode === State.LISTEN) perkVel += audioLevel * 0.02;
    perkVel += (0 - perk) * 0.05; perkVel *= 0.8; perk += perkVel;

    /* נטיית סקרנות אקראית בהמתנה (#10) */
    if (mode === State.IDLE && !reduced && --tiltNext <= 0){ tilt = 1; tiltNext = 280 + Math.random() * 400; }
    tilt *= 0.94;

    /* תנועת ראש — סיבוב אורגני (שתי תדירויות) + מעקב מבט בפיגור + נטיות מצב */
    const idleYaw = Math.sin(tt * 0.012) * 0.14 + Math.sin(tt * 0.007 + 1.3) * 0.05;
    head.rotation.y = wire.rotation.y = rim.rotation.y =
      idleYaw * (active ? 1.15 : 1) + gx * 0.35 + (mode === State.THINK ? Math.sin(tt * 0.05) * 0.22 : 0);
    head.rotation.x = wire.rotation.x = rim.rotation.x =
      Math.sin(tt * 0.02) * 0.06 + gy * 0.35 + (mode === State.LISTEN ? 0.12 : 0) - perk * 0.4;
    head.rotation.z = wire.rotation.z = rim.rotation.z = Math.sin(tilt * Math.PI) * 0.1;

    /* נשימה (אסימטרית) + ריקוֹאיל — מזיזים/מקנים את כל הראש */
    const phase = (tt * 0.008) % 1;
    const breath = reduced ? 0 : Math.sin(Math.pow(phase, 0.7) * Math.PI * 2) * 0.045;
    avatarGrp.position.y = breath;
    avatarGrp.position.z = recoil;
    avatarGrp.scale.setScalar(1 - kick * 0.03);

    /* עיניים — מבט + מצמוץ */
    eyeL.position.x = -0.32 + gx * 0.12; eyeR.position.x = 0.32 + gx * 0.12;
    eyeL.position.y = eyeR.position.y = 0.18 + gy * 0.1;

    /* הילה + טבעת אודיו רדיאלית (#6) */
    halo.rotation.z = tt * 0.006;
    halo.scale.setScalar(1 + E * 0.05 + talk * 0.1);
    halo.material.opacity = 0.26 + E * 0.32 + talk * 0.25;
    const rAmp = talk;
    for (let i = 0; i < RN; i++){
      const a = i / RN * Math.PI * 2;
      const wob = Math.sin(a * 7 + tt * 0.25) * rAmp * 0.22 + Math.sin(a * 3 - tt * 0.18) * rAmp * 0.13;
      const r = 1.5 + wob;
      ringPos[i * 3] = Math.cos(a) * r; ringPos[i * 3 + 2] = Math.sin(a) * r;
    }
    ringGeo.attributes.position.needsUpdate = true;
    ring.rotation.z = -tt * 0.008;
    ring.material.opacity = talk > 0.02 ? 0.35 + talk * 0.4 : Math.max(0, ring.material.opacity - 0.04);

    /* זוהר לפי E + שֶלֶד Fresnel + טמפרטורת צבע (#1, #7, #8) */
    head.material.emissiveIntensity = 0.2 + E * 0.55 + breath * 0.6;
    wire.material.opacity = 0.22 + E * 0.42;
    pointLight.intensity = 1 + E * 1.7;
    rim.material.uniforms.uInt.value = 0.35 + E * 0.6 + talk * 0.3;
    const warmth = Math.min(1, E * 0.9 + (mode === State.SPEAK ? audioLevel : 0));
    head.material.emissive.copy(cCool).lerp(cHot, warmth * 0.6);
    pointLight.color.copy(cCool).lerp(cHot, warmth * 0.4);
    rim.material.uniforms.uColor.value.copy(cCool).lerp(cHot, warmth * 0.5);

    /* פה — קפיץ סביב יעד עוצמת-הקול + נשימת מנוחה קלה (#2) */
    const mTarget = 1 + talk * 22 + (active ? 0 : 0.12 + 0.1 * Math.sin(tt * 0.02));
    mVel += (mTarget - mY) * 0.35; mVel *= 0.6; mY += mVel;
    mouth.scale.y = Math.max(0.6, mY);
    mouth.material.color.copy(cCool).lerp(cHot, mode === State.SPEAK ? 1 : 0);

    /* מצמוץ — לפעמים כפול */
    if (--nextBlink <= 0 && blink === 0){ blink = 12; nextBlink = (Math.random() < 0.25 ? 18 : 150 + Math.random() * 260); }
    if (blink > 0){ blink--; const s = blink > 6 ? (12 - blink) / 6 : blink / 6; eyeL.scale.y = eyeR.scale.y = Math.max(0.08, s); }
    else eyeL.scale.y = eyeR.scale.y = 1;

    audioLevel *= 0.92; /* הדעיכה עברה לכאן כי לולאת ה-2D נעצרה */
    renderer.render(scene, camera);
  }
  loop();
}
initAvatar3D();

