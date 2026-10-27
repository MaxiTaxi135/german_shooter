import * as THREE from "three";
import { SETTINGS } from "./config.js";

export function terrainHeight(x, z) {
  return 0.24 * Math.sin(x * 0.031) * Math.cos(z * 0.026)
       + 0.16 * Math.sin((x + z) * 0.047)
       + 0.08 * Math.cos(z * 0.091);
}

function noiseTexture(base, colors, repeat = 8, seed = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  let state = seed >>> 0;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < 5200; i++) {
    ctx.globalAlpha = 0.06 + rand() * 0.2;
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    const size = 1 + rand() * 4;
    ctx.fillRect(rand() * 256, rand() * 256, size, size);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function gradientSky() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#687d87");
  gradient.addColorStop(.48, "#b5b5a3");
  gradient.addColorStop(.78, "#d0c7ad");
  gradient.addColorStop(1, "#b7a88d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addMesh(geometry, material, x, y, z, parent, castShadow = true) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = castShadow;
  object.receiveShadow = true;
  object.userData.blocksShots = castShadow;
  parent.add(object);
  return object;
}
function addBox(parent, x, y, z, sx, sy, sz, material, castShadow = true) {
  return addMesh(new THREE.BoxGeometry(sx, sy, sz), material, x, y, z, parent, castShadow);
}
function addCylinder(parent, x, y, z, rTop, rBottom, height, material, sides = 12) {
  return addMesh(new THREE.CylinderGeometry(rTop, rBottom, height, sides), material, x, y, z, parent);
}
function addSphere(parent, x, y, z, sx, sy, sz, material, detail = 12) {
  const object = addMesh(new THREE.SphereGeometry(1, detail, Math.max(8, detail - 2)), material, x, y, z, parent);
  object.scale.set(sx, sy, sz);
  return object;
}
function addBeam(parent, a, b, radius, material, sides = 8) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const delta = new THREE.Vector3().subVectors(end, start);
  const object = addMesh(new THREE.CylinderGeometry(radius, radius, delta.length(), sides), material,
    ...start.clone().add(end).multiplyScalar(.5).toArray(), parent);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return object;
}

function makeMaterials() {
  const woodTexture = noiseTexture("#66513a", ["#302a21", "#9b7d55", "#51402f", "#7f6848"], 3, 34);
  const groundTexture = noiseTexture("#555849", ["#424939", "#79755a", "#353a2c", "#9a8a69"], 24, 81);
  const wallTexture = noiseTexture("#8c8170", ["#665f53", "#c0b19a", "#777065", "#494b42"], 3, 19);
  const metalTexture = noiseTexture("#3a3d38", ["#252a27", "#696b60", "#424740"], 2, 72);
  const fabricTexture = noiseTexture("#59624d", ["#3d493a", "#7a8064", "#4b5343"], 2, 16);
  return {
    ground: new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 1, bumpMap: groundTexture, bumpScale: .07 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0x57513f, map: groundTexture, roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x454f39, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x354a32, roughness: 1 }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x536044, roughness: 1 }),
    leaf3: new THREE.MeshStandardMaterial({ color: 0x6a7050, roughness: 1 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x493b2a, map: woodTexture, roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTexture, roughness: .9 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x403224, map: woodTexture, roughness: .95 }),
    brick: new THREE.MeshStandardMaterial({ color: 0xffffff, map: wallTexture, roughness: .95, bumpMap: wallTexture, bumpScale: .035 }),
    plaster: new THREE.MeshStandardMaterial({ color: 0xaaa08a, map: wallTexture, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x77786f, map: wallTexture, roughness: 1 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x474840, map: wallTexture, roughness: 1 }),
    sandbag: new THREE.MeshStandardMaterial({ color: 0xaaa084, roughness: 1, map: fabricTexture }),
    olive: new THREE.MeshStandardMaterial({ color: 0x566044, map: fabricTexture, roughness: .95 }),
    oliveDark: new THREE.MeshStandardMaterial({ color: 0x363e2e, map: fabricTexture, roughness: .95 }),
    german: new THREE.MeshStandardMaterial({ color: 0x73766b, map: fabricTexture, roughness: .95 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x353b39, map: metalTexture, roughness: .42, metalness: .58 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x202523, map: metalTexture, roughness: .6, metalness: .35 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x242723, roughness: .96 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xb58a6d, roughness: .95 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x78918e, roughness: .17, metalness: .35, transparent: true, opacity: .75 }),
    black: new THREE.MeshStandardMaterial({ color: 0x171a18, roughness: .82 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x9e8045, roughness: .35, metalness: .72 }),
    muzzle: new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .9 }),
    allied: new THREE.MeshStandardMaterial({ color: 0x626f50, map: fabricTexture, roughness: .98 }),
    enemy: new THREE.MeshStandardMaterial({ color: 0x77776a, map: fabricTexture, roughness: .98 })
  };
}

