import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!relative) relative = "index.html";
    const fullPath = resolve(root, relative);
    if (!fullPath.startsWith(root + "/") && fullPath !== root) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const content = await readFile(fullPath);
    res.writeHead(200, { "content-type": contentTypes[extname(fullPath)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(4173, "127.0.0.1", resolveListen);
});

let browser;
const pageErrors = [];
const criticalConsoleErrors = [];
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
  });
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && /Uncaught|SyntaxError|TypeError|WebGLRenderer|Failed to resolve module/i.test(text)) {
      criticalConsoleErrors.push(text);
    }
  });

  await page.goto("http://127.0.0.1:4173/?test=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.__IRON_FRONT_READY__ === true, null, { timeout: 30000 });
  await page.waitForTimeout(600);

  const stats = await page.evaluate(() => window.__IRON_FRONT_TEST__.getStats());
  assert.equal(stats.ready, true, "game did not initialise");
  assert.equal(stats.weaponCount, 8, "expected eight purchasable weapons");
  assert.ok(stats.enemyCount >= 12, "expected a usable enemy group");
  assert.equal(stats.allyCount, 3, "the player squad should contain exactly three allies");
  assert.notEqual(stats.teamMarkers.ally, stats.teamMarkers.enemy, "ally and enemy uniform markers must differ");
  assert.ok(stats.occluderCount > 100, "scenery raycast blockers were not registered");
  assert.ok(stats.collisionCount > 150, "world collision volumes were not registered");
  assert.deepEqual(stats.vehicles.map((vehicle) => vehicle.type).sort(), ["jeep", "plane"], "jeep and plane should spawn");
  assert.ok(await page.locator("canvas").count() >= 1, "Three.js canvas is missing");

  await page.locator("#deploy-button").click();
  await page.waitForFunction(() => document.querySelector("#start-screen").style.display === "none");
  await page.keyboard.press("b");
  await page.waitForFunction(() => document.querySelector("#shop-screen").style.display === "grid");
  assert.equal(await page.locator(".weapon-card").count(), 8, "armory did not render all weapons");

  await page.locator(".weapon-card").filter({ hasText: "MP 40" }).click();
  assert.equal((await page.locator("#weapon-name").textContent()).trim(), "MP 40", "buying MP 40 did not equip it");
  assert.equal((await page.locator("#coins").textContent()).trim(), "60", "war bonds were not deducted correctly");

  await page.locator(".weapon-card").filter({ hasText: "MG 42" }).click();
  assert.match((await page.locator("#shop-message").textContent()).toUpperCase(), /NOT ENOUGH WAR BONDS/,
    "armory must reject a weapon that costs more than the wallet");
  await page.locator("#close-shop").click();

  const positionsBefore = await page.evaluate(() => window.__IRON_FRONT_TEST__.enemyPositions());
  await page.waitForTimeout(1100);
  const positionsAfter = await page.evaluate(() => window.__IRON_FRONT_TEST__.enemyPositions());
  const beforeMap = new Map(positionsBefore.map((entry) => [entry.index, entry]));
  const movedCount = positionsAfter.filter((entry) => {
    const before = beforeMap.get(entry.index);
    if (!before || before.dead || entry.dead) return false;
    const dx = entry.position[0] - before.position[0];
    const dz = entry.position[2] - before.position[2];
    return Math.hypot(dx, dz) > .18;
  }).length;
  assert.ok(movedCount > 0, "AI enemies did not move during the simulation");

  await page.evaluate(() => window.__IRON_FRONT_TEST__.prepareTarget());
  const targetBefore = await page.evaluate(() => window.__IRON_FRONT_TEST__.getStats());
  const shot = await page.evaluate(() => window.__IRON_FRONT_TEST__.fireTestShot());
  assert.equal(shot.fired, true, "player shot did not consume ammunition");
  assert.equal(shot.hit, true, "aimed player shot did not register against an enemy hitbox");
  assert.ok(shot.targetHealth < 100, "player damage was not applied to the enemy");
  const targetAfter = await page.evaluate(() => window.__IRON_FRONT_TEST__.getStats());
  assert.equal(targetAfter.ammo, targetBefore.ammo - 1, "shot did not decrement the magazine");

  const healthBefore = await page.evaluate(() => window.__IRON_FRONT_TEST__.getStats().health);
  await page.evaluate(() => window.__IRON_FRONT_TEST__.enemyTestShot());
  const healthAfter = await page.evaluate(() => window.__IRON_FRONT_TEST__.getStats().health);
  assert.ok(healthAfter < healthBefore, "enemy hit did not reduce player health");

  const reload = await page.evaluate(() => window.__IRON_FRONT_TEST__.reloadTest());
  assert.equal(reload.ok, true, "reload did not start");
  assert.equal(reload.reloading, false, "reload did not finish");
  assert.equal(reload.ammo, reload.magazine, "reload did not fill the magazine");
  assert.ok(reload.reserveAfter < reload.reserveBefore, "reload did not consume reserve ammunition");

  const reinforcement = await page.evaluate(() => window.__IRON_FRONT_TEST__.reinforcementTest());
  assert.equal(reinforcement.spawned, true, "defeating an enemy should trigger infinite reinforcements");
  assert.equal(reinforcement.afterTotal, reinforcement.beforeTotal + 1, "a reinforcement was not added to the world");
  assert.equal(reinforcement.afterActive, reinforcement.beforeActive, "the replacement should restore the active enemy count");

  const jeepMount = await page.evaluate(() => window.__IRON_FRONT_TEST__.mountVehicleTest("jeep"));
  assert.deepEqual(jeepMount, { mounted: true, currentVehicle: "jeep" }, "player could not board the jeep");
  const jeepDrive = await page.evaluate(() => window.__IRON_FRONT_TEST__.driveVehicleTest(.5));
  assert.equal(jeepDrive.type, "jeep", "jeep driving state was lost");
  assert.equal(jeepDrive.moved, true, "jeep did not move under throttle");
  assert.ok(jeepDrive.speed > 0, "jeep throttle did not increase speed");
  const jeepExit = await page.evaluate(() => window.__IRON_FRONT_TEST__.leaveVehicleTest());
  assert.deepEqual(jeepExit, { left: true, currentVehicle: null }, "player could not exit the jeep");

  const planeMount = await page.evaluate(() => window.__IRON_FRONT_TEST__.mountVehicleTest("plane"));
  assert.deepEqual(planeMount, { mounted: true, currentVehicle: "plane" }, "player could not board the plane");
  const planeFlight = await page.evaluate(() => window.__IRON_FRONT_TEST__.driveVehicleTest(2.4));
  assert.equal(planeFlight.type, "plane", "plane flight state was lost");
  assert.equal(planeFlight.moved, true, "plane did not move under throttle");
  assert.ok(planeFlight.speed > 10, "plane throttle did not accelerate");
  assert.ok(planeFlight.altitude > 2.8, "plane did not climb when commanded");
  const planeLand = await page.evaluate(() => window.__IRON_FRONT_TEST__.landVehicleTest());
  assert.equal(planeLand.landed, true, "test plane could not return to the ground");
  const planeExit = await page.evaluate(() => window.__IRON_FRONT_TEST__.leaveVehicleTest());
  assert.deepEqual(planeExit, { left: true, currentVehicle: null }, "player could not exit the landed plane");

  assert.deepEqual(pageErrors, [], "browser raised uncaught JavaScript errors");
  assert.deepEqual(criticalConsoleErrors, [], "browser reported critical console errors");
  console.log(JSON.stringify({
    result: "PASS",
    weapons: stats.weaponCount,
    enemiesMoved: movedCount,
    hitRegistration: shot.hit,
    playerHealth: healthAfter,
    reload: "PASS",
    collisionVolumes: stats.collisionCount,
    sceneryOccluders: stats.occluderCount,
    vehicles: ["jeep drive", "plane flight", "plane landing"]
  }, null, 2));
} catch (error) {
  console.error(error.stack || error);
  if (browser) {
    try {
      const page = browser.contexts()[0]?.pages()[0];
      if (page) await page.screenshot({ path: "/tmp/iron-front-failure.png", fullPage: true });
    } catch {}
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
