import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const moduleFiles = [
  "src/config.js",
  "src/world.js",
  "src/ai.js",
  "src/weapons.js",
  "src/ui.js",
  "src/main.js"
];

for (const relativePath of moduleFiles) {
  const fullPath = resolve(root, relativePath);
  assert.ok(existsSync(fullPath), `Missing source module: ${relativePath}`);
  const result = spawnSync(process.execPath, ["--check", fullPath], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    throw new Error(`JavaScript syntax check failed: ${relativePath}`);
  }
}

const html = readFileSync(resolve(root, "index.html"), "utf8");
const cssPath = resolve(root, "styles/main.css");
assert.ok(existsSync(cssPath), "Missing styles/main.css");
assert.match(html, /type="module"\s+src="\.\/src\/main\.js"/, "index.html must load the modular entry point");
assert.match(html, /\.\/styles\/main\.css/, "index.html must load the stylesheet");
assert.match(html, /"three":\s*"https:\/\/cdn\.jsdelivr\.net\//, "Three.js import map is missing");

const ui = readFileSync(resolve(root, "src/ui.js"), "utf8");
for (const [, id] of ui.matchAll(/el\("([^"]+)"\)/g)) {
  assert.ok(html.includes(`id="${id}"`), `UI element #${id} is missing from index.html`);
}

for (const relativePath of moduleFiles) {
  const source = readFileSync(resolve(root, relativePath), "utf8");
  for (const [, importPath] of source.matchAll(/from\s+["'](\.\/[^"']+\.js)["']/g)) {
    const dependency = resolve(root, relativePath, "..", importPath);
    assert.ok(existsSync(dependency), `Missing ${importPath}, imported by ${relativePath}`);
  }
}

console.log(`Static checks passed for ${moduleFiles.length} JavaScript modules and the HTML/UI wiring.`);
