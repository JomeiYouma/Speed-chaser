import * as THREE from 'three';

// UI
const timerEl = document.createElement('div');
timerEl.id = 'timer';
timerEl.textContent = '0.00';
document.body.appendChild(timerEl);

const gameoverEl = document.createElement('div');
gameoverEl.id = 'gameover';
gameoverEl.innerHTML = 'GAME OVER<br><span style="font-size:18px">Appuie sur ESPACE pour relancer</span>';
document.body.appendChild(gameoverEl);

// Game state
let alive = true;
let startTime = performance.now();
let elapsed = 0;
const baseSpeed = 0.04;
const acceleration = 0.005;
let playerColor = 'red';

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 0.1, 35);

// Camera
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(50, aspect);
camera.position.set(0, 1, 14.5);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//Init object double face
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(5, 35),
  new THREE.MeshBasicMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide })
);
road.rotation.x = -Math.PI * 0.5;

//Init spaceship
const spaceship = new THREE.Mesh(
  new THREE.ConeGeometry(3, 10, 5),
  new THREE.MeshBasicMaterial({ color: 0xff5555 })
);
spaceship.rotation.x = -Math.PI * 0.5;
spaceship.scale.set(0.1, 0.1, 0.1);
spaceship.position.set(0, -0.03, 11.5);


scene.add(spaceship);

scene.add(road);

// Walls
const lanes = [-1.5, 0, 1.5];
const laneWidth = 5 / 3;
const wallGeo = new THREE.BoxGeometry(laneWidth, 0.5, 0.3);
const redMat = new THREE.MeshBasicMaterial({ color: 0xff5555 });
const blueMat = new THREE.MeshBasicMaterial({ color: 0x5555ff });
const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const walls = [];
const wallSpacing = 8;
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
  startTime = performance.now();
  elapsed = 0;
  playerColor = 'red';
  spaceship.material.color.set(0xff5555);
  timerEl.textContent = '0.00';
  gameoverEl.style.display = 'none';
  spaceship.position.set(0, -0.03, 11.5);

  walls.forEach((row) => row.meshes.forEach((m) => scene.remove(m)));
  walls.length = 0;
  for (let i = 0; i < wallCount; i++) {
    walls.push(createWallRow(-wallSpacing * i));
  }
}

//Controls
window.addEventListener('keydown', (event) => {
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
    spaceship.material.color.set(0x5555ff);
  } else {
    playerColor = 'red';
    spaceship.material.color.set(0xff5555);
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




const tick = () => {
  if (alive) {
    elapsed = (performance.now() - startTime) / 1000;
    timerEl.textContent = elapsed.toFixed(2);

    const wallSpeed = baseSpeed + elapsed * acceleration;

    // Move walls toward the camera
    walls.forEach((row) => {
      row.z += wallSpeed;
      row.meshes.forEach((m) => (m.position.z = row.z));
      if (row.z > 15) {
        respawnRow(row);
      }
    });

    // Collision
    if (checkCollision()) {
      alive = false;
      gameoverEl.style.display = 'block';
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};

tick();