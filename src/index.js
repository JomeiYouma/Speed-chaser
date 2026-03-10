import * as THREE from 'three';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, get } from 'firebase/database';
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Utility: escape HTML to prevent XSS
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// UI
const timerEl = document.createElement('div');
timerEl.id = 'timer';
timerEl.textContent = '0.00';
document.body.appendChild(timerEl);

const gameoverEl = document.createElement('div');
gameoverEl.id = 'gameover';
gameoverEl.innerHTML = 'GAME OVER<br><span style="font-size:18px">Appuie sur ESPACE pour relancer</span>';
document.body.appendChild(gameoverEl);

const controlsEl = document.createElement('div');
controlsEl.style.cssText = 'position:fixed;top:16px;right:16px;opacity:0.5;background:#222233;color:white;padding:8px 18px;border-radius:8px;font-family:monospace;font-size:13px;z-index:20;pointer-events:none;text-align:left;line-height:1.7;';
controlsEl.innerHTML = `<b>CONTROLS</b><br>
<table style="border-collapse:collapse;margin-top:4px;">
  <tr><td style="padding-right:16px;color:#E6AF2E;">← / Q · → / D</td><td>move</td></tr>
  <tr><td style="padding-right:16px;color:#E6AF2E;">SPACE</td><td>color</td></tr>
  <tr><td style="padding-right:16px;color:#E6AF2E;">P</td><td>pause</td></tr>
  <tr><td style="padding-right:16px;color:#E6AF2E;">S</td><td>sound</td></tr>
</table>`;
document.body.appendChild(controlsEl);

// Game state
let alive = true;
let paused = false;
let startTime = performance.now();
let elapsed = 0;
const baseSpeed = 0.04;
const acceleration = 0.0025;
let playerColor = 'red';
let lives = 5;
let invincible = false;
let invincibleUntil = 0;

// Lives UI
const livesContainer = document.createElement('div');
livesContainer.id = 'lives';
livesContainer.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:10;pointer-events:none;';
document.body.appendChild(livesContainer);
const lifeBars = [];
for (let i = 0; i < 5; i++) {
  const bar = document.createElement('div');
  bar.style.cssText = 'width:30px;height:6px;background:white;border-radius:2px;transition:opacity 0.3s;';
  livesContainer.appendChild(bar);
  lifeBars.push(bar);
}
function updateLivesUI() {
  lifeBars.forEach((bar, i) => { bar.style.opacity = i < lives ? '1' : '0.15'; });
}

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222233);
scene.fog = new THREE.Fog(0x222233, 15, 40);

// Camera
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(50, aspect);
camera.position.set(0, 1, 14.5);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lights
const ambientLight = new THREE.AmbientLight(0x222233, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(3, 8, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -10;
dirLight.shadow.camera.right = 10;
dirLight.shadow.camera.top = 10;
dirLight.shadow.camera.bottom = -30;
scene.add(dirLight);

const shipLight = new THREE.PointLight(0xE6AF2E, 2, 8);
shipLight.position.set(0, 0.5, 0);
scene.add(shipLight);

//Init object double face
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(5, 35),
  new THREE.MeshStandardMaterial({ color: 0xD0D0D0, side: THREE.FrontSide, roughness: 0.8, metalness: 0.2 })
);
road.rotation.x = -Math.PI * 0.5;
road.receiveShadow = true;

//Init spaceship
const spaceship = new THREE.Mesh(
  new THREE.ConeGeometry(3, 10, 5),
  new THREE.MeshStandardMaterial({ color: 0xE6AF2E, metalness: 0.6, roughness: 0.3, emissive: 0xB38A24, emissiveIntensity: 0.3 })
);
spaceship.rotation.x = -Math.PI * 0.5;
spaceship.scale.set(0.1, 0.1, 0.1);
spaceship.position.set(0, -0.03, 11.5);
spaceship.castShadow = true;

// Engine lights
const engineLightL = new THREE.PointLight(0xff6633, 0.3, 2);
engineLightL.position.set(-0.15, 0.05, 12.1);
const engineLightR = new THREE.PointLight(0xff6633, 0.3, 2);
engineLightR.position.set(0.15, 0.05, 12.1);
scene.add(engineLightL);
scene.add(engineLightR);


scene.add(spaceship);

scene.add(road);

// Stars
const starCount = 100;
const starGeo = new THREE.SphereGeometry(0.04, 4, 4);
const starMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 });
const stars = [];
const starDepth = 80;
for (let i = 0; i < starCount; i++) {
  const star = new THREE.Mesh(starGeo, starMat);
  star.position.set(
    (Math.random() - 0.5) * 40,
    Math.random() * 5 + 0.5,
    16 - Math.random() * starDepth
  );
  scene.add(star);
  stars.push(star);
}

