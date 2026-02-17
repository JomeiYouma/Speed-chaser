import * as THREE from 'three';

// Scene
const scene = new THREE.Scene();

const geometry = new THREE.IcosahedronGeometry();
const geometry2 = new THREE.DodecahedronGeometry();
const geometry3 = new THREE.OctahedronGeometry();
const geometry4 = new THREE.IcosahedronGeometry(0);
const geometry5 = new THREE.DodecahedronGeometry(0);

const geometries = [geometry, geometry2, geometry3, geometry4, geometry5];
const material = new THREE.MeshStandardMaterial({color : 0xFF5A5F});
const material2 = new THREE.MeshStandardMaterial({color : 0x087E8B});

const respawnZ = -250;
const scaleMin = 0.1;
const scaleMax = 4;
const nomberOfCubes = 1050;

// 1. CRÉER UN TABLEAU POUR STOCKER LES CUBES
const cubes = []; 

for (let j = 0; j < nomberOfCubes; j++) {
  
const cube = new THREE.Mesh(geometries[Math.floor(Math.random() * geometries.length)], Math.random() > 0.5 ? material : material2);

const randomVal = (Math.random() + Math.random() + Math.random() + Math.random()) / 4; //Courbe de distribution normale centrée sur 0.5

cube.scale.setScalar(randomVal * (scaleMax - scaleMin) + scaleMin);
/*   cube.scale.setScalar(Math.random() * 2 + 0.5); */
  cube.userData = { rotationSpeed: Math.random() * 0.01 + 0.01 , positionZSpeed: Math.random() * 0.4 + 0.5 };
  cube.position.set(
    Math.floor(Math.random() * window.innerWidth/10) - window.innerWidth/10 / 2,
    Math.floor(Math.random() * window.innerHeight/10) - window.innerHeight/10 / 2,
    respawnZ,
  );

  cube.rotation.set(
    Math.random(),
    Math.random(),
    0
  );

  scene.add(cube);
  
  // 2. AJOUTER LE CUBE DANS LE TABLEAU
  cubes.push(cube);
}

// Camera
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(50, aspect, 1, 5000);
camera.position.set(0, 0, 10);

//Light 
const light = new THREE.AmbientLight(0xffffff, 0.5);
const light2 = new THREE.DirectionalLight(0xffffff, 4);
light.position.set(1, 1, 1);
scene.add(light); 
scene.add(light2);
// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const tick = () => {
  // update
  
  // 3. UTILISER LE TABLEAU DÉFINI PLUS HAUT
  // .forEach est plus adapté que .map ici car on ne crée pas un nouveau tableau
  cubes.forEach(obj => {
    obj.rotation.x += obj.userData.rotationSpeed;
    obj.rotation.y += obj.userData.rotationSpeed;
    obj.position.z += obj.userData.positionZSpeed;
    if (obj.position.z > 10) {
      obj.position.z = respawnZ;
    }
  });

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();