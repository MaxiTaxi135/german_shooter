import * as THREE from "three";
import { SETTINGS } from "./config.js";
import { createWorld, createWeaponModel, raycastTerrain } from "./world.js";
import { updateAI } from "./ai.js";
import { WeaponInventory, findEnemyHit, addTracer, addImpact } from "./weapons.js";
import { createUI } from "./ui.js";

const inventory = new WeaponInventory(SETTINGS.startWarBonds);
const state = {
  playing: false,
  pointerLocked: false,
  fireHeld: false,
  aimHeld: false,
  health: SETTINGS.startHealth,
  playerKills: 0,
  alliedKills: 0,
  enemyKills: 0,
  yaw: 0,
  pitch: 0,
  fireCooldown: 0,
  jumpHeight: 0,
  jumpVelocity: 0,
  onGround: true,
  elapsed: 0,
  muzzleUntil: 0,
  emptyMessageShown: false,
  respawning: false,
  enemySpawnTimer: 1.65,
  totalEnemySpawns: 0,
  currentVehicle: null
};
window.gameHealth = state.health;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = "game-canvas";
renderer.domElement.style.position = "fixed";
renderer.domElement.style.inset = "0";
renderer.domElement.style.zIndex = "0";
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
document.body.prepend(renderer.domElement);

const world = createWorld(renderer);
const scene = world.scene;
state.totalEnemySpawns = world.enemies.length;
const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, .08, SETTINGS.renderDistance);
camera.rotation.order = "YXZ";
const player = new THREE.Group();
player.position.set(SETTINGS.playerStart.x, world.terrainHeight(SETTINGS.playerStart.x, SETTINGS.playerStart.z), SETTINGS.playerStart.z);
player.add(camera);
scene.add(player);
camera.position.set(0, 0, 0);
camera.rotation.set(0, 0, 0);

// The weapon model and the left arm are camera-attached so their movement is smooth and independent of world animation.
const viewModelRoot = new THREE.Group();
camera.add(viewModelRoot);
let viewWeapon = null;
function equipViewModel() {
  if (viewWeapon) {
    viewModelRoot.remove(viewWeapon);
    viewWeapon.traverse((object) => { if (object.geometry) object.geometry.dispose(); });
  }
  viewWeapon = createWeaponModel(inventory.current.type, world.materials, true);
  viewModelRoot.add(viewWeapon);
}
equipViewModel();

const reloadArm = new THREE.Group();
camera.add(reloadArm);
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x555e47, roughness: .96 });
const skinMat = new THREE.MeshStandardMaterial({ color: 0xb78b6c, roughness: .92 });
const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .35, 4, 8), sleeveMat);
forearm.position.set(-.34, -.42, -.48);
forearm.rotation.set(-.12, -.12, -.55);
reloadArm.add(forearm);
const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.093, .093, .085, 10), world.materials.oliveDark);
cuff.position.set(-.24, -.32, -.67);
cuff.rotation.z = -.45;
reloadArm.add(cuff);
const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), skinMat);
palm.scale.set(.095, .065, .12);
palm.position.set(-.18, -.28, -.7);
reloadArm.add(palm);
const thumb = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), skinMat);
thumb.scale.set(.038, .036, .075);
thumb.position.set(-.1, -.28, -.73);
thumb.rotation.y = -.5;
reloadArm.add(thumb);
reloadArm.visible = false;

const reloadBullets = [];
for (let i = 0; i < 8; i++) {
  const bullet = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .095, 8),
    new THREE.MeshStandardMaterial({ color: 0xb99a53, roughness: .38, metalness: .65 }));
  bullet.rotation.x = Math.PI / 2;
  bullet.visible = false;
  camera.add(bullet);
  reloadBullets.push(bullet);
}
const magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(.115, .25, .14), world.materials.steelDark);
magazineMesh.position.set(.16, -.44, -.73);
magazineMesh.visible = false;
camera.add(magazineMesh);
const drumMagazineMesh = new THREE.Mesh(new THREE.CylinderGeometry(.135, .135, .13, 16),
  new THREE.MeshStandardMaterial({ color: 0x262b28, roughness: .55, metalness: .25 }));
drumMagazineMesh.rotation.x = Math.PI / 2;
drumMagazineMesh.position.set(.15, -.45, -.73);
drumMagazineMesh.visible = false;
camera.add(drumMagazineMesh);

const muzzleLight = new THREE.PointLight(0xffad53, 0, 3.3, 2);
muzzleLight.position.set(.19, -.19, -1.72);
camera.add(muzzleLight);
const muzzleFlash = new THREE.Mesh(
  new THREE.SphereGeometry(.085, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0xffd18b, transparent: true, opacity: .88, depthWrite: false })
);
muzzleFlash.scale.set(.8, .8, 2.4);
muzzleFlash.position.copy(muzzleLight.position);
muzzleFlash.visible = false;
camera.add(muzzleFlash);
const effects = [];
let ui;
let hudTimer = 0;
let lastToast = "";
const clock = new THREE.Clock();

function toast(message, ms = 1450) {
  if (message === lastToast && ms < 1000) return;
  lastToast = message;
  ui.toast(message, ms);
}
function showShop() {
  if (!state.playing || ui.isShopOpen()) return;
  state.fireHeld = false;
  state.aimHeld = false;
  ui.showShop(inventory);
  if (document.pointerLockElement) document.exitPointerLock();
}
function closeShop() {
  ui.hideShop();
  if (state.playing) requestPointerLockSafe();
}
function requestPointerLockSafe() {
  try {
    const request = renderer.domElement.requestPointerLock?.();
    if (request && typeof request.catch === "function") request.catch(() => {});
  } catch {
    // Pointer lock is an optional browser capability; the mouse still works without it.
  }
}
function startGame() {
  state.playing = true;
  ui.hideStart();
  requestPointerLockSafe();
  toast("MOVE OUT · WATCH YOUR SECTORS", 1800);
}
function handlePurchase(id) {
  const result = inventory.buyOrEquip(id);
  if (result.ok) {
    hideReloadVisual();
    equipViewModel();
    syncHud();
  }
  return result;
}
ui = createUI({
  onStart: startGame,
  onPurchase: handlePurchase,
  onShopClose: closeShop
});

