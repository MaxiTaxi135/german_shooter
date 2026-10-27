export const WEAPONS = [
  { id: "garand", name: "M1 GARAND", type: "rifle", cost: 0, magazine: 8, reserve: 120, fireRate: 3.25, damage: 43, reloadTime: 1.55, description: "U.S. semi-automatic service rifle. Eight-round en-bloc clip." },
  { id: "thompson", name: "THOMPSON M1A1", type: "smg", cost: 150, magazine: 30, reserve: 180, fireRate: 10.7, damage: 22, reloadTime: 1.8, description: "Heavy .45 ACP submachine gun for close engagements." },
  { id: "bar", name: "BROWNING M1918 BAR", type: "lmg", cost: 220, magazine: 20, reserve: 160, fireRate: 7.8, damage: 30, reloadTime: 2.1, description: "Heavy automatic rifle with a box magazine and bipod." },
  { id: "springfield", name: "SPRINGFIELD M1903", type: "sniper", cost: 180, magazine: 5, reserve: 60, fireRate: 1.15, damage: 100, reloadTime: 2.0, description: "Scoped bolt-action rifle. Slow fire, high precision." },
  { id: "mp40", name: "MP 40", type: "mp40", cost: 140, magazine: 32, reserve: 192, fireRate: 9.8, damage: 21, reloadTime: 1.75, description: "Compact German submachine gun with a straight magazine." },
  { id: "kar98k", name: "KARABINER 98K", type: "bolt", cost: 110, magazine: 5, reserve: 65, fireRate: 1.35, damage: 88, reloadTime: 2.05, description: "German bolt-action rifle with a full-length wooden stock." },
  { id: "stg44", name: "STG 44", type: "assault", cost: 255, magazine: 30, reserve: 180, fireRate: 7.9, damage: 27, reloadTime: 1.85, description: "Selective-fire assault rifle with a curved magazine." },
  { id: "mg42", name: "MG 42", type: "mg", cost: 310, magazine: 50, reserve: 200, fireRate: 15, damage: 24, reloadTime: 2.65, description: "Fast-firing general-purpose machine gun." }
];

export const SETTINGS = {
  worldSize: 720,
  renderDistance: 460,
  playerStart: { x: 0, z: 24 },
  startHealth: 100,
  startWarBonds: 200,
  playerWalkSpeed: 7.8,
  playerSprintSpeed: 12.5,
  playerJumpSpeed: 7.8,
  playerGravity: 20,
  npcHitboxRadius: 0.38,
  playerHitboxRadius: 0.42
};
