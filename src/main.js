import * as THREE from "three";
import { SETTINGS } from "./config.js";
import { createWorld, createWeaponModel } from "./world.js";
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
  respawning: false
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
  if (viewWeapon) viewModelRoot.remove(viewWeapon);
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
const magazineMesh = new THREE.Mesh(new THREE.BoxGeometry(.09, .23, .12), world.materials.steelDark);
magazineMesh.position.set(.16, -.44, -.73);
magazineMesh.visible = false;
camera.add(magazineMesh);

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
  if (state.playing) renderer.domElement.requestPointerLock?.();
}
function startGame() {
  state.playing = true;
  ui.hideStart();
  renderer.domElement.requestPointerLock?.();
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

function syncHud() {
  window.gameHealth = state.health;
  ui.update(inventory, state.health, 1, state.playerKills + state.alliedKills, state.enemyKills);
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
  if (event.code === "Digit1") equipHotkey(0);
  if (event.code === "Digit2") equipHotkey(1);
  if (event.code === "Digit3") equipHotkey(2);
  if (event.code === "Digit4") equipHotkey(3);
  if (event.code === "Space" && state.playing && state.onGround && !ui.isShopOpen()) {
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
    if (!state.pointerLocked) renderer.domElement.requestPointerLock?.();
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
  if (!state.pointerLocked || !state.playing || ui.isShopOpen()) return;
  state.yaw -= event.movementX * .0021;
  state.pitch -= event.movementY * .0021;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -1.28, 1.22);
  player.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
});

