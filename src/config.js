export const WEAPONS = [
  { id: "garand", name: "M1 GARAND", type: "rifle", cost: 0, magazine: 8, reserve: 96, fireRate: 3.2, damage: 43, reloadTime: 1.55, description: "Hard-hitting semi-automatic service rifle." },
  { id: "thompson", name: "THOMPSON M1A1", type: "smg", cost: 150, magazine: 30, reserve: 180, fireRate: 11.5, damage: 22, reloadTime: 1.8, description: "Fast-firing submachine gun for close range." },
  { id: "bar", name: "BROWNING M1918", type: "lmg", cost: 220, magazine: 20, reserve: 140, fireRate: 8.4, damage: 29, reloadTime: 2.1, description: "Heavy automatic rifle with serious recoil." },
  { id: "springfield", name: "SPRINGFIELD M1903", type: "sniper", cost: 180, magazine: 5, reserve: 50, fireRate: 1.15, damage: 100, reloadTime: 2.0, description: "Precise bolt-action rifle with a scope." }
];

export const SETTINGS = {
  worldSize: 720,
  renderDistance: 520,
  playerStart: { x: 0, z: 24 },
  startHealth: 100,
  startWarBonds: 200,
  playerWalkSpeed: 7.8,
  playerSprintSpeed: 12.5,
  playerJumpSpeed: 7.8,
  playerGravity: 20
};
