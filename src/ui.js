export function createUI({ onStart, onPurchase, onShopClose }) {
  const el = (id) => document.getElementById(id);
  const startScreen = el("start-screen");
  const shopScreen = el("shop-screen");
  const toastEl = el("toast");
  const damageEl = el("damage-vignette");
  const hitmarkerEl = el("hitmarker");
  let toastTimer = null;
  let hitTimer = null;
  let damageTimer = null;
  let lastHud = { health: 100, sector: 1, alliesScore: 0, enemyScore: 0 };

  el("deploy-button").addEventListener("click", onStart);
  el("close-shop").addEventListener("click", onShopClose);

  function toast(message, duration = 1500) {
    toastEl.textContent = message;
    toastEl.style.opacity = "1";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = "0"; }, duration);
  }

  function damageFlash() {
    damageEl.style.opacity = ".92";
    if (damageTimer) clearTimeout(damageTimer);
    damageTimer = setTimeout(() => { damageEl.style.opacity = "0"; }, 170);
  }

  function hitmarker() {
    hitmarkerEl.classList.add("active");
    if (hitTimer) clearTimeout(hitTimer);
    hitTimer = setTimeout(() => hitmarkerEl.classList.remove("active"), 115);
  }

  function update(inventory, health, sector = 1, alliesScore = 0, enemyScore = 0) {
    lastHud = { health, sector, alliesScore, enemyScore };
    const weapon = inventory.current;
    el("ammo-count").textContent = weapon.ammo;
    el("ammo-reserve").textContent = "/ " + weapon.reserveAmmo;
    el("weapon-name").textContent = weapon.name;
    el("health-number").textContent = Math.max(0, Math.round(health));
    el("health-fill").style.width = Math.max(0, Math.min(100, health)) + "%";
    el("coins").textContent = inventory.bonds;
    el("kills").textContent = String(inventory.kills).padStart(3, "0");
    el("match-score").textContent = "ALLIES " + String(alliesScore).padStart(3, "0") + " — " + String(enemyScore).padStart(3, "0") + " AXIS";
    el("sector").textContent = "SECTOR " + String(sector).padStart(2, "0");
    el("shop-coins").textContent = inventory.bonds;
  }

  function renderShop(inventory) {
    const grid = el("weapon-grid");
    grid.replaceChildren();
    for (const weapon of inventory.items) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "weapon-card" + (inventory.current.id === weapon.id ? " selected" : "");
      const title = document.createElement("strong");
      title.textContent = weapon.name;
      const description = document.createElement("p");
      description.textContent = weapon.description + "  |  " + weapon.magazine + " rounds";
      const meta = document.createElement("div");
      meta.className = "weapon-meta";
      const price = document.createElement("span");
      price.textContent = weapon.owned ? (inventory.current.id === weapon.id ? "EQUIPPED" : "OWNED") : weapon.cost + " WAR BONDS";
      if (weapon.owned) price.className = "owned";
      const action = document.createElement("span");
      action.textContent = weapon.owned ? "SELECT ↗" : "BUY ↗";
      meta.append(price, action);
      card.append(title, description, meta);
      card.addEventListener("click", () => {
        const result = onPurchase(weapon.id);
        el("shop-message").textContent = result.message || "UPDATED";
        if (result.ok) {
          renderShop(inventory);
          update(inventory, lastHud.health, lastHud.sector, lastHud.alliesScore, lastHud.enemyScore);
          toast(result.message, 1200);
        } else {
          toast(result.message || "UNAVAILABLE", 1300);
        }
      });
      grid.append(card);
    }
    el("shop-coins").textContent = inventory.bonds;
  }

  return {
    toast,
    update,
    hitmarker,
    damageFlash,
    showStart() { startScreen.style.display = "grid"; },
    hideStart() { startScreen.style.display = "none"; },
    showShop(inventory) {
      renderShop(inventory);
      el("shop-message").textContent = "SELECT A WEAPON";
      shopScreen.style.display = "grid";
    },
    hideShop() { shopScreen.style.display = "none"; },
    isShopOpen() { return shopScreen.style.display === "grid"; },
    focusCrosshair(aiming) {
      el("crosshair").style.opacity = aiming ? ".5" : ".92";
      el("crosshair").style.transform = aiming ? "translate(-50%,-50%) scale(.72)" : "translate(-50%,-50%) scale(1)";
    }
  };
}
