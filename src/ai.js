import * as THREE from "three";
import { terrainHeight } from "./world.js";

function alive(list) {
  return list.filter((unit) => !unit.userData.dead && unit.userData.health > 0);
}
function nearestUnit(from, units) {
  let found = null;
  let bestDistance = Infinity;
  for (const unit of units) {
    if (unit.userData.dead || unit.userData.health <= 0) continue;
    const d = from.position.distanceTo(unit.position);
    if (d < bestDistance) { bestDistance = d; found = unit; }
  }
  return found ? { unit: found, distance: bestDistance } : null;
}
function desiredDirection(from, target, obstacles, team) {
  const direction = new THREE.Vector3(target.x - from.position.x, 0, target.z - from.position.z);
  if (direction.lengthSq() < .01) return direction;
  direction.normalize();
  const avoidance = new THREE.Vector3();
  for (const obstacle of obstacles) {
    const dx = from.position.x - obstacle.x;
    const dz = from.position.z - obstacle.z;
    const distanceSq = dx * dx + dz * dz;
    const desiredRadius = obstacle.radius + 1.55;
    if (distanceSq < desiredRadius * desiredRadius && distanceSq > .001) {
      const distance = Math.sqrt(distanceSq);
      const strength = (desiredRadius - distance) / desiredRadius;
      avoidance.x += (dx / distance) * strength * (obstacle.kind === "building" ? 2.8 : 1.5);
      avoidance.z += (dz / distance) * strength * (obstacle.kind === "building" ? 2.8 : 1.5);
    }
  }
  direction.add(avoidance.multiplyScalar(1.5));
  if (direction.lengthSq() > .001) direction.normalize();
  return direction;
}
function walk(unit, direction, speed, dt, world) {
  const u = unit.userData;
  const moving = direction.lengthSq() > .03;
  if (moving) {
    direction.normalize();
    const nextX = unit.position.x + direction.x * speed * dt;
    const nextZ = unit.position.z + direction.z * speed * dt;
    const clear = (x, z) => {
      for (const obstacle of world.obstacles) {
        const dx = x - obstacle.x, dz = z - obstacle.z;
        const distanceSq = dx * dx + dz * dz;
        const radius = obstacle.radius + .42;
        if (distanceSq < radius * radius) {
          const oldDx = unit.position.x - obstacle.x;
          const oldDz = unit.position.z - obstacle.z;
          const oldDistanceSq = oldDx * oldDx + oldDz * oldDz;
          // A unit trapped on spawn can step outward and recover.
          if (!(oldDistanceSq < radius * radius && distanceSq > oldDistanceSq + .0001)) return false;
        }
      }
      // Avoid body overlap, but allow an already-overlapping unit to move apart.
      const everybody = [...world.enemies, ...world.allies];
      for (const other of everybody) {
        if (other === unit || other.userData.dead) continue;
        const dx = x - other.position.x, dz = z - other.position.z;
        const distSq = dx * dx + dz * dz;
        const radius = .66;
        if (distSq < radius * radius) {
          const oldDx = unit.position.x - other.position.x;
          const oldDz = unit.position.z - other.position.z;
          const oldSq = oldDx * oldDx + oldDz * oldDz;
          if (!(oldSq < radius * radius && distSq > oldSq + .0001)) return false;
        }
      }
      return true;
    };
    if (clear(nextX, nextZ)) {
      unit.position.x = nextX;
      unit.position.z = nextZ;
    } else {
      // Try a side-step rather than letting units freeze against a wall.
      const side = new THREE.Vector3(-direction.z, 0, direction.x);
      let moved = false;
      for (const sign of [1, -1]) {
        const sx = unit.position.x + side.x * speed * dt * sign;
        const sz = unit.position.z + side.z * speed * dt * sign;
        if (clear(sx, sz)) { unit.position.x = sx; unit.position.z = sz; moved = true; break; }
      }
      if (!moved) {
        const tangent = new THREE.Vector3(direction.x + side.x * u.strafe * .55, 0,
          direction.z + side.z * u.strafe * .55).normalize();
        const tx = unit.position.x + tangent.x * speed * dt * .45;
        const tz = unit.position.z + tangent.z * speed * dt * .45;
        if (clear(tx, tz)) { unit.position.x = tx; unit.position.z = tz; }
      }
    }
    unit.position.y = world.terrainHeight(unit.position.x, unit.position.z);
    unit.rotation.y = Math.atan2(direction.x, direction.z);
    u.animationSpeed = Math.min(1, u.animationSpeed + dt * 5);
  } else {
    u.animationSpeed = Math.max(0, u.animationSpeed - dt * 4);
  }
  u.phase += dt * (moving ? 9 : 1.2);
  const swing = Math.sin(u.phase) * .48 * u.animationSpeed;
  for (let i = 0; i < u.legs.length; i++) u.legs[i].rotation.x = (i === 0 ? swing : -swing);
  for (let i = 0; i < u.arms.length; i++) u.arms[i].rotation.x = (i === 0 ? -swing * .35 : swing * .35);
  if (u.dead) {
    u.deathTime = (u.deathTime || 0) + dt;
    unit.rotation.x = Math.min(1.2, u.deathTime * 2.1);
    unit.rotation.z = u.strafe * Math.min(.7, u.deathTime * 1.0);
    const groundY = world.terrainHeight(unit.position.x, unit.position.z) - .2;
    unit.position.y = Math.max(groundY, unit.position.y - dt * .22);
  }
}