export function createWeaponModel(type, materials, forView = false) {
  const group = new THREE.Group();
  const m = materials;
  const length = type === "smg" ? 1.05 : type === "lmg" ? 1.48 : type === "sniper" ? 1.72 : 1.42;
  const wood = m.woodDark;
  const metal = m.steelDark;
  addBox(group, 0, 0, length * .13, .18, .18, length * .67, wood);
  addBox(group, 0, .06, length * .26, .22, .16, .36, metal);
  addBox(group, 0, .05, length * .52, .105, .12, length * .63, m.steel);
  const barrel = addCylinder(group, 0, .055, length * .91, .035, .043, .67, metal, 10);
  barrel.rotation.x = Math.PI / 2;
  addCylinder(group, 0, .055, length * 1.22, .044, .044, .08, metal, 10).rotation.x = Math.PI / 2;
  addBox(group, 0, -.14, length * .38, .12, .28, .2, m.black);
  addBox(group, 0, -.17, length * .16, .15, .36, .2, wood);
  addBox(group, 0, .15, length * .7, .06, .05, .14, metal);
  addBox(group, 0, .13, length * .88, .055, .055, .05, metal);
  addBox(group, 0, -.01, length * .7, .12, .045, .08, metal);
  if (type === "smg") {
    addBox(group, 0, -.2, length * .48, .13, .3, .14, metal);
    const mag = addCylinder(group, 0, -.32, length * .48, .075, .075, .25, metal, 12);
    mag.rotation.x = Math.PI / 2;
    addBox(group, 0, -.005, length * .27, .16, .12, .16, m.wood);
  } else if (type === "lmg") {
    addBox(group, 0, -.21, length * .48, .16, .29, .4, metal);
    addBox(group, 0, -.35, length * .75, .04, .31, .1, metal);
    for (const side of [-1, 1]) {
      const leg = addCylinder(group, side * .08, -.42, length * .83, .018, .018, .38, metal, 6);
      leg.rotation.z = side * .22;
    }
  } else if (type === "sniper") {
    const scope = addCylinder(group, 0, .205, length * .61, .055, .055, .42, metal, 12);
    scope.rotation.x = Math.PI / 2;
    addCylinder(group, 0, .205, length * .61, .064, .064, .055, m.steel, 12).rotation.x = Math.PI / 2;
    addBox(group, 0, .28, length * .61, .085, .07, .13, metal);
    addBox(group, 0, -.17, length * .48, .12, .23, .16, metal);
  } else {
    addBox(group, 0, -.18, length * .43, .11, .24, .16, metal);
    addBox(group, 0, -.2, length * .62, .10, .24, .12, metal);
  }
  if (forView) {
    group.rotation.y = Math.PI;
    group.position.set(.19, -.23, -.54);
    group.scale.set(.74, .74, .74);
  }
  return group;
}

