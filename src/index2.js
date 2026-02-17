import * as THREE from "three";
/* console.log(THREE.REVISION) ; */


//Cours 1 : Scène
const scene = new THREE.Scene();
const material = new THREE.MeshNormalMaterial({ color: 0xff0000 });
const geometry = new THREE.BoxGeometry();

for(let i = 0; i < 50; i++){
const cube = new THREE.Mesh(geometry, material);
/* cube.name = "cube vert"; */
cube.position.set( Math.random()* 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5 );
cube.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
scene.add( cube );
}

//Cours 2 : Caméra

const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(50,aspect,1,5000);


//Cours 3 : Lumière
const light = new THREE.AmbientLight(0xffffff, 0.5);
const light2 = new THREE.DirectionalLight(0xffffff, 4);
light.position.set(1, 1, 1);
scene.add(light); 
scene.add(light2);
// Renderer
const renderer = new THREE.WebGLRenderer(/* antialias=true */);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//Instancier
camera.position.set(0,0,5);
renderer.render(scene, camera);


//Déplacer la caméra
let time = 0;

function animate() {
  // 1. Schedule the next frame
  requestAnimationFrame(animate);

  // 2. Update camera position (Circular orbit)
  time += 0.01; // Increase this to go faster
  const radius = 15;
  
  camera.position.x = Math.cos(time) * radius;
  camera.position.z = Math.sin(time) * radius;
  camera.position.y = Math.sin(time * 0.5) * 5; // Add a little vertical wave
  scene.children.forEach(cube => {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
  });
  // 3. Always look at the center of the scene
  camera.lookAt(0, 0, 0);

  // 4. Render the scene
  renderer.render(scene, camera);
}

// Start the loop
animate();


//
let cubes = [];
for(let i = 0; i < 50; i++){
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set( Math.random()* 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5 );
    cube.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    scene.add( cube );
    cubes.push(cube);
}

const tick = () => 
cubes = cubes.map(obj => {
  obj.rotation.x += 0.01;
  obj.rotation.y += 0.01;
  return obj;
});