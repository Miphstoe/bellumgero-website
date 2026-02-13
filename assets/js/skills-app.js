(() => {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  const profBtn = $("profBtn");
  const profMenu = $("profMenu");
  const profTitle = $("profTitle");
  const resetBtn = $("resetBtn");

  const treesWrap = $("treesWrap");
  const noviceBtn = $("noviceBtn");
  const masterBtn = $("masterBtn");

  const spUsedEl = $("spUsed");
  const spCapEl = $("spCap");
  const barFill = $("barFill");

  const modsBody = $("modsBody");
  const xpBody = $("xpBody");

  const SP_CAP_DEFAULT = 250;

  if (!window.STATIC_DATA || !STATIC_DATA.skills) {
    document.body.innerHTML =
      '<div style="padding:20px;color:#fff">Skill data not found. Check skills-data.js loads without errors.</div>';
    return;
  }

  // ---------- build indexes ----------
  const professions = STATIC_DATA.skills; // keyed by profession id
  const profKeys = Object.keys(professions);

  // Global map: skillName -> skillObject (for prereq checks/mod aggregation)
  const skillByName = new Map();

  for (const pk of profKeys) {
    const p = professions[pk];
    if (p?.novice?.name) skillByName.set(p.novice.name, p.novice);
    if (p?.master?.name) skillByName.set(p.master.name, p.master);
    if (Array.isArray(p?.trees)) {
      for (const tree of p.trees) for (const node of tree) if (node?.name) skillByName.set(node.name, node);
    }
  }

  // ---------- state ----------
  let currentProfKey = profKeys[0] || null;
  let selected = new Set();

  // ---------- UI: dropdown ----------
  function toggleMenu() {
    profMenu.classList.toggle("hidden");
  }

  function closeMenu() {
    profMenu.classList.add("hidden");
  }

  function buildMenu() {
    profMenu.innerHTML = "";
    for (const pk of profKeys) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = prettyProfName(pk);
      btn.addEventListener("click", () => {
        currentProfKey = pk;
        selected = new Set(); // reset per-prof view; change if you want global builds
        renderProfession();
        closeMenu();
      });
      profMenu.appendChild(btn);
    }
  }

  function prettyProfName(key) {
    // Your keys look like "combat_marksman" / "crafting_armorsmith"
    const last = key.split("_").pop();
    return last.charAt(0).toUpperCase() + last.slice(1);
  }

  profBtn.addEventListener("click", toggleMenu);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) closeMenu();
  });

  // ---------- skill logic ----------
  function canSelect(skillName) {
    const s = skillByName.get(skillName);
    const req = s?.skills_required || [];
    return req.every((r) => selected.has(r));
  }

  function selectWithPrereqs(skillName) {
    // Auto-pick prerequisites recursively
    const stack = [skillName];
    while (stack.length) {
      const n = stack.pop();
      const s = skillByName.get(n);
      if (!s) continue;
      const req = s.skills_required || [];
      for (const r of req) {
        if (!selected.has(r)) stack.push(r);
      }
      selected.add(n);
    }
  }

  function deselectCascade(skillName) {
    // Remove this and any skills that depend on it (simple iterative)
    selected.delete(skillName);

    let removed = true;
    while (removed) {
      removed = false;
      for (const n of Array.from(selected)) {
        const s = skillByName.get(n);
        const req = s?.skills_required || [];
        if (req.includes(skillName) || !req.every((r) => selected.has(r))) {
          selected.delete(n);
          removed = true;
        }
      }
    }
  }

  function calcSP() {
    let total = 0;
    for (const n of selected) total += Number(skillByName.get(n)?.skillpoint_cost ?? 0);
    return total;
  }

  function calcMods() {
    // Aggregate mods object values
    const agg = new Map(); // modName -> sum
    for (const n of selected) {
      const mods = skillByName.get(n)?.mods || null;
      if (!mods) continue;
      for (const [k, v] of Object.entries(mods)) {
        const num = Number(v);
        if (!Number.isFinite(num)) continue;
        agg.set(k, (agg.get(k) || 0) + num);
      }
    }
    return Array.from(agg.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  function calcXP() {
    // Sum XP costs by xp_type; many entries have xp_cost and xp_type
    const agg = new Map(); // xp_type -> sum
    for (const n of selected) {
      const s = skillByName.get(n);
      const t = (s?.xp_type || "").trim() || "unknown";
      const c = Number(s?.xp_cost ?? 0);
      if (!c) continue;
      agg.set(t, (agg.get(t) || 0) + c);
    }
    return Array.from(agg.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  // ---------- rendering ----------
  function makeSkillButton(label, skillName) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "skill";
    b.dataset.skill = skillName;

    b.textContent = label;

    const enabled = canSelect(skillName) || selected.has(skillName);
    b.disabled = !enabled;

    if (selected.has(skillName)) b.classList.add("on");

    b.addEventListener("click", () => {
      if (selected.has(skillName)) {
        deselectCascade(skillName);
      } else {
        selectWithPrereqs(skillName);
      }
      renderProfession();
    });

    return b;
  }

  function labelFromSkillName(name) {
    // convert "combat_marksman_rifle_01" => "Rifle I"
    // You can improve this mapping later to exact SWG titles.
    const parts = name.split("_");
    const last = parts[parts.length - 1];
    const num = Number(last);
    let roman = "";
    if (Number.isFinite(num)) {
      roman = ["", "I", "II", "III", "IV", "V"][num] || String(num);
    }
    const weapon = parts.includes("rifle") ? "Rifles" :
                   parts.includes("pistol") ? "Pistols" :
                   parts.includes("carbine") ? "Carbines" :
                   parts.includes("support") ? "Ranged Support" : parts[parts.length - 2];

    return roman ? `${weapon} ${roman}` : name;
  }

  function renderProfession() {
    const p = professions[currentProfKey];
    if (!p) return;

    // title + dropdown button text
    profTitle.textContent = prettyProfName(currentProfKey);
    profBtn.textContent = `Select Profession ▾`;

    // SP bar
    const cap = SP_CAP_DEFAULT;
    const used = calcSP();
    spCapEl.textContent = String(cap);
    spUsedEl.textContent = String(used);
    barFill.style.width = `${Math.min(100, (used / cap) * 100)}%`;

    // Master/Novice
    const noviceName = p.novice?.name;
    const masterName = p.master?.name;

    noviceBtn.textContent = noviceName ? "Novice" : "Novice";
    masterBtn.textContent = masterName ? "Master" : "Master";

    noviceBtn.disabled = !noviceName;
    masterBtn.disabled = !masterName;

    if (noviceName) {
      noviceBtn.className = "skill skill-wide" + (selected.has(noviceName) ? " on" : "");
      noviceBtn.onclick = () => {
        if (selected.has(noviceName)) deselectCascade(noviceName);
        else selectWithPrereqs(noviceName);
        renderProfession();
      };
    }

    if (masterName) {
      masterBtn.className = "skill skill-wide" + (selected.has(masterName) ? " on" : "");
      masterBtn.onclick = () => {
        if (selected.has(masterName)) deselectCascade(masterName);
        else selectWithPrereqs(masterName);
        renderProfession();
      };
      masterBtn.disabled = !canSelect(masterName) && !selected.has(masterName);
    }

    // Trees (4 columns, 4 rows)
    treesWrap.innerHTML = "";
    const trees = Array.isArray(p.trees) ? p.trees : [];
    for (let col = 0; col < 4; col++) {
      const colDiv = document.createElement("div");
      colDiv.className = "col";
      const tree = trees[col] || [];
      for (let row = 0; row < 4; row++) {
        const node = tree[row];
        if (!node?.name) {
          const placeholder = document.createElement("div");
          placeholder.style.minHeight = "52px";
          colDiv.appendChild(placeholder);
          continue;
        }
        const label = labelFromSkillName(node.name);
        colDiv.appendChild(makeSkillButton(label, node.name));
      }
      treesWrap.appendChild(colDiv);
    }

    // Mods panel
    const mods = calcMods();
    modsBody.innerHTML = "";
    for (const [k, v] of mods) {
      const r = document.createElement("div");
      r.className = "modrow";
      r.innerHTML = `<div>${k}</div><div>${v}</div>`;
      modsBody.appendChild(r);
    }

    // XP panel
    const xp = calcXP();
    xpBody.innerHTML = xp.length
      ? xp.map(([t, v]) => `<div><strong>${t}:</strong> ${v.toLocaleString()}</div>`).join("")
      : `<div style="opacity:.85">Select skills to see XP requirements.</div>`;
  }

  resetBtn.addEventListener("click", () => {
    selected = new Set();
    renderProfession();
  });

  // init
  buildMenu();
  renderProfession();
})();