export function createSoldier(team, x, z, materials) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  const allied = team === "ally";
  const uniform = allied ? materials.allied : materials.enemy;
  group.userData = {
    kind: "soldier", team, health: 100, dead: false, cooldown: .5 + Math.random() * 1.8,
    phase: Math.random() * 6.2, strafe: Math.random() < .5 ? -1 : 1,
    target: null, animationSpeed: 0, hitFlash: 0
  };
  const torso = addMesh(new THREE.CapsuleGeometry(.29, .47, 4, 8), uniform, 0, 1.22, 0, group);
  torso.scale.set(1, 1.04, .82);
  const vest = addBox(group, 0, 1.29, .035, .53, .47, .38, allied ? materials.oliveDark : materials.german);
  for (const side of [-1, 1]) {
    addBox(group, side * .19, 1.3, .235, .12, .32, .025, materials.woodDark);
    addBox(group, side * .25, 1.18, -.035, .14, .22, .27, materials.oliveDark);
  }
  const head = addSphere(group, 0, 1.91, .015, .17, .205, .16, materials.skin);
  const helmet = addSphere(group, 0, 2.08, -.005, .22, .12, .215, allied ? materials.oliveDark : materials.german);
  helmet.scale.y = .87;
  addBox(group, 0, 2.035, .155, .21, .035, .035, materials.oliveDark);
  const pack = addBox(group, 0, 1.25, -.28, .32, .42, .17, materials.oliveDark);
  pack.rotation.x = -.08;
  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const upperLeg = addMesh(new THREE.CapsuleGeometry(.095, .39, 3, 7), uniform, side * .13, .64, 0, group);
    upperLeg.userData.limb = true;
    const boot = addBox(group, side * .13, .34, .085, .22, .13, .31, materials.black);
    const arm = addMesh(new THREE.CapsuleGeometry(.078, .36, 3, 7), uniform, side * .35, 1.34, .075, group);
    arm.rotation.z = -side * .13;
    arms.push(arm);
    legs.push(upperLeg);
    const hand = addSphere(group, side * .36, 1.1, .24, .07, .07, .07, materials.skin, 8);
  }
  const weapon = createWeaponModel("rifle", materials);
  weapon.position.set(.25, 1.27, .32);
  weapon.scale.set(.63, .63, .63);
  weapon.rotation.x = -.06;
  group.add(weapon);
  group.userData.legs = legs;
  group.userData.arms = arms;
  group.userData.torso = torso;
  group.userData.weapon = weapon;
  return group;
}