// Walls
const lanes = [-1.5, 0, 1.5];
const laneWidth = 5 / 3;
const wallGeo = new THREE.BoxGeometry(laneWidth, 0.5, 0.3);
const redMat = new THREE.MeshStandardMaterial({ color: 0xE6AF2E, metalness: 0.4, roughness: 0.4, emissive: 0xE6AF2E, emissiveIntensity: 0.4 });
const blueMat = new THREE.MeshStandardMaterial({ color: 0x3D348B, metalness: 0.4, roughness: 0.4, emissive: 0x3D348B, emissiveIntensity: 0.4 });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xE0E2DB, metalness: 0.5, roughness: 0.3, emissive: 0xE0E2DB, emissiveIntensity: 0.2 });
const walls = [];
let wallSpacing = 7;
const wallCount = 5;

function createWallRow(z) {
  const meshes = [];

  // 1 or 2 white walls
  const whiteCount = Math.random() > 0.5 ? 2 : 1;
  const remaining = 3 - whiteCount;

  const colors = [];
  for (let i = 0; i < whiteCount; i++) colors.push('white');

  if (elapsed < 10) {
    // 0-10s: rest is empty
    for (let i = 0; i < remaining; i++) colors.push('empty');
  } else if (elapsed < 20) {
    // 10-20s: rest is empty or blue
    const choices = ['empty', 'blue'];
    for (let i = 0; i < remaining; i++) colors.push(choices[Math.floor(Math.random() * choices.length)]);
  } else {
    // 20s+: rest is empty, red or blue
    const choices = ['empty', 'red', 'blue'];
    for (let i = 0; i < remaining; i++) colors.push(choices[Math.floor(Math.random() * choices.length)]);
  }

  // Shuffle colors
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }

  // Create walls
  for (let i = 0; i < 3; i++) {
    const color = colors[i];
    if (color === 'empty') continue;
    const mat = color === 'white' ? whiteMat : color === 'red' ? redMat : blueMat;
    const wall = new THREE.Mesh(wallGeo, mat);
    wall.position.set(lanes[i], 0.25, z);
    wall.userData.color = color;
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    meshes.push(wall);
  }

  return { z, meshes };
}

for (let i = 0; i < wallCount; i++) {
  walls.push(createWallRow(-wallSpacing * i));
}

function respawnRow(row) {
  row.meshes.forEach((m) => scene.remove(m));

  const farthestZ = Math.min(...walls.map((w) => w.z));
  const newZ = farthestZ - wallSpacing;

  const newRow = createWallRow(newZ);
  row.meshes = newRow.meshes;
  row.z = newZ;
}