function countLivingEnemies() {
  return world.enemies.reduce((count, enemy) => count + (!enemy.userData.dead && enemy.userData.health > 0 ? 1 : 0), 0);
}
function syncHud() {
  window.gameHealth = state.health;
  ui.update(inventory, state.health, 1, state.playerKills + state.alliedKills, state.enemyKills, countLivingEnemies());
}
syncHud();

const keys = new Set();
window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === "KeyR" && state.playing && !ui.isShopOpen()) {
    const result = inventory.startReload();
    if (result.ok) {
      startReloadVisual();
      toast("RELOADING", 850);
    } else toast(result.message, 1000);
  }
  if (event.code === "KeyB" && state.playing) {
    if (ui.isShopOpen()) closeShop();
    else showShop();
  }
  if (event.code === "KeyE" && state.playing && !ui.isShopOpen()) {
    if (state.currentVehicle) leaveVehicle();
    else enterNearbyVehicle();
  }
  if (/^Digit[1-8]$/.test(event.code)) equipHotkey(Number(event.code.slice(5)) - 1);
  if (event.code === "Space" && state.playing && !state.currentVehicle && state.onGround && !ui.isShopOpen()) {
    state.jumpVelocity = SETTINGS.playerJumpSpeed;
    state.onGround = false;
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => {
  state.fireHeld = false;
  state.aimHeld = false;
  keys.clear();
});
function equipHotkey(index) {
  if (!state.playing || ui.isShopOpen()) return;
  const item = inventory.items[index];
  if (!item) return;
  const result = inventory.equip(item.id);
  if (result.ok) { hideReloadVisual(); equipViewModel(); syncHud(); toast(result.message, 900); }
}

renderer.domElement.addEventListener("mousedown", (event) => {
  if (!state.playing || ui.isShopOpen()) return;
  if (event.button === 0) {
    state.fireHeld = true;
    if (!state.pointerLocked) requestPointerLockSafe();
  }
  if (event.button === 2) state.aimHeld = true;
});
window.addEventListener("mouseup", (event) => {
  if (event.button === 0) state.fireHeld = false;
  if (event.button === 2) state.aimHeld = false;
});
window.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("pointerlockchange", () => {
  state.pointerLocked = document.pointerLockElement === renderer.domElement;
  if (!state.pointerLocked && state.playing && !ui.isShopOpen()) {
    state.fireHeld = false;
    state.aimHeld = false;
  }
});
document.addEventListener("mousemove", (event) => {
  if (!state.pointerLocked || !state.playing || ui.isShopOpen() || state.currentVehicle) return;
  state.yaw -= event.movementX * .0021;
  state.pitch -= event.movementY * .0021;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -1.28, 1.22);
  player.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
});

function lineOfSightBlocked(x, z) {
  // Circumference colliders for trees, vehicles, crates, rubble, fences and sandbags.
  // Buildings use individual rotated wall colliders so their doorways are not sealed by an invisible circle.
  for (const obstacle of world.obstacles) {
    if (obstacle.kind === "building" || obstacle.kind === "crate" || obstacle.kind === "tank") continue;
    if (obstacle.vehicle && state.currentVehicle === obstacle.vehicle) continue;
    if (obstacle.vehicle?.userData.vehicleType === "plane" &&
        obstacle.vehicle.position.y > world.terrainHeight(obstacle.vehicle.position.x, obstacle.vehicle.position.z) + 2.8) continue;
    const dx = x - obstacle.x, dz = z - obstacle.z;
    const distanceSq = dx * dx + dz * dz;
    const radius = obstacle.radius + .62;
    if (distanceSq < radius * radius) {
      const oldDx = player.position.x - obstacle.x;
      const oldDz = player.position.z - obstacle.z;
      const oldDistanceSq = oldDx * oldDx + oldDz * oldDz;
      if (!(oldDistanceSq < radius * radius && distanceSq > oldDistanceSq + .0001)) return true;
    }
  }
  for (const box of world.collisionBoxes) {
    const dx = x - box.x, dz = z - box.z;
    const c = Math.cos(box.rotation), sin = Math.sin(box.rotation);
    const localX = dx * c - dz * sin;
    const localZ = dx * sin + dz * c;
    const inside = Math.abs(localX) < box.halfX + .62 && Math.abs(localZ) < box.halfZ + .62;
    if (inside) {
      const oldDx = player.position.x - box.x, oldDz = player.position.z - box.z;
      const oldX = oldDx * c - oldDz * sin;
      const oldZ = oldDx * sin + oldDz * c;
      const wasInside = Math.abs(oldX) < box.halfX + .62 && Math.abs(oldZ) < box.halfZ + .62;
      const oldPenetration = Math.max(0, box.halfX + .62 - Math.abs(oldX)) +
        Math.max(0, box.halfZ + .62 - Math.abs(oldZ));
      const newPenetration = Math.max(0, box.halfX + .62 - Math.abs(localX)) +
        Math.max(0, box.halfZ + .62 - Math.abs(localZ));
      const gettingOut = newPenetration < oldPenetration - .0001;
      if (!(wasInside && gettingOut)) return true;
    }
  }
  // Infantry body hitboxes keep characters from overlapping the player.
  for (const soldier of [...world.enemies, ...world.allies]) {
    if (soldier.userData.dead) continue;
    const dx = x - soldier.position.x, dz = z - soldier.position.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < .78 * .78) {
      const oldDx = player.position.x - soldier.position.x, oldDz = player.position.z - soldier.position.z;
      const oldSq = oldDx * oldDx + oldDz * oldDz;
      if (!(oldSq < .78 * .78 && distanceSq > oldSq + .0001)) return true;
    }
  }
  return false;
}
function vehiclePositionBlocked(x, z, vehicle, clearance = 1.45, ignoreGroundGeometry = false) {
  if (Math.abs(x) > SETTINGS.worldSize / 2 - 8 || Math.abs(z) > SETTINGS.worldSize / 2 - 8) return true;
  if (ignoreGroundGeometry) return false;

  for (const obstacle of world.obstacles) {
    if (obstacle.vehicle === vehicle || obstacle.kind === "building") continue;
    const dx = x - obstacle.x, dz = z - obstacle.z;
    const radius = obstacle.radius + clearance;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  for (const box of world.collisionBoxes) {
    const dx = x - box.x, dz = z - box.z;
    const cos = Math.cos(box.rotation), sin = Math.sin(box.rotation);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    if (Math.abs(localX) < box.halfX + clearance * .75 &&
        Math.abs(localZ) < box.halfZ + clearance * .75) return true;
  }
  for (const soldier of [...world.enemies, ...world.allies]) {
    if (!soldier.userData.dead &&
        Math.hypot(x - soldier.position.x, z - soldier.position.z) < clearance + .45) return true;
  }
  return false;
}

function mountVehicle(vehicle) {
  if (!vehicle || vehicle.userData.occupied) return false;
  const data = vehicle.userData;
  if (data.vehicleType === "plane" &&
      vehicle.position.y > world.terrainHeight(vehicle.position.x, vehicle.position.z) + 2.8) {
    toast("LAND THE PLANE BEFORE BOARDING", 1500);
    return false;
  }

  data.occupied = true;
  state.currentVehicle = vehicle;
  state.fireHeld = false;
  state.aimHeld = false;
  state.jumpHeight = 0;
  state.jumpVelocity = 0;
  state.onGround = true;
  state.yaw = data.heading ?? vehicle.rotation.y;
  state.pitch = data.pitch ?? 0;
  player.position.copy(vehicle.position);
  player.rotation.set(0, state.yaw, 0);
  camera.position.set(0, data.vehicleType === "plane" ? 1.72 : 1.56, data.vehicleType === "plane" ? .22 : .14);
  camera.rotation.set(data.vehicleType === "plane" ? data.pitch : 0, 0, 0);
  camera.fov = 76;
  camera.updateProjectionMatrix();
  viewModelRoot.visible = false;
  reloadArm.visible = false;
  magazineMesh.visible = false;
  drumMagazineMesh.visible = false;
  for (const bullet of reloadBullets) bullet.visible = false;
  ui.focusCrosshair(false);
  if (data.vehicleType === "plane") {
    toast("FIGHTER PLANE · W THROTTLE · SPACE CLIMB · SHIFT DESCEND · E EXIT", 2600);
  } else {
    toast("JEEP · W/S THROTTLE · A/D STEER · E EXIT", 2300);
  }
  return true;
}

function enterNearbyVehicle(requiredType = null) {
  if (state.currentVehicle) return false;
  const nearby = world.vehicles
    .filter((vehicle) => !vehicle.userData.occupied &&
      (!requiredType || vehicle.userData.vehicleType === requiredType) &&
      (vehicle.userData.vehicleType !== "plane" ||
        vehicle.position.y <= world.terrainHeight(vehicle.position.x, vehicle.position.z) + 2.8))
    .map((vehicle) => ({ vehicle, distance: Math.hypot(
      vehicle.position.x - player.position.x, vehicle.position.z - player.position.z
    ) }))
    .filter((entry) => entry.distance <= 9.5)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearby) {
    toast(requiredType ? "MOVE CLOSER TO THE " + requiredType.toUpperCase() : "NO VEHICLE CLOSE ENOUGH", 1100);
    return false;
  }
  return mountVehicle(nearby.vehicle);
}

