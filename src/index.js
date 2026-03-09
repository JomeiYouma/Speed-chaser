import * as THREE from 'three';

// Scene
const scene = new THREE.Scene();

// Camera
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(50, aspect);
camera.position.set(0, 0, 2);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const tick = () => {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};

tick();