function makeTree(x, z, scale, materials, obstacles, decor) {
  const y = terrainHeight(x, z);
  const tree = new THREE.Group();
  tree.position.set(x, y, z);
  tree.scale.setScalar(scale);
  decor.add(tree);
  addCylinder(tree, 0, 1.55, 0, .13, .23, 3.1, materials.bark, 9);
  for (let j = 0; j < 5; j++) {
    const radius = 1.05 - j * .12;
    const crown = addMesh(new THREE.IcosahedronGeometry(radius, 1), [materials.leaf, materials.leaf2, materials.leaf3][j % 3],
      Math.sin(j * 2.2) * .2, 2.5 + j * .42, Math.cos(j * 1.6) * .14, tree);
    crown.scale.set(1.1, 1.08, 1.0);
  }
  for (let j = 0; j < 3; j++) {
    const angle = j * 2.094;
    addBeam(tree, [0, .5, 0], [Math.cos(angle) * .9, 1.7, Math.sin(angle) * .9], .055, materials.bark, 7);
  }
  obstacles.push({ x, z, radius: .68 * scale, kind: "tree" });
}
function makeBush(x, z, size, materials, decor) {
  const bush = new THREE.Group();
  bush.position.set(x, terrainHeight(x, z), z);
  decor.add(bush);
  for (let i = 0; i < 8; i++) {
    const a = i * 2.4;
    addSphere(bush, Math.cos(a) * size * .36, .28 + (i % 3) * .09, Math.sin(a) * size * .36,
      .42 * size, .32 * size, .4 * size, i % 2 ? materials.leaf : materials.leaf2, 9);
  }
}
function makeCrate(x, z, materials, decor, obstacles) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z) + .42, z);
  group.rotation.y = Math.random() * Math.PI;
  decor.add(group);
  addBox(group, 0, 0, 0, .85, .82, .82, materials.wood);
  for (let i = -1; i <= 1; i++) {
    addBox(group, i * .25, 0, .42, .075, .68, .025, materials.woodDark);
    addBox(group, i * .25, 0, -.42, .075, .68, .025, materials.woodDark);
  }
  addBox(group, 0, .42, 0, .88, .065, .88, materials.woodDark);
  obstacles.push({ x, z, radius: .7, kind: "crate" });
}
function makeSandbag(x, z, rot, materials, decor, obstacles) {
  const bag = addMesh(new THREE.CapsuleGeometry(.23, .36, 3, 7), materials.sandbag, x, terrainHeight(x, z) + .28, z, decor);
  bag.rotation.z = Math.PI / 2;
  bag.rotation.y = rot;
  obstacles.push({ x, z, radius: .34, kind: "sandbag" });
  return bag;
}
function addOrientedCollider(list, baseX, baseZ, localX, localZ, halfX, halfZ, rotation) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  list.push({
    x: baseX + localX * c + localZ * s,
    z: baseZ - localX * s + localZ * c,
    halfX, halfZ, rotation, kind: "building-wall",
    radius: Math.hypot(halfX, halfZ)
  });
}
function makeHouse(x, z, materials, decor, obstacles, collisionBoxes, ruined = false) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = (Math.random() - .5) * .5;
  decor.add(group);
  const w = 8 + Math.random() * 2.5, d = 7.5 + Math.random() * 2.5, h = 3.7;
  // Physical wall colliders match the wall segments and leave the door opening walkable.
  addOrientedCollider(collisionBoxes, x, z, 0, -d / 2, w / 2, .22, group.rotation.y);
  addOrientedCollider(collisionBoxes, x, z, -w / 2, 0, .22, d / 2, group.rotation.y);
  addOrientedCollider(collisionBoxes, x, z, w / 2, 0, .22, d / 2, group.rotation.y);
  addOrientedCollider(collisionBoxes, x, z, -w * .30, d / 2, w * .20, .22, group.rotation.y);
  addOrientedCollider(collisionBoxes, x, z, w * .35, d / 2, w * .15, .22, group.rotation.y);
  // Separate wall sections leave an actual doorway instead of a single solid block.
  addBox(group, 0, h / 2, -d / 2, w, h, .35, materials.brick);
  addBox(group, -w / 2, h / 2, 0, .35, h, d, materials.brick);
  addBox(group, w / 2, h / 2, 0, .35, h, d, materials.brick);
  addBox(group, -w * .30, h / 2, d / 2, w * .4, h, .35, materials.brick);
  addBox(group, w * .35, h / 2, d / 2, w * .3, h, .35, materials.brick);
  addBox(group, 0, h - .65, d / 2, w * .3, 1.3, .35, materials.brick);
  for (const side of [-1, 1]) {
    const window = addBox(group, side * w * .25, 1.8, d / 2 + .19, 1.05, .9, .05, materials.black, false);
    addBox(group, side * w * .25, 1.8, d / 2 + .23, .92, .74, .035, materials.glass, false);
    addBox(group, side * w * .25, 1.8, d / 2 + .25, .045, .85, .045, materials.woodDark, false);
    addBox(group, side * w * .25, 1.8, d / 2 + .25, .95, .045, .045, materials.woodDark, false);
  }
  // Two sloped roof planes.
  const roofA = addBox(group, 0, h + .47, -d * .24, w * 1.14, .18, d * .62, materials.roof);
  roofA.rotation.x = -.47;
  const roofB = addBox(group, 0, h + .47, d * .24, w * 1.14, .18, d * .62, materials.roof);
  roofB.rotation.x = .47;
  addBox(group, 0, h + .86, 0, .22, .25, d * .75, materials.woodDark);
  if (ruined) {
    roofA.rotation.z = .16;
    roofB.rotation.z = -.21;
    for (let i = 0; i < 8; i++) {
      const rubble = addBox(group, (Math.random() - .5) * w, .18 + Math.random() * .22,
        (Math.random() - .5) * d, .6 + Math.random(), .25 + Math.random() * .2, .55 + Math.random() * .4,
        i % 2 ? materials.stone : materials.brick);
      rubble.rotation.set(Math.random() * .3, Math.random() * 2, Math.random() * .3);
    }
  }
  obstacles.push({ x, z, radius: Math.hypot(w / 2, d / 2) * .93, kind: "building" });
}
function makeTank(x, z, materials, decor, obstacles, enemy = false, destroyed = false) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = (Math.random() - .5) * .22;
  decor.add(group);
  const body = enemy ? materials.german : materials.olive;
  addBox(group, 0, 1.03, 0, 3.5, 1.0, 5.1, body);
  addBox(group, 0, .55, 0, 3.95, .35, 5.45, materials.steelDark);
  addBox(group, 0, 1.83, -.3, 2.6, .75, 2.75, body);
  addCylinder(group, 0, 2.24, -.3, .63, .77, .24, materials.steel, 14);
  const barrel = addCylinder(group, 0, 2.24, 1.55, .105, .14, 3.35, materials.steel, 12);
  barrel.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    addBox(group, side * 1.8, .83, 0, .34, .82, 5.15, materials.steelDark);
    for (let i = 0; i < 7; i++) {
      const wheel = addCylinder(group, side * 1.82, .7, -2.1 + i * .69, .36, .36, .21, materials.rubber, 14);
      wheel.rotation.z = Math.PI / 2;
      const hub = addCylinder(group, side * 1.95, .7, -2.1 + i * .69, .14, .14, .23, materials.steel, 12);
      hub.rotation.z = Math.PI / 2;
    }
    for (let i = 0; i < 11; i++) {
      const plate = addBox(group, side * 2.0, .86, -2.55 + i * .48, .07, .1, .31, materials.steel, false);
      plate.rotation.y = .12;
    }
  }
  for (let i = 0; i < 5; i++) addBox(group, (i - 2) * .31, 2.28, -.42, .18, .06, .7, materials.oliveDark, false);
  if (destroyed) {
    addSphere(group, .25, 2.9, -.25, .5, .75, .5, materials.black);
    for (let i = 0; i < 3; i++) {
      const smoke = addSphere(group, (Math.random() - .5) * .55, 3.5 + i * .4, -.25, .35 + i * .07, .44 + i * .08, .35 + i * .07,
        new THREE.MeshStandardMaterial({ color: 0x55564c, transparent: true, opacity: .48, roughness: 1 }), 10);
      smoke.userData.smoke = true;
    }
  }
  obstacles.push({ x, z, radius: 3.25, kind: "tank" });
}