function leaveVehicle() {
  const vehicle = state.currentVehicle;
  if (!vehicle) return false;
  const data = vehicle.userData;
  const ground = world.terrainHeight(vehicle.position.x, vehicle.position.z);
  if (data.vehicleType === "plane" && vehicle.position.y > ground + 2.8) {
    toast("LAND BEFORE EXITING THE PLANE", 1500);
    return false;
  }

  const heading = data.heading ?? vehicle.rotation.y;
  const sideOffset = data.vehicleType === "plane" ? -4.6 : -3.05;
  const exitX = vehicle.position.x + sideOffset * Math.cos(heading);
  const exitZ = vehicle.position.z - sideOffset * Math.sin(heading);
  data.occupied = false;
  data.speed = 0;
  state.currentVehicle = null;
  player.position.set(exitX, world.terrainHeight(exitX, exitZ), exitZ);
  player.rotation.set(0, heading, 0);
  state.yaw = heading;
  state.pitch = 0;
  state.jumpHeight = 0;
  state.jumpVelocity = 0;
  state.onGround = true;
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  camera.fov = 76;
  camera.updateProjectionMatrix();
  viewModelRoot.visible = true;
  ui.focusCrosshair(false);
  toast("BACK ON FOOT · PRESS E NEAR A VEHICLE TO BOARD", 1700);
  return true;
}