// Reset game
function resetGame() {
  alive = true;
  paused = false;
  startTime = performance.now();
  elapsed = 0;
  playerColor = 'red';
  lives = 5;
  invincible = false;
  invincibleUntil = 0;
  updateLivesUI();
  spaceship.material.color.set(0xE6AF2E);
  spaceship.material.emissive.set(0xB38A24);
  shipLight.color.set(0xE6AF2E);
  engineLightL.color.set(0xff6633);
  engineLightR.color.set(0xff6633);
  timerEl.textContent = '0.00';
  gameoverEl.style.display = 'none';
  clearExplosion();
  spaceship.position.set(0, -0.03, 11.5);

  wallSpacing = 7; // Reset the spacing before creating initial walls
  walls.forEach((row) => row.meshes.forEach((m) => scene.remove(m)));
  walls.length = 0;
  for (let i = 0; i < wallCount; i++) {
    walls.push(createWallRow(-wallSpacing * i));
  }
}

//Controls
window.addEventListener('keydown', (event) => {
  // Sound toggle (S)
  if (event.key === 's' || event.key === 'S') {
    soundOn = !soundOn;
    if (soundOn) {
      music.play().catch(() => {});
      soundBtn.textContent = 'sound on';
    } else {
      music.pause();
      soundBtn.textContent = 'sound off';
    }
    showSoundHint();
    return;
  }

  // Pause toggle (P)
  if (event.key === 'p' || event.key === 'P') {
    if (alive) {
      paused = !paused;
      if (!paused) {
        startTime = performance.now() - elapsed * 1000; // resync après pause
      }
    }
    return;
  }

  if (event.key === ' ' && !alive) {
    resetGame();
    return;
  }

  if (!alive) return;

  // Toggle color with space
  if (event.key === ' ') {
    toggleColor();
    return;
  }

  const maxX = 1.5;
  const speed = 1.5;

  if (event.key === 'ArrowLeft' || event.key === 'q' || event.key === 'Q') {
    spaceship.position.x -= speed;
  } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
    spaceship.position.x += speed;
  }

  if (spaceship.position.x < -maxX) {
    spaceship.position.x = -maxX;
  } else if (spaceship.position.x > maxX) {
    spaceship.position.x = maxX;
  }
});

// Toggle color
function toggleColor() {
  if (playerColor === 'red') {
    playerColor = 'blue';
    spaceship.material.color.set(0x3D348B);
    spaceship.material.emissive.set(0x2A2460);
    shipLight.color.set(0x3D348B);
    engineLightL.color.set(0xff3399);
    engineLightR.color.set(0xff3399);
  } else {
    playerColor = 'red';
    spaceship.material.color.set(0xE6AF2E);
    spaceship.material.emissive.set(0xB38A24);
    shipLight.color.set(0xE6AF2E);
    engineLightL.color.set(0xff6633);
    engineLightR.color.set(0xff6633);
  }
}

// Click to toggle color
window.addEventListener('click', () => {
  if (!alive) return;
  toggleColor();
});

// Collision detection
function checkCollision() {
  const shipX = spaceship.position.x;
  const shipZ = spaceship.position.z;
  for (const row of walls) {
    for (const m of row.meshes) {
      if (Math.abs(m.position.z - shipZ) < 0.5 && Math.abs(m.position.x - shipX) < laneWidth * 0.5) {
        // White = always deadly, same color = pass through
        if (m.userData.color === 'white') return true;
        if (m.userData.color === playerColor) continue;
        return true;
      }
    }
  }
  return false;
}

// Explosion
const explosionParts = [];
function explode() {
  const pos = spaceship.position.clone();
  const color = spaceship.material.color.clone();
  for (let i = 0; i < 30; i++) {
    const size = 0.03 + Math.random() * 0.08;
    const geo = new THREE.TetrahedronGeometry(size);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 1.0,
    });
    const part = new THREE.Mesh(geo, mat);
    part.position.copy(pos);
    part.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.15,
      Math.random() * 0.1,
      (Math.random() - 0.5) * 0.15
    );
    scene.add(part);
    explosionParts.push(part);
  }
  spaceship.visible = false;
  shipLight.intensity = 0;
  engineLightL.intensity = 0;
  engineLightR.intensity = 0;
}