function lineOfSightBlocked(x, z) {
  // Physical proximity colliders for buildings, trees, vehicles, rubble and defensive positions.
  for (const obstacle of world.obstacles) {
    const dx = x - obstacle.x, dz = z - obstacle.z;
    const distanceSq = dx * dx + dz * dz;
    const radius = obstacle.radius + .62;
    if (distanceSq < radius * radius) {
      const oldDx = player.position.x - obstacle.x;
      const oldDz = player.position.z - obstacle.z;
      const oldDistanceSq = oldDx * oldDx + oldDz * oldDz;
      // If the spawn or a collision put the player inside a collider, allow movement outward.
      if (!(oldDistanceSq < radius * radius && distanceSq > oldDistanceSq + .0001)) return true;
    }
  }
  // Infantry have a body collider too, so the player cannot walk through the squad.
  for (const soldier of [...world.enemies, ...world.allies]) {
    if (soldier.userData.dead) continue;
    const dx = x - soldier.position.x, dz = z - soldier.position.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < .78 * .78) {
      const oldDx = player.position.x - soldier.position.x;
      const oldDz = player.position.z - soldier.position.z;
      if (!(oldDx * oldDx + oldDz * oldDz < .78 * .78 &&
            distanceSq > oldDx * oldDx + oldDz * oldDz + .0001)) return true;
    }
  }
  return false;
}
function movePlayer(dt) {
  if (!state.playing || ui.isShopOpen()) return;
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

function damageSoldier(soldier, amount, point = null, fromPlayer = false) {
  const data = soldier.userData;
  if (data.dead) return;
  data.health -= amount;
  data.hitFlash = .08;
  if (point) effects.push(addImpact(scene, point, 0x9f4634, .24));
  if (data.health <= 0) {
    data.health = 0;
    data.dead = true;
    data.deathTime = 0;
    data.weapon?.rotation.z && (data.weapon.rotation.z = .25);
    if (fromPlayer) {
      inventory.rewardKill();
      state.playerKills += 1;
      toast("ENEMY ELIMINATED  +35 WAR BONDS");
    } else {
      state.alliedKills += data.team === "enemy" ? 1 : 0;
    }
    syncHud();
  } else if (fromPlayer) {
    ui.hitmarker();
  }
}

function playerShoot() {
  if (inventory.reloading || state.respawning) return;
  const result = inventory.fire();
  if (!result.ok) {
    if (result.reason === "empty" && !state.emptyMessageShown) {
      toast("MAGAZINE EMPTY · PRESS R", 1050);
      state.emptyMessageShown = true;
    }
    state.fireCooldown = .14;
    return;
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
    const headshot = hit.point.y > hit.soldier.position.y + 1.72;
    const dealt = result.weapon.damage * (headshot ? 1.35 : 1);
    damageSoldier(hit.soldier, dealt, hit.point, true);
    if (headshot) toast("HEADSHOT", 850);
    else ui.hitmarker();
  } else if (hit?.environment) {
    effects.push(addImpact(scene, hit.point, 0xc2ac82, .22));
  }
  syncHud();
}

function onNpcFire({ from, to, team, target, hitChance, damage }) {
  const delta = new THREE.Vector3().subVectors(to, from);
  const distance = delta.length();
  const direction = delta.clone().normalize();
  const ray = new THREE.Raycaster(from, direction, .15, Math.max(.15, distance - .3));
  scene.updateMatrixWorld(true);
  const blockers = world.occluders.length ? ray.intersectObjects(world.occluders, false) : [];
  const blockingHit = blockers.find((hit) => hit.distance < distance - .3);
  const end = blockingHit ? blockingHit.point : to.clone();
  effects.push(addTracer(scene, from, end, team === "ally" ? 0xe5cb8d : 0xce805e, .075));
  if (blockingHit) {
    effects.push(addImpact(scene, blockingHit.point, 0xb5a27d, .2));
    return;
  }
  if (Math.random() > hitChance) return;
  if (target.isPlayer) {
    if (team !== "enemy" || state.respawning) return;
    state.health = Math.max(0, state.health - damage);
    ui.damageFlash();
    if (state.health <= 0) respawnPlayer();
    syncHud();
  } else if (target.unit && !target.unit.userData.dead) {
    damageSoldier(target.unit, damage, end, false);
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

function hideReloadVisual() {
  reloadArm.visible = false;
  magazineMesh.visible = false;
  for (const bullet of reloadBullets) bullet.visible = false;
}
function startReloadVisual() {
  const active = inventory.current;
  reloadArm.visible = true;
  magazineMesh.visible = active.type === "smg" || active.type === "lmg";
  if (active.type === "smg" || active.type === "lmg") {
    magazineMesh.position.set(.22, -.55, -.64);
  }
  for (const bullet of reloadBullets) bullet.visible = active.type !== "smg" && active.type !== "lmg";
}
function updateReloadVisual() {
  if (!inventory.reloading) {
    reloadArm.visible = false;
    magazineMesh.visible = false;
    for (const bullet of reloadBullets) bullet.visible = false;
    return;
  }
  const active = inventory.current;
  const progress = THREE.MathUtils.clamp(inventory.reloadElapsed / active.reloadTime, 0, 1);
  reloadArm.position.set(Math.sin(progress * Math.PI) * -.025, Math.sin(progress * Math.PI) * .035, 0);
  if (active.type === "smg" || active.type === "lmg") {
    magazineMesh.visible = progress > .12 && progress < .72;
    magazineMesh.position.y = THREE.MathUtils.lerp(-.52, -.75, Math.sin(progress * Math.PI));
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
    for (const bullet of reloadBullets) bullet.visible = false;
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    if (!effect) { effects.splice(i, 1); continue; }
    effect.userData.life = (effect.userData.life ?? .1) - dt;
    if (effect.userData.velocity) effect.position.addScaledVector(effect.userData.velocity, dt);
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
    if (state.fireHeld && state.fireCooldown <= 0 && !inventory.reloading) playerShoot();
    if (inventory.update(dt)) {
      reloadArm.visible = false;
      magazineMesh.visible = false;
      for (const bullet of reloadBullets) bullet.visible = false;
      toast("WEAPON READY", 800);
      syncHud();
    }
    updateReloadVisual();
    updateAI(dt, world, player, { onNpcFire });
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