export function updateAI(dt, world, player, callbacks) {
  const enemies = alive(world.enemies);
  const allies = alive(world.allies);
  const playerPos = { x: player.position.x, z: player.position.z };
  const objective = { x: 0, z: -18 };

  for (const enemy of world.enemies) {
    const u = enemy.userData;
    if (u.dead) { walk(enemy, new THREE.Vector3(), 0, dt, world); continue; }
    const distanceToPlayer = Math.hypot(playerPos.x - enemy.position.x, playerPos.z - enemy.position.z);
    const nearestAlly = nearestUnit(enemy, allies);
    let target = null;
    let distance = Infinity;
    // Enemies prioritize the player when close, otherwise they advance toward allied positions.
    if (distanceToPlayer < 95) {
      target = { position: player.position, isPlayer: true };
      distance = distanceToPlayer;
    } else if (nearestAlly) {
      target = { position: nearestAlly.unit.position, isPlayer: false, unit: nearestAlly.unit };
      distance = nearestAlly.distance;
    }
    const destination = target ? { x: target.position.x, z: target.position.z } : objective;
    const direction = desiredDirection(enemy, destination, world.obstacles, "enemy");
    if (!target || distance > 24) {
      walk(enemy, direction, u.walkSpeed || 2.7, dt, world);
    } else {
      // In a firefight soldiers reposition and strafe instead of standing like mannequins.
      const strafe = new THREE.Vector3(-direction.z * u.strafe, 0, direction.x * u.strafe);
      const closePressure = distance < 9 ? -0.45 : 0.2;
      const movement = strafe.add(direction.clone().multiplyScalar(closePressure));
      walk(enemy, movement, 1.05, dt, world);
      enemy.rotation.y = Math.atan2(target.position.x - enemy.position.x, target.position.z - enemy.position.z);
      u.cooldown -= dt;
      if (u.cooldown <= 0) {
        const from = enemy.position.clone().add(new THREE.Vector3(0, 1.48, 0));
        const targetPoint = target.isPlayer
          ? player.position.clone().add(new THREE.Vector3(0, 1.45, 0))
          : target.position.clone().add(new THREE.Vector3(0, 1.35, 0));
        const hitChance = THREE.MathUtils.clamp(.52 - distance * .004 + (distance < 12 ? .1 : 0), .12, .62);
        callbacks.onNpcFire({ from, to: targetPoint, team: "enemy", target, hitChance, damage: 9 + Math.random() * 5 });
        u.cooldown = 1.0 + Math.random() * 1.1;
      }
    }
  }

  for (const ally of world.allies) {
    const u = ally.userData;
    if (u.dead) { walk(ally, new THREE.Vector3(), 0, dt, world); continue; }
    const nearestEnemy = nearestUnit(ally, enemies);
    let target = nearestEnemy ? nearestEnemy.unit : null;
    let distance = nearestEnemy ? nearestEnemy.distance : Infinity;
    const fallback = { x: player.position.x + (u.formationOffsetX ?? 0), z: Math.max(player.position.z - 7, -8) };
    if (!target) {
      const toFallback = new THREE.Vector3(fallback.x - ally.position.x, 0, fallback.z - ally.position.z);
      if (toFallback.length() > 4) walk(ally, desiredDirection(ally, fallback, world.obstacles, "ally"), 2.0, dt, world);
      else walk(ally, new THREE.Vector3(), 0, dt, world);
      continue;
    }
    const destination = { x: target.position.x, z: target.position.z };
    const direction = desiredDirection(ally, destination, world.obstacles, "ally");
    if (distance > 19) {
      walk(ally, direction, u.walkSpeed || 2.45, dt, world);
    } else {
      const coverStrafe = new THREE.Vector3(-direction.z * u.strafe, 0, direction.x * u.strafe);
      walk(ally, distance < 8 ? direction.clone().multiplyScalar(-.3).add(coverStrafe) : coverStrafe, .75, dt, world);
      ally.rotation.y = Math.atan2(target.position.x - ally.position.x, target.position.z - ally.position.z);
      u.cooldown -= dt;
      if (u.cooldown <= 0) {
        const from = ally.position.clone().add(new THREE.Vector3(0, 1.45, 0));
        const to = target.position.clone().add(new THREE.Vector3(0, 1.3, 0));
        callbacks.onNpcFire({ from, to, team: "ally", target: { position: target.position, isPlayer: false, unit: target },
          hitChance: THREE.MathUtils.clamp(.78 - distance * .003, .35, .8), damage: 11 + Math.random() * 9 });
        u.cooldown = 1.25 + Math.random() * 1.05;
      }
    }
  }
}