function clearExplosion() {
  for (const p of explosionParts) scene.remove(p);
  explosionParts.length = 0;
  spaceship.visible = true;
  shipLight.intensity = 2;
  engineLightL.intensity = 0.3;
  engineLightR.intensity = 0.3;
}

// Music
const music = new Audio('/rip-to-mozart.mp3');
music.loop = true;
music.volume = 0.5;

// Highscore UI
const soundBtn = document.createElement('button');
soundBtn.textContent = 'sound off';
soundBtn.style.cssText = 'position:fixed;top:16px;left:16px;opacity:0.5;background:#222233;color:white;border:none;padding:8px 18px;border-radius:8px;font-family:monospace;font-size:18px;z-index:20;cursor:pointer;';
document.body.appendChild(soundBtn);

const soundHintEl = document.createElement('span');
soundHintEl.textContent = 'changes next game';
soundHintEl.style.cssText = 'position:fixed;top:22px;left:calc(16px + 160px);opacity:0;color:#aaa;font-family:monospace;font-size:12px;z-index:20;pointer-events:none;transition:opacity 0.3s;';
document.body.appendChild(soundHintEl);
let soundHintTimer = null;
function showSoundHint() {
  soundHintEl.style.opacity = '1';
  clearTimeout(soundHintTimer);
  soundHintTimer = setTimeout(() => { soundHintEl.style.opacity = '0'; }, 2500);
}

let soundOn = false;
soundBtn.onclick = () => {
  soundOn = !soundOn;
  if (soundOn) {
    music.play().catch(() => {});
    soundBtn.textContent = 'sound on';
  } else {
    music.pause();
    soundBtn.textContent = 'sound off';
  }
  showSoundHint();
};

const highscoresEl = document.createElement('div');
highscoresEl.id = 'highscores';
highscoresEl.style.cssText = 'position:fixed;top:56px;left:16px;opacity:0.5;background:#222233;color:white;padding:8px 18px;border-radius:8px;font-family:monospace;font-size:18px;z-index:20;pointer-events:none;max-width:220px;text-align:left;letter-spacing:2px;';
document.body.appendChild(highscoresEl);
let highscores = [];
function loadHighscores() {
  try {
    highscores = JSON.parse(localStorage.getItem('highscores') || '[]');
  } catch (e) { highscores = []; }
}
function saveHighscores() {
  localStorage.setItem('highscores', JSON.stringify(highscores));
}
function renderHighscores() {
  highscoresEl.innerHTML = '<b>HIGHSCORES</b><br>' + highscores.slice(0, 5).map((s, i) => `${i+1}. <span style="color:#E6AF2E">${escapeHtml(s.name)}</span> <span style="float:right">${s.score.toFixed(2)}</span>`).join('<br>');
}
loadHighscores();
renderHighscores();

// Firebase realtime listener
const highscoresRef = ref(db, 'highscores');
onValue(highscoresRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    highscores = Object.values(data);
    highscores.sort((a, b) => b.score - a.score);
    highscores = highscores.slice(0, 5);
    saveHighscores(); // Backup en local
    renderHighscores();
  }
});

let currentScore = 0;

// Highscore logic
function updateHighscore() {
  let best = highscores.length < 5 || (highscores.length > 0 && currentScore > highscores[highscores.length - 1].score);
  if (best) {
    setTimeout(() => {
      let name = '';
      while (!/^[A-Z]{1,8}$/.test(name)) {
        name = prompt('NOUVEAU HIGHSCORE !\nEntre ton pseudo (8 lettres max A-Z) :', 'AAA');
        if (!name) name = 'AAA';
        name = name.slice(0, 8).toUpperCase();
      }

      // 1) On essaie de sauvegarder sur Firebase
      const playerRef = ref(db, 'highscores/' + name);
      get(playerRef).then((snapshot) => {
        const existing = snapshot.val();
        if (!existing || currentScore > existing.score) {
          set(playerRef, { name, score: currentScore })
            .then(fallbackSave) // Force local UI update on success
            .catch(fallbackSave);
        } else {
          fallbackSave(); // Update UI even if score not beaten just to be safe
        }
      }).catch(fallbackSave);

      // 2) Fallback local si Firebase échoue / bloqué
      function fallbackSave() {
        const existing = highscores.find(s => s.name === name);
        if (existing) {
          if (currentScore > existing.score) existing.score = currentScore;
        } else {
          highscores.push({ name, score: currentScore });
        }
        highscores.sort((a, b) => b.score - a.score);
        highscores = highscores.slice(0, 5);
        saveHighscores();
        renderHighscores();
      }
    }, 500);
  }
}