export function createWorld(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb1ad98);
  scene.fog = new THREE.FogExp2(0xb1ad98, .00225);
  const materials = makeMaterials();

  const sky = addMesh(new THREE.SphereGeometry(500, 32, 16), new THREE.MeshBasicMaterial({
    map: gradientSky(), side: THREE.BackSide, fog: false, depthWrite: false
  }), 0, 0, 0, scene, false);
  sky.renderOrder = -10;

  scene.add(new THREE.HemisphereLight(0xd5e0e2, 0x464335, 1.65));
  const ambient = new THREE.AmbientLight(0xc2b99e, .28);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe4ba, 2.8);
  sun.position.set(-110, 170, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -110;
  sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110;
  sun.shadow.camera.bottom = -110;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 360;
  sun.shadow.bias = -.00025;
  sun.shadow.normalBias = .025;
  scene.add(sun);
  scene.add(sun.target);

  const geom = new THREE.PlaneGeometry(SETTINGS.worldSize, SETTINGS.worldSize, 180, 180);
  const positions = geom.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const localY = positions.getY(i);
    positions.setZ(i, terrainHeight(x, -localY));
  }
  positions.needsUpdate = true;
  geom.computeVertexNormals();
  const ground = addMesh(geom, materials.ground, 0, 0, 0, scene, false);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;

  const decor = new THREE.Group();
  scene.add(decor);
  const actors = new THREE.Group();
  scene.add(actors);
  const obstacles = [];
  const collisionBoxes = [];
  const enemies = [];
  const allies = [];

  // A dirt lane leading into a ruined village.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x716952, map: noiseTexture("#716952", ["#9a896b", "#4a493d", "#82765b"], 12, 47), roughness: 1 });
  const road = addMesh(new THREE.PlaneGeometry(12, 250), roadMat, 0, .012, -85, decor, false);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;

  // Craters and churned earth along the road shoulders.
  for (let i = 0; i < 32; i++) {
    const x = (Math.random() - .5) * 105;
    const z = -150 + Math.random() * 240;
    if (Math.abs(x) < 7 && z > -100) continue;
    const crater = addMesh(new THREE.CircleGeometry(.6 + Math.random() * 1.8, 14),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x454335 : 0x514b3c, roughness: 1, side: THREE.DoubleSide }),
      x, terrainHeight(x, z) + .02, z, decor, false);
    crater.rotation.x = -Math.PI / 2;
    crater.scale.set(1.25, .78, 1);
  }

  // Buildings are clustered in a broken village; outer trees create a natural horizon.
  const houseSpots = [
    [-30,-52,true], [31,-65,false], [-48,-96,false], [47,-112,true], [-30,-145,true],
    [32,-159,false], [-62,-24,false], [63,-25,true], [-70,-134,false], [72,-155,true],
    [-55,45,true], [56,48,false], [-88,8,false], [86,5,true], [-97,-65,true]
  ];
  for (const [x, z, ruined] of houseSpots) makeHouse(x, z, materials, decor, obstacles, collisionBoxes, ruined);

  for (let i = 0; i < 92; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 105 + Math.random() * 245;
    let x = Math.cos(angle) * radius;
    let z = Math.sin(angle) * radius - 20;
    if (Math.abs(x) < 52 && z > -178 && z < 64) continue;
    if (Math.random() < .72) makeTree(x, z, .72 + Math.random() * .72, materials, obstacles, decor);
    else makeBush(x, z, .75 + Math.random() * 1.2, materials, decor);
  }

  for (let i = 0; i < 46; i++) {
    const x = (Math.random() - .5) * 180;
    const z = -190 + Math.random() * 245;
    if (Math.abs(x) < 11 && z > -140 && z < 30) continue;
    if (Math.random() < .62) makeCrate(x, z, materials, decor, obstacles);
    else makeBush(x, z, .7 + Math.random() * .6, materials, decor);
  }

  // Defensive positions and broken equipment.
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 9; i++) makeSandbag(-15 + i * .82, -42 - row * .8, 0, materials, decor, obstacles);
  }
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 8; i++) makeSandbag(14 + row * .8, -82 + i * .8, Math.PI / 2, materials, decor, obstacles);
  }
  makeTank(-13, -102, materials, decor, obstacles, false, true);
  makeTank(52, -47, materials, decor, obstacles, true, false);
  makeTank(-65, 28, materials, decor, obstacles, false, true);

  // Snapped fence posts and barbed-wire coils.
  for (let i = 0; i < 18; i++) {
    const x = -74 + i * 1.25;
    const z = -32 + (i % 2) * .25;
    addBox(decor, x, terrainHeight(x, z) + .65, z, .11, 1.3, .11, materials.woodDark);
    addBeam(decor, [x - .52, terrainHeight(x, z) + .8, z], [x + .52, terrainHeight(x, z) + .8, z], .025, materials.steel);
    obstacles.push({ x, z, radius: .22, kind: "fence" });
  }

  for (let i = 0; i < 25; i++) {
    const x = (Math.random() - .5) * 125;
    const z = -180 + Math.random() * 225;
    const rock = addMesh(new THREE.IcosahedronGeometry(.25 + Math.random() * .7, 1), materials.stone,
      x, terrainHeight(x, z) + .15, z, decor);
    rock.scale.set(1 + Math.random(), .45 + Math.random() * .35, .8 + Math.random());
    obstacles.push({ x, z, radius: .45 + Math.max(rock.scale.x, rock.scale.z) * .35, kind: "rock" });
  }

  // Fire teams have a clear starting lane so the first fight begins immediately.
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 4.2 + (Math.random() - .5) * 1.5;
    const z = -25 - Math.random() * 55;
    enemies.push(createSoldier("enemy", x, z, materials));
    actors.add(enemies[enemies.length - 1]);
  }
  for (let i = 0; i < 6; i++) {
    const x = -11 + (i % 3) * 4.8 + (Math.random() - .5) * 1.2;
    const z = 29 + Math.floor(i / 3) * 4.5;
    allies.push(createSoldier("ally", x, z, materials));
    actors.add(allies[allies.length - 1]);
  }
  // Extra patrols around the village.
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (35 + Math.random() * 28);
    const z = -90 - Math.random() * 110;
    enemies.push(createSoldier("enemy", x, z, materials));
    actors.add(enemies[enemies.length - 1]);
  }
  for (let i = 0; i < 3; i++) {
    const x = 15 + i * 5;
    const z = 12 + Math.random() * 8;
    allies.push(createSoldier("ally", x, z, materials));
    actors.add(allies[allies.length - 1]);
  }

  const dust = [];
  const dustMaterial = new THREE.MeshBasicMaterial({ color: 0xe5d3a9, transparent: true, opacity: .26, depthWrite: false });
  for (let i = 0; i < 95; i++) {
    const point = addMesh(new THREE.SphereGeometry(.025 + Math.random() * .025, 5, 5), dustMaterial,
      (Math.random() - .5) * 180, 1 + Math.random() * 9, -100 + Math.random() * 180, decor, false);
    point.userData.dust = true;
    point.userData.blocksShots = false;
    point.userData.drift = .15 + Math.random() * .35;
    dust.push(point);
  }

  const occluders = [];
  decor.traverse((object) => {
    if (object.isMesh && object.userData.blocksShots && !object.userData.dust && !object.userData.smoke) {
      occluders.push(object);
    }
  });
  return { scene, materials, terrainHeight, enemies, allies, obstacles, collisionBoxes, occluders, decor, actors, dust, sun };
}