function updateVehicleMovement(dt) {
  const vehicle = state.currentVehicle;
  if (!vehicle) return;
  const data = vehicle.userData;
  const isPlane = data.vehicleType === "plane";
  const throttle = keys.has("KeyW");
  const brake = keys.has("KeyS");
  const steer = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);

  if (throttle) data.speed = Math.min(isPlane ? 48 : 24, data.speed + (isPlane ? 13 : 12) * dt);
  if (brake) data.speed = Math.max(0, data.speed - (isPlane ? 20 : 18) * dt);
  if (!throttle && !brake) data.speed = Math.max(0, data.speed - (isPlane ? .75 : 2.4) * dt);

  const turnRate = isPlane
    ? .24 + Math.min(data.speed, 42) * .007
    : .18 + Math.min(data.speed, 22) * .052;
  data.heading += steer * turnRate * dt;
  const forwardX = -Math.sin(data.heading);
  const forwardZ = -Math.cos(data.heading);
  const nx = vehicle.position.x + forwardX * data.speed * dt;
  const nz = vehicle.position.z + forwardZ * data.speed * dt;
  const oldGroundY = world.terrainHeight(vehicle.position.x, vehicle.position.z) + (isPlane ? .12 : 0);
  const airborne = isPlane && vehicle.position.y > oldGroundY + 5.5;

  if (airborne) {
    if (!vehiclePositionBlocked(nx, nz, vehicle, 1.25, true)) {
      vehicle.position.x = nx;
      vehicle.position.z = nz;
    }
  } else {
    const clearance = isPlane ? 2.5 : 1.5;
    if (!vehiclePositionBlocked(nx, nz, vehicle, clearance)) {
      vehicle.position.x = nx;
      vehicle.position.z = nz;
    } else {
      if (!vehiclePositionBlocked(nx, vehicle.position.z, vehicle, clearance)) vehicle.position.x = nx;
      if (!vehiclePositionBlocked(vehicle.position.x, nz, vehicle, clearance)) vehicle.position.z = nz;
      // Do not cap throttle here: a plane must be able to build takeoff speed even if
      // a small ground prop briefly blocks its runway. Once airborne, ground clutter is ignored.
    }
  }

  const vehicleObstacle = world.obstacles.find((obstacle) => obstacle.vehicle === vehicle);
  if (vehicleObstacle) {
    vehicleObstacle.x = vehicle.position.x;
    vehicleObstacle.z = vehicle.position.z;
  }
  const groundY = world.terrainHeight(vehicle.position.x, vehicle.position.z) + (isPlane ? .12 : 0);
  if (isPlane) {
    const climb = keys.has("Space") && data.speed > 10;
    const descend = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const targetPitch = climb ? .3 : descend ? -.24 : 0;
    data.pitch = THREE.MathUtils.damp(data.pitch, targetPitch, 2.9, dt);
    data.bank = THREE.MathUtils.damp(data.bank, -steer * .32, 3.2, dt);
    const liftingOff = data.speed > 13 && climb;
    if (vehicle.position.y > groundY + .5 || liftingOff) {
      const verticalSpeed = descend
        ? -Math.max(2.5, data.speed * .18)
        : climb
          ? Math.max(3.5, Math.sin(data.pitch) * data.speed)
          : (data.speed < 12 ? -4.4 : -.22);
      vehicle.position.y += verticalSpeed * dt;
    } else {
      vehicle.position.y = groundY;
      if (!climb) data.pitch = Math.max(0, data.pitch - dt * 1.2);
    }
    if (vehicle.position.y < groundY) {
      vehicle.position.y = groundY;
      if (!climb) data.pitch = 0;
    }
    vehicle.rotation.set(data.pitch, data.heading, data.bank, "YXZ");
    if (data.propeller) data.propeller.rotation.z += dt * (8 + data.speed * 1.9);
    camera.position.set(0, 1.72, .22);
    camera.rotation.set(data.pitch, 0, 0);
  } else {
    vehicle.position.y = groundY;
    vehicle.rotation.set(0, data.heading, 0);
    camera.position.set(0, 1.56, .14);
    camera.rotation.set(0, 0, 0);
  }

  player.position.copy(vehicle.position);
  player.rotation.set(0, data.heading, 0);
  state.yaw = data.heading;
  state.pitch = isPlane ? data.pitch : 0;
  state.jumpHeight = 0;
  state.onGround = true;
  state.aimHeld = false;
  camera.fov = THREE.MathUtils.damp(camera.fov, 76, 9, dt);
  camera.updateProjectionMatrix();
  ui.focusCrosshair(false);
}

function movePlayer(dt) {
  if (!state.playing || ui.isShopOpen()) return;
  if (state.currentVehicle) { updateVehicleMovement(dt); return; }
  const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  const input = new THREE.Vector3();
  if (keys.has("KeyW")) input.add(forward);
  if (keys.has("KeyS")) input.sub(forward);
  if (keys.has("KeyD")) input.add(right);
  if (keys.has("KeyA")) input.sub(right);
  const moving = input.lengthSq() > .01;
  if (moving) {
    input.normalize();
    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const speed = sprinting ? SETTINGS.playerSprintSpeed : SETTINGS.playerWalkSpeed;
    const nx = player.position.x + input.x * speed * dt;
    const nz = player.position.z + input.z * speed * dt;
    if (!lineOfSightBlocked(nx, player.position.z)) player.position.x = nx;
    if (!lineOfSightBlocked(player.position.x, nz)) player.position.z = nz;
  }
  if (!state.onGround) {
    state.jumpVelocity -= SETTINGS.playerGravity * dt;
    state.jumpHeight += state.jumpVelocity * dt;
    if (state.jumpHeight <= 0) {
      state.jumpHeight = 0;
      state.jumpVelocity = 0;
      state.onGround = true;
    }
  }
  player.position.x = THREE.MathUtils.clamp(player.position.x, -SETTINGS.worldSize / 2 + 10, SETTINGS.worldSize / 2 - 10);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -SETTINGS.worldSize / 2 + 10, SETTINGS.worldSize / 2 - 10);
  player.position.y = world.terrainHeight(player.position.x, player.position.z) + state.jumpHeight;
  const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const bob = moving && state.onGround ? Math.sin(state.elapsed * (sprinting ? 14 : 10)) * (sprinting ? .028 : .016) : 0;
  camera.position.y = 1.68 + bob;
  const targetFov = state.aimHeld ? 48 : 76;
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 9, dt);
  camera.updateProjectionMatrix();
  ui.focusCrosshair(state.aimHeld);
  // Slight weapon sway lends weight without making the sights unusable.
  viewModelRoot.position.x = THREE.MathUtils.damp(viewModelRoot.position.x, moving ? Math.sin(state.elapsed * 7) * .009 : 0, 7, dt);
  viewModelRoot.position.y = THREE.MathUtils.damp(viewModelRoot.position.y, moving ? Math.abs(Math.sin(state.elapsed * 10)) * .009 : 0, 7, dt);
  viewModelRoot.position.z = THREE.MathUtils.damp(viewModelRoot.position.z, state.fireCooldown > .06 ? .045 : 0, 15, dt);
}