function isHighscore(score) {
  if (highscores.length < 5) return true;
  return highscores.some(s => score > s.score);
}

let lastFrameTime = performance.now();
const tick = () => {
  requestAnimationFrame(tick);

  const now = performance.now();
  const dt = Math.min(now - lastFrameTime, 100); // 100ms max to prevent tunneling after freeze
  lastFrameTime = now;
  const dtMultiplier = dt / (1000 / 60);

  if (alive && !paused) {
    elapsed = (performance.now() - startTime) / 1000;
    timerEl.textContent = elapsed.toFixed(2);

    const wallSpeed = (baseSpeed + elapsed * acceleration) * dtMultiplier;
    const spacingElapsed = Math.min(elapsed, 115);
    wallSpacing = (baseSpeed + spacingElapsed * acceleration) * 45 + 7;

    // Move walls toward the camera
    walls.forEach((row) => {
      row.z += wallSpeed;
      row.meshes.forEach((m) => (m.position.z = row.z));
      if (row.z > 15) {
        respawnRow(row);
      }
    });

    // Smooth ship light follow
    shipLight.position.x += (spaceship.position.x - shipLight.position.x) * 0.15;
    shipLight.position.z = spaceship.position.z;
    shipLight.position.y = 0.5;

    // Engine lights follow spaceship
    engineLightL.position.set(spaceship.position.x - 0.15, 0.05, spaceship.position.z + 0.6);
    engineLightR.position.set(spaceship.position.x + 0.15, 0.05, spaceship.position.z + 0.6);

    // Move stars
    for (const star of stars) {
      star.position.z += wallSpeed;
      if (star.position.z > 16) {
        star.position.z = 16 - starDepth;
        star.position.x = (Math.random() - 0.5) * 40;
        star.position.y = Math.random() * 5 + 0.5;
      }
    }

    // Collision
    if (checkCollision() && !invincible) {
      lives--;
      updateLivesUI();
      explode();
      if (lives <= 0) {
        currentScore = elapsed;
        alive = false;
        gameoverEl.style.display = 'block';
        updateHighscore();
      } else {
        // Respawn with invincibility
        invincible = true;
        invincibleUntil = performance.now() + 2000;
        clearExplosion();
      }
    }

    // Invincibility blink
    if (invincible) {
      spaceship.visible = Math.floor(performance.now() / 100) % 2 === 0;
      if (performance.now() > invincibleUntil) {
        invincible = false;
        spaceship.visible = true;
      }
    }
  }

  // Animate explosion particles
  for (const p of explosionParts) {
    p.position.x += p.userData.vel.x * dtMultiplier;
    p.position.y += p.userData.vel.y * dtMultiplier;
    p.position.z += p.userData.vel.z * dtMultiplier;
    p.userData.vel.y -= 0.002 * dtMultiplier;
    p.material.opacity -= 0.008 * dtMultiplier;
    if (p.material.opacity < 0) p.material.opacity = 0;
  }

  renderer.render(scene, camera);
};

tick();

// Page Visibility API : figer le timer quand l'onglet est caché
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = performance.now();
  } else if (hiddenAt > 0 && alive && !paused) {
    // Décaler startTime pour annuler le temps passé en arrière-plan
    startTime += performance.now() - hiddenAt;
    hiddenAt = 0;
  }
});