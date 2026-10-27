import * as THREE from "three";
import { WEAPONS } from "./config.js";

export class WeaponInventory {
  constructor(startingBonds = 200) {
    this.items = WEAPONS.map((weapon, index) => ({
      ...weapon,
      ammo: weapon.magazine,
      reserveAmmo: weapon.reserve,
      owned: index === 0
    }));
    this.current = this.items[0];
    this.bonds = startingBonds;
    this.kills = 0;
    this.reloading = false;
    this.reloadElapsed = 0;
  }

  equip(id) {
    const weapon = this.items.find((item) => item.id === id);
    if (!weapon || !weapon.owned) return { ok: false, message: "You do not own this weapon yet." };
    if (this.reloading) this.cancelReload();
    this.current = weapon;
    return { ok: true, message: weapon.name + " EQUIPPED" };
  }

  buyOrEquip(id) {
    const weapon = this.items.find((item) => item.id === id);
    if (!weapon) return { ok: false, message: "Weapon unavailable." };
    if (weapon.owned) return this.equip(id);
    if (this.bonds < weapon.cost) {
      return { ok: false, message: "NOT ENOUGH WAR BONDS · NEED " + weapon.cost };
    }
    this.bonds -= weapon.cost;
    weapon.owned = true;
    this.current = weapon;
    if (this.reloading) this.cancelReload();
    return { ok: true, purchased: true, message: weapon.name + " ACQUIRED" };
  }

  fire() {
    if (this.reloading) return { ok: false, reason: "reloading" };
    if (this.current.ammo <= 0) return { ok: false, reason: "empty" };
    this.current.ammo -= 1;
    return { ok: true, weapon: this.current };
  }

  startReload() {
    if (this.reloading) return { ok: false, message: "ALREADY RELOADING" };
    if (this.current.ammo >= this.current.magazine) return { ok: false, message: "MAGAZINE ALREADY FULL" };
    if (this.current.reserveAmmo <= 0) return { ok: false, message: "NO RESERVE AMMUNITION" };
    this.reloading = true;
    this.reloadElapsed = 0;
    return { ok: true, duration: this.current.reloadTime };
  }

  update(dt) {
    if (!this.reloading) return false;
    this.reloadElapsed += dt;
    if (this.reloadElapsed < this.current.reloadTime) return false;
    const needed = this.current.magazine - this.current.ammo;
    const loaded = Math.min(needed, this.current.reserveAmmo);
    this.current.ammo += loaded;
    this.current.reserveAmmo -= loaded;
    this.reloading = false;
    this.reloadElapsed = 0;
    return true;
  }

  cancelReload() {
    this.reloading = false;
    this.reloadElapsed = 0;
  }

  rewardKill() {
    this.kills += 1;
    this.bonds += 35;
  }
}

export function findEnemyHit(camera, enemies, maxDistance = 260) {
  const alive = enemies.filter((enemy) => !enemy.userData.dead && enemy.userData.health > 0);
  if (!alive.length) return null;
  camera.updateMatrixWorld(true);
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const raycaster = new THREE.Raycaster(origin, direction, 0, maxDistance);
  const hits = raycaster.intersectObjects(alive, true);
  if (!hits.length) return null;
  let root = hits[0].object;
  while (root && root.userData.kind !== "soldier") root = root.parent;
  if (!root || root.userData.team !== "enemy" || root.userData.dead) return null;
  return { soldier: root, point: hits[0].point, distance: hits[0].distance };
}

export function addTracer(scene, from, to, color = 0xf4d19a, lifetime = .095) {
  const delta = new THREE.Vector3().subVectors(to, from);
  const length = delta.length();
  if (length < .01) return null;
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .92, depthWrite: false });
  const tracer = new THREE.Mesh(new THREE.CylinderGeometry(.012, .022, length, 5), material);
  tracer.position.copy(from).add(to).multiplyScalar(.5);
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  tracer.userData.effect = true;
  tracer.userData.life = lifetime;
  scene.add(tracer);
  return tracer;
}

export function addImpact(scene, point, color = 0xb4a17b, lifetime = .35) {
  const group = new THREE.Group();
  group.position.copy(point);
  for (let i = 0; i < 4; i++) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9 });
    const spark = new THREE.Mesh(new THREE.SphereGeometry(.025 + Math.random() * .025, 5, 5), material);
    spark.position.set((Math.random() - .5) * .16, Math.random() * .14, (Math.random() - .5) * .16);
    spark.userData.effect = true;
    spark.userData.life = lifetime * (.55 + Math.random() * .45);
    spark.userData.velocity = new THREE.Vector3((Math.random() - .5) * 1.8, .4 + Math.random() * 1.4, (Math.random() - .5) * 1.8);
    group.add(spark);
  }
  scene.add(group);
  return group;
}