function flashSoldier(soldier) {
  const data = soldier.userData;
  data.hitFlash = .13;
  soldier.traverse((object) => {
    if (!object.isMesh) return;
    if (!object.userData.damageFlashOriginal) {
      object.userData.damageFlashOriginal = object.material;
      const original = object.material;
      object.material = Array.isArray(original) ? original.map((material) => material.clone()) : original.clone();
    }
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (material.emissive) {
        material.emissive.setHex(0x571b12);
        material.emissiveIntensity = .68;
      }
    }
  });
}
function updateSoldierDamageFlash(dt) {
  for (const soldier of [...world.enemies, ...world.allies]) {
    const data = soldier.userData;
    if (!data.hitFlash || data.hitFlash <= 0) continue;
    data.hitFlash -= dt;
    if (data.hitFlash > 0) continue;
    soldier.traverse((object) => {
      if (!object.isMesh || !object.userData.damageFlashOriginal) return;
      const flashMaterial = object.material;
      object.material = object.userData.damageFlashOriginal;
      const list = Array.isArray(flashMaterial) ? flashMaterial : [flashMaterial];
      for (const material of list) material.dispose();
      delete object.userData.damageFlashOriginal;
    });
  }
}
function damageSoldier(soldier, amount, point = null, sourceTeam = "enemy") {
  const data = soldier.userData;
  if (data.dead) return;
  data.health = Math.max(0, data.health - amount);
  flashSoldier(soldier);
  if (point) effects.push(addImpact(scene, point, 0x9f4634, .24));
  if (data.health <= 0) {
    data.dead = true;
    data.deathTime = 0;
    data.corpseExpiresAt = state.elapsed + 7;
    if (data.weapon) data.weapon.rotation.z = .25;
    if (data.team === "enemy" && sourceTeam === "player") {
      inventory.rewardKill();
      state.playerKills += 1;
      toast("ENEMY ELIMINATED  +35 WAR BONDS");
    } else if (data.team === "enemy" && sourceTeam === "ally") {
      state.alliedKills += 1;
      toast("ALLIED INFANTRY ELIMINATED AN ENEMY", 950);
    } else if (data.team === "ally" && sourceTeam === "enemy") {
      state.enemyKills += 1;
      toast("ALLY DOWN", 900);
    }
    syncHud();
  } else if (sourceTeam === "player") {
    ui.hitmarker();
  }
}

function playerShoot() {
  if (inventory.reloading || state.respawning) return { fired: false, reason: "reloading" };
  const result = inventory.fire();
  if (!result.ok) {
    if (result.reason === "empty" && !state.emptyMessageShown) {
      toast("MAGAZINE EMPTY · PRESS R", 1050);
      state.emptyMessageShown = true;
    }
    state.fireCooldown = .14;
    return { fired: false, reason: "empty" };
  }
  state.emptyMessageShown = false;
  state.fireCooldown = 1 / result.weapon.fireRate;
  state.muzzleUntil = performance.now() + 65;
  muzzleLight.intensity = 2.4;
  muzzleFlash.visible = true;
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  camera.getWorldPosition(origin);
  camera.getWorldDirection(direction);
  const hit = findEnemyHit(camera, world.enemies, world.occluders);
  const end = hit ? hit.point : origin.clone().add(direction.multiplyScalar(180));
  effects.push(addTracer(scene, origin.clone().add(direction.clone().multiplyScalar(.55)), end, 0xf3d399, .085));
  if (hit?.soldier) {
    const headshot = hit.zone === "head" || hit.point.y > hit.soldier.position.y + 1.72;
    const dealt = result.weapon.damage * (headshot ? 1.35 : 1);
    damageSoldier(hit.soldier, dealt, hit.point, "player");
    if (headshot) toast("HEADSHOT", 850);
    else ui.hitmarker();
  } else if (hit?.environment) {
    effects.push(addImpact(scene, hit.point, 0xc2ac82, .22));
  }
  syncHud();
  return { fired: true, hit: Boolean(hit?.soldier), environment: Boolean(hit?.environment),
    targetHealth: hit?.soldier?.userData.health ?? null, weapon: result.weapon.id };
}

function onNpcFire({ from, to, team, target, hitChance, damage }) {
  const baseDirection = new THREE.Vector3().subVectors(to, from);
  const distance = baseDirection.length();
  if (distance < .05) return;

  // NPC accuracy affects the bullet direction; damage only happens if the ray intersects a real hit volume.
  const direction = baseDirection.normalize();
  const accurate = Math.random() < hitChance;
  const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
  if (right.lengthSq() < .001) right.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(right, direction).normalize();
  const spread = distance * (accurate ? .0025 : .025 + Math.random() * .035);
  const aimPoint = to.clone()
    .addScaledVector(right, (Math.random() - .5) * spread)
    .addScaledVector(up, (Math.random() - .5) * spread);
  const shotDirection = aimPoint.sub(from).normalize();
  const ray = new THREE.Raycaster(from, shotDirection, .08, distance + 1.5);
  scene.updateMatrixWorld(true);

  const worldHits = world.occluders.length ? ray.intersectObjects(world.occluders, false) : [];
  const sceneryHit = worldHits.find((hit) => hit.distance > .15 && hit.distance < distance + .3) || null;
  const terrainHit = raycastTerrain(from, shotDirection, distance + .3);
  const possibleBlockers = [sceneryHit, terrainHit].filter((hit) => hit && hit.distance > .15 && hit.distance < distance + .3);
  possibleBlockers.sort((a, b) => a.distance - b.distance);
  const blocker = possibleBlockers[0] || null;

  let targetHit = null;
  if (target.isPlayer && team === "enemy" && !state.respawning) {
    // The player uses a capsule-like body volume, tested along the actual bullet path.
    const center = player.position.clone().add(new THREE.Vector3(0, 1.02, 0));
    const along = center.clone().sub(from).dot(shotDirection);
    if (along >= .08 && along <= distance + .8) {
      const closest = from.clone().addScaledVector(shotDirection, along);
      const radius = .46;
      if (closest.distanceToSquared(center) <= radius * radius) {
        targetHit = { point: closest, distance: along, isPlayer: true };
      }
    }
  } else if (target.unit && !target.unit.userData.dead) {
    // NPC-vs-NPC fire uses target meshes and invisible hitboxes rather than a distance-only damage roll.
    const bodyHits = ray.intersectObject(target.unit, true);
    if (bodyHits.length && bodyHits[0].distance <= distance + .8) {
      targetHit = { point: bodyHits[0].point, distance: bodyHits[0].distance, unit: target.unit };
    }
  }

  const blockedBeforeTarget = blocker && (!targetHit || blocker.distance < targetHit.distance - .1);
  let end = from.clone().addScaledVector(shotDirection, Math.min(distance, 80));
  if (blockedBeforeTarget) end = blocker.point;
  else if (targetHit) end = targetHit.point;
  effects.push(addTracer(scene, from, end, team === "ally" ? 0xe5cb8d : 0xce805e, .075));

  if (blockedBeforeTarget) {
    effects.push(addImpact(scene, blocker.point, blocker.terrain ? 0x8c8165 : 0xb5a27d, .2));
    return;
  }
  if (!targetHit) {
    if (blocker) effects.push(addImpact(scene, blocker.point, blocker.terrain ? 0x8c8165 : 0xb5a27d, .2));
    return;
  }

  if (targetHit.isPlayer) {
    state.health = Math.max(0, state.health - damage);
    ui.damageFlash();
    if (state.health <= 0) respawnPlayer();
    syncHud();
  } else if (targetHit.unit && !targetHit.unit.userData.dead) {
    damageSoldier(targetHit.unit, damage, targetHit.point, team);
  }
}
function respawnPlayer() {
  if (state.respawning) return;
  state.respawning = true;
  state.health = 0;
  inventory.bonds = Math.max(0, inventory.bonds - 25);
  state.fireHeld = false;
  syncHud();
  toast("WOUNDED · FALLING BACK", 1200);
  setTimeout(() => {
    state.health = SETTINGS.startHealth;
    player.position.set(SETTINGS.playerStart.x, world.terrainHeight(SETTINGS.playerStart.x, SETTINGS.playerStart.z), SETTINGS.playerStart.z);
    state.jumpHeight = 0;
    state.jumpVelocity = 0;
    state.respawning = false;
    syncHud();
    toast("BACK IN THE FIGHT · -25 WAR BONDS", 1500);
  }, 1300);
}

