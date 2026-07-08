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
  let renderer, scene, camera, head, wire, mouth, eyeL, eyeR, halo, pointLight;
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
    renderer.setSize(s, s, false);
  }
  sizeStage();
  addEventListener('resize', sizeStage);
  stage.onclick = () => cancelAll();

  let blink = 0, nextBlink = 120, tt = 0;
  function loop(){
    requestAnimationFrame(loop);
    tt += reduced ? 0.2 : 1;

    const energy = mode === State.SPEAK ? 0.6 + audioLevel
                 : mode === State.LISTEN ? 0.45 + audioLevel
                 : mode === State.THINK ? 0.5 + 0.25 * Math.sin(tt * 0.09)
                 : 0.24 + 0.06 * Math.sin(tt * 0.025);
    const active = mode !== State.IDLE;

    /* תנועת ראש — סיבוב עדין בהמתנה, מהיר יותר בחשיבה, נטייה בהאזנה */
    const spin = reduced ? 0 : (mode === State.THINK ? 0.02 : 0.004);
    head.rotation.y = wire.rotation.y = Math.sin(tt * (mode === State.THINK ? 0.05 : 0.012)) * (active ? 0.5 : 0.32) + tt * spin * 0.15;
    head.rotation.x = wire.rotation.x = Math.sin(tt * 0.02) * 0.08 + (mode === State.LISTEN ? 0.12 : 0);
    const bob = reduced ? 0 : Math.sin(tt * 0.03) * 0.04;
    head.position.y = wire.position.y = bob;
    eyeL.position.y = eyeR.position.y = 0.18 + bob;
    mouth.position.y = -0.42 + bob;
    halo.rotation.z = tt * 0.006;
    halo.scale.setScalar(1 + energy * 0.06);

    /* זוהר לפי אנרגיה */
    head.material.emissiveIntensity = 0.2 + energy * 0.5;
    wire.material.opacity = 0.25 + energy * 0.4;
    pointLight.intensity = 1 + energy * 1.6;

    /* פה — נפתח לפי עוצמת הדיבור בפועל */
    const talk = (mode === State.SPEAK || mode === State.LISTEN) ? audioLevel : 0;
    mouth.scale.y = 1 + talk * 22;
    mouth.material.color.setHex(mode === State.SPEAK ? ICE : CY);

    /* מצמוץ אקראי */
    if (--nextBlink <= 0 && blink === 0) { blink = 12; nextBlink = 140 + Math.random() * 260; }
    if (blink > 0) { blink--; const s = blink > 6 ? (12 - blink) / 6 : blink / 6; eyeL.scale.y = eyeR.scale.y = Math.max(0.08, s); }
    else eyeL.scale.y = eyeR.scale.y = 1;

    audioLevel *= 0.92; /* הדעיכה עברה לכאן כי לולאת ה-2D נעצרה */
    renderer.render(scene, camera);
  }
  loop();
}
initAvatar3D();