function validEnemySpawnPoint(x, z) {
  const edge = SETTINGS.worldSize / 2 - 18;
  if (Math.abs(x) > edge || Math.abs(z) > edge) return false;
  const playerDistance = Math.hypot(x - player.position.x, z - player.position.z);
  if (playerDistance < 34 || playerDistance > 90) return false;

  for (const obstacle of world.obstacles) {
    const dx = x - obstacle.x;
    const dz = z - obstacle.z;
    if (dx * dx + dz * dz < (obstacle.radius + 2.6) ** 2) return false;
  }
  for (const box of world.collisionBoxes) {
    const dx = x - box.x, dz = z - box.z;
    const c = Math.cos(box.rotation), sn = Math.sin(box.rotation);
    const lx = dx * c - dz * sn;
    const lz = dx * sn + dz * c;
    if (Math.abs(lx) < box.halfX + 2 && Math.abs(lz) < box.halfZ + 2) return false;
  }
  for (const unit of [...world.enemies, ...world.allies]) {
    if (unit.userData.dead) continue;
    if (Math.hypot(x - unit.position.x, z - unit.position.z) < 7) return false;
  }
  return true;
}

function spawnEnemyNearPlayer() {
  const forwardX = -Math.sin(state.yaw);
  const forwardZ = -Math.cos(state.yaw);
  const rightX = Math.cos(state.yaw);
  const rightZ = -Math.sin(state.yaw);
  const edge = SETTINGS.worldSize / 2 - 20;
  let chosen = null;

  // Prefer a position beyond the player's view, in the direction of travel, but never inside a wall.
  for (let attempt = 0; attempt < 55; attempt++) {
    const distance = 42 + Math.random() * 24;
    const lateral = (Math.random() - .5) * 58;
    const x = THREE.MathUtils.clamp(
      player.position.x + forwardX * distance + rightX * lateral, -edge, edge
    );
    const z = THREE.MathUtils.clamp(
      player.position.z + forwardZ * distance + rightZ * lateral, -edge, edge
    );
    if (validEnemySpawnPoint(x, z)) { chosen = { x, z }; break; }
  }

  // If the forward lane is blocked by scenery, search a full ring around the player.
  if (!chosen) {
    for (let attempt = 0; attempt < 70; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 42 + Math.random() * 23;
      const x = THREE.MathUtils.clamp(player.position.x + Math.cos(angle) * distance, -edge, edge);
      const z = THREE.MathUtils.clamp(player.position.z + Math.sin(angle) * distance, -edge, edge);
      if (validEnemySpawnPoint(x, z)) { chosen = { x, z }; break; }
    }
  }
  if (!chosen) return null;

  const enemy = world.spawnEnemy(chosen.x, chosen.z);
  state.totalEnemySpawns += 1;
  return enemy;
}

function cleanupExpiredCorpses() {
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const soldier = world.enemies[i];
    if (!soldier.userData.dead || state.elapsed < (soldier.userData.corpseExpiresAt ?? Infinity)) continue;
    world.actors.remove(soldier);
    soldier.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
    });
    world.enemies.splice(i, 1);
  }
}

function updateEnemyReinforcements(dt) {
  cleanupExpiredCorpses();
  state.enemySpawnTimer -= dt;
  const active = countLivingEnemies();
  const maxActiveEnemies = 12;
  if (active < maxActiveEnemies && state.enemySpawnTimer <= 0) {
    const spawned = spawnEnemyNearPlayer();
    // If the battlefield is too crowded to find a safe spawn, retry soon.
    state.enemySpawnTimer = spawned ? (active < 4 ? 1.15 : 1.85) : .65;
    if (spawned && active < 4) toast("ENEMY REINFORCEMENTS APPROACHING", 1100);
  }
}

function hideReloadVisual() {
  reloadArm.visible = false;
  magazineMesh.visible = false;
  drumMagazineMesh.visible = false;
  for (const bullet of reloadBullets) bullet.visible = false;
}
function startReloadVisual() {
  const active = inventory.current;
  reloadArm.visible = true;
  const usesMagazine = ["smg", "mp40", "lmg", "assault", "mg"].includes(active.type);
  magazineMesh.visible = usesMagazine && active.type !== "smg";
  drumMagazineMesh.visible = active.type === "smg";
  if (usesMagazine) magazineMesh.position.set(.22, -.55, -.64);
  if (active.type === "smg") drumMagazineMesh.position.set(.15, -.47, -.73);
  for (const bullet of reloadBullets) bullet.visible = !usesMagazine;
}
function updateReloadVisual() {
  if (state.currentVehicle) {
    hideReloadVisual();
    return;
  }
  if (!inventory.reloading) {
    hideReloadVisual();
    return;
  }
  const active = inventory.current;
  const progress = THREE.MathUtils.clamp(inventory.reloadElapsed / active.reloadTime, 0, 1);
  reloadArm.position.set(Math.sin(progress * Math.PI) * -.025, Math.sin(progress * Math.PI) * .035, 0);
  if (["smg", "mp40", "lmg", "assault", "mg"].includes(active.type)) {
    const magazineVisible = progress > .12 && progress < .72;
    magazineMesh.visible = magazineVisible && active.type !== "smg";
    drumMagazineMesh.visible = magazineVisible && active.type === "smg";
    magazineMesh.position.y = THREE.MathUtils.lerp(-.52, -.75, Math.sin(progress * Math.PI));
    drumMagazineMesh.position.y = THREE.MathUtils.lerp(-.43, -.68, Math.sin(progress * Math.PI));
  } else {
    const count = Math.min(8, active.magazine - active.ammo, active.reserveAmmo);
    const span = .52;
    for (let i = 0; i < reloadBullets.length; i++) {
      const bullet = reloadBullets[i];
      const startTime = .12 + i * span / Math.max(1, count);
      const endTime = startTime + .12;
      const local = THREE.MathUtils.clamp((progress - startTime) / (endTime - startTime), 0, 1);
      const visible = i < count && progress >= startTime && progress < endTime + .07;
      bullet.visible = visible;
      bullet.position.set(
        THREE.MathUtils.lerp(-.22 + (i % 2) * .035, .18, local),
        THREE.MathUtils.lerp(-.35, -.40, local),
        THREE.MathUtils.lerp(-.55, -.86, local)
      );
    }
  }
  if (progress > .78) {
    magazineMesh.visible = false;
    drumMagazineMesh.visible = false;
    for (const bullet of reloadBullets) bullet.visible = false;
  }
}

function updateEffects(dt) {
  updateSoldierDamageFlash(dt);
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    if (!effect) { effects.splice(i, 1); continue; }
    effect.userData.life = (effect.userData.life ?? .1) - dt;
    if (effect.userData.velocity) effect.position.addScaledVector(effect.userData.velocity, dt);
    if (effect.children?.length) {
      for (const particle of effect.children) {
        if (particle.userData.velocity) {
          particle.position.addScaledVector(particle.userData.velocity, dt);
          particle.userData.velocity.y -= 4.8 * dt;
          particle.userData.life -= dt;
          if (particle.material && particle.userData.life > 0) {
            particle.material.opacity = Math.min(.9, particle.userData.life * 3.5);
          }
        }
      }
    }
    if (effect.userData.life <= 0) {
      if (effect.parent) effect.parent.remove(effect);
      effect.traverse?.((child) => {
        if (child.material) child.material.dispose();
      });
      if (effect.geometry) effect.geometry.dispose();
      if (effect.material) effect.material.dispose();
      effects.splice(i, 1);
    }
  }
  for (const particle of world.dust) {
    particle.position.x += Math.sin(state.elapsed * .25 + particle.position.z) * dt * particle.userData.drift;
    particle.position.y += Math.sin(state.elapsed + particle.position.x) * dt * .12;
    if (particle.position.y > 11) particle.position.y = .5;
  }
  if (performance.now() > state.muzzleUntil) {
    muzzleLight.intensity = 0;
    muzzleFlash.visible = false;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .035);
  state.elapsed += dt;
  if (state.playing && !ui.isShopOpen()) {
    movePlayer(dt);
    if (state.fireCooldown > 0) state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    if (state.fireHeld && !state.currentVehicle && state.fireCooldown <= 0 && !inventory.reloading) playerShoot();
    if (inventory.update(dt)) {
      reloadArm.visible = false;
      magazineMesh.visible = false;
      drumMagazineMesh.visible = false;
      for (const bullet of reloadBullets) bullet.visible = false;
      toast("WEAPON READY", 800);
      syncHud();
    }
    updateReloadVisual();
    updateAI(dt, world, player, { onNpcFire });
    updateEnemyReinforcements(dt);
    if (state.respawning) state.fireHeld = false;
    hudTimer -= dt;
    if (hudTimer <= 0) { syncHud(); hudTimer = .12; }
  }
  updateEffects(dt);
  renderer.render(scene, camera);
}
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
});

animate();

// A query-string-only helper enables repeatable browser regression tests without exposing
// debug controls during normal gameplay.
if (new URLSearchParams(window.location.search).has("test")) {
  window.__IRON_FRONT_TEST__ = {
    getStats() {
      return {
        ready: true,
        weaponCount: inventory.items.length,
        enemyCount: world.enemies.length,
        activeEnemies: countLivingEnemies(),
        totalEnemySpawns: state.totalEnemySpawns,
        allyCount: world.allies.filter((unit) => !unit.userData.dead).length,
        occluderCount: world.occluders.length,
        collisionCount: world.obstacles.length + world.collisionBoxes.length,
        teamMarkers: {
          ally: world.materials.alliedMark.color.getHexString(),
          enemy: world.materials.enemyMark.color.getHexString()
        },
        vehicles: world.vehicles.map((vehicle) => ({
          type: vehicle.userData.vehicleType,
          position: [vehicle.position.x, vehicle.position.y, vehicle.position.z],
          occupied: vehicle.userData.occupied
        })),
        currentVehicle: state.currentVehicle?.userData.vehicleType ?? null,
        bonds: inventory.bonds,
        weapon: inventory.current.id,
        ammo: inventory.current.ammo,
        health: state.health
      };
    },
    vehicleViews() {
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      return world.vehicles.map((vehicle) => {
        const label = vehicle.children.find((child) => child.isSprite);
        const point = (label || vehicle).getWorldPosition(new THREE.Vector3()).project(camera);
        return {
          type: vehicle.userData.vehicleType,
          visible: vehicle.visible && (!label || label.visible),
          screen: [point.x, point.y, point.z],
          inView: point.z >= -1 && point.z <= 1 &&
            Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1
        };
      });
    },
    enemyPositions() {
      return world.enemies.map((unit, index) => ({
        index, dead: unit.userData.dead,
        position: [unit.position.x, unit.position.y, unit.position.z]
      }));
    },
    mountVehicleTest(type) {
      state.playing = true;
      ui.hideStart();
      const vehicle = world.vehicles.find((candidate) => candidate.userData.vehicleType === type);
      const mounted = mountVehicle(vehicle);
      return { mounted, currentVehicle: state.currentVehicle?.userData.vehicleType ?? null };
    },
    driveVehicleTest(seconds = .5) {
      if (!state.currentVehicle) return { moved: false, reason: "not mounted" };
      const vehicle = state.currentVehicle;
      const before = vehicle.position.clone();
      keys.add("KeyW");
      if (vehicle.userData.vehicleType === "plane") keys.add("Space");
      let remaining = Math.max(.01, Math.min(3, seconds));
      while (remaining > 0) {
        const step = Math.min(1 / 60, remaining);
        updateVehicleMovement(step);
        remaining -= step;
      }
      keys.delete("KeyW");
      keys.delete("Space");
      return {
        moved: before.distanceTo(vehicle.position) > .05,
        type: vehicle.userData.vehicleType,
        speed: vehicle.userData.speed,
        position: [vehicle.position.x, vehicle.position.y, vehicle.position.z],
        altitude: vehicle.position.y - world.terrainHeight(vehicle.position.x, vehicle.position.z)
      };
    },
    landVehicleTest() {
      const vehicle = state.currentVehicle;
      if (!vehicle || vehicle.userData.vehicleType !== "plane") return { landed: false };
      vehicle.position.y = world.terrainHeight(vehicle.position.x, vehicle.position.z) + .12;
      vehicle.userData.pitch = 0;
      vehicle.userData.bank = 0;
      vehicle.rotation.set(0, vehicle.userData.heading, 0, "YXZ");
      player.position.copy(vehicle.position);
      return { landed: true };
    },
    leaveVehicleTest() {
      const left = leaveVehicle();
      return { left, currentVehicle: state.currentVehicle?.userData.vehicleType ?? null };
    },
    spawnEnemyTest() {
      const before = world.enemies.length;
      const enemy = spawnEnemyNearPlayer();
      return { spawned: Boolean(enemy), before, after: world.enemies.length, active: countLivingEnemies() };
    },
    reinforcementTest() {
      const beforeTotal = state.totalEnemySpawns;
      const beforeActive = countLivingEnemies();
      const victim = world.enemies.find((unit) => !unit.userData.dead);
      if (!victim) return { spawned: false, reason: "no active enemy" };
      victim.userData.dead = true;
      victim.userData.health = 0;
      victim.userData.corpseExpiresAt = state.elapsed + 7;
      state.enemySpawnTimer = .001;
      updateEnemyReinforcements(.01);
      return {
        spawned: state.totalEnemySpawns > beforeTotal,
        beforeTotal, afterTotal: state.totalEnemySpawns,
        beforeActive, afterActive: countLivingEnemies()
      };
    },
    reloadTest() {
      const weapon = inventory.current;
      weapon.ammo = Math.max(0, weapon.magazine - 3);
      const beforeReserve = weapon.reserveAmmo;
      const result = inventory.startReload();
      if (result.ok) inventory.update(weapon.reloadTime + .02);
      syncHud();
      return { ok: result.ok, ammo: weapon.ammo, magazine: weapon.magazine,
        reserveBefore: beforeReserve, reserveAfter: weapon.reserveAmmo, reloading: inventory.reloading };
    },
    prepareTarget() {
      state.playing = false;
      state.fireHeld = false;
      state.aimHeld = false;
      ui.hideStart();
      ui.hideShop();
      state.health = SETTINGS.startHealth;
      player.position.set(SETTINGS.playerStart.x, world.terrainHeight(SETTINGS.playerStart.x, SETTINGS.playerStart.z), SETTINGS.playerStart.z);
      state.jumpHeight = 0;
      const target = world.enemies.find((unit) => !unit.userData.dead) || world.enemies[0];
      target.position.set(0, world.terrainHeight(0, 5), 5);
      target.userData.health = 100;
      target.userData.dead = false;
      target.rotation.set(0, 0, 0);
      camera.position.set(0, 1.68, 0);
      const origin = player.position.clone().add(new THREE.Vector3(0, 1.68, 0));
      const targetPoint = target.position.clone().add(new THREE.Vector3(0, 1.94, .01));
      const delta = targetPoint.sub(origin);
      state.yaw = Math.atan2(-delta.x, -delta.z);
      state.pitch = Math.atan2(delta.y, Math.hypot(delta.x, delta.z));
      player.rotation.y = state.yaw;
      camera.rotation.set(state.pitch, 0, 0);
      scene.updateMatrixWorld(true);
      return { health: target.userData.health, enemy: [target.position.x, target.position.y, target.position.z] };
    },
    fireTestShot() {
      const saved = world.occluders.splice(0, world.occluders.length);
      try { return playerShoot(); }
      finally { world.occluders.push(...saved); }
    },
    enemyTestShot() {
      const saved = world.occluders.splice(0, world.occluders.length);
      const enemy = world.enemies.find((unit) => !unit.userData.dead) || world.enemies[0];
      try {
        onNpcFire({
          from: new THREE.Vector3(0, 1.5, 4),
          to: player.position.clone().add(new THREE.Vector3(0, 1.02, 0)),
          team: "enemy",
          target: { isPlayer: true, position: player.position },
          hitChance: 1,
          damage: 23
        });
      } finally { world.occluders.push(...saved); }
      return { health: state.health, enemyCount: world.enemies.length, source: enemy?.userData.team };
    }
  };
  window.__IRON_FRONT_READY__ = true;
} else {
  window.__IRON_FRONT_READY__ = true;
}
