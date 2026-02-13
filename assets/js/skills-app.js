/* assets/js/skills-app.js
   Bellum Gero Skill Calculator (profession dropdown + 4x4 trees)
   - Expects skills-data.js to define: window.STATIC_DATA.skills = { ... }
*/

(() => {
  // ---------- Debug overlay ----------
  const dbg = (msg) => {
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;left:12px;bottom:12px;z-index:9999;background:#000a;color:#fff;padding:10px 12px;border:1px solid #fff3;border-radius:8px;max-width:640px;font:12px/1.35 monospace;white-space:pre-wrap;";
    el.textContent = msg;
    document.body.appendChild(el);
  };

  // ---------- Bootstrap / normalize data ----------
  window.STATIC_DATA = window.STATIC_DATA || {};
  const SD = window.STATIC_DATA;

  // Handle a few possible shapes safely
  const skillsRoot =
    SD.skills ||
    SD?.STATIC_DATA?.skills ||
    window.skills ||
    null;

  if (!skillsRoot) {
    dbg(
      "ERROR: Could not find skill data.\n" +
        "Expected: window.STATIC_DATA.skills\n\n" +
        "Fix:\n" +
        "1) Ensure skills.html loads skills-data.js BEFORE skills-app.js\n" +
        "2) Ensure skills-data.js begins with:\n" +
        "   window.STATIC_DATA = window.STATIC_DATA || {};\n" +
        "   var STATIC_DATA = window.STATIC_DATA;\n" +
        "   STATIC_DATA.skills = {...};"
    );
    return;
  }

  const professions = skillsRoot;
  const profKeys = Object.keys(professions);

  if (!profKeys.length) {
    dbg(
      "ERROR: Found skillsRoot, but it has 0 professions.\n" +
        "Check the shape of STATIC_DATA.skills in skills-data.js."
    );
    return;
  }

  // ---------- Helpers ----------
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

  // If any required DOM element is missing, fail loudly
  const required = [
    ["profBtn", profBtn],
    ["profMenu", profMenu],
    ["profTitle", profTitle],
    ["resetBtn", resetBtn],
    ["treesWrap", treesWrap],
    ["noviceBtn", noviceBtn],
    ["masterBtn", masterBtn],
    ["spUsed", spUsedEl],
    ["spCap", spCapEl],
    ["barFill", barFill],
    ["modsBody", modsBody],
    ["xpBody", xpBody],
  ];

  const missing = required.filter(([, el]) => !el).map(([name]) => name);
  if (missing.length) {
    dbg(
      "ERROR: Missing required HTML elements:\n" +
        missing.map((m) => `- #${m}`).join("\n") +
        "\n\nMake sure skills.html matches the provided template."
    );
    return;
  }

  // ---------- Build global index: skillName -> skillObject ----------
  const skillByName = new Map();

  for (const pk of profKeys) {
    const p = professions[pk];
    if (!p) continue;

    if (p?.novice?.name) skillByName.set(p.novice.name, p.novice);
    if (p?.master?.name) skillByName.set(p.master.name, p.master);

    if (Array.isArray(p?.trees)) {
      for (const tree of p.trees) {
        if (!Array.isArray(tree)) continue;
        for (const node of tree) {
          if (node?.name) skillByName.set(node.name, node);
        }
      }
    }
  }

  // ---------- State ----------
  let currentProfKey = profKeys[0];
  let selected = new Set();

  // ---------- UI: Profession dropdown ----------
  function prettyProfName(key) {
    // keys like: combat_marksman / crafting_armorsmith
    const last = String(key).split("_").pop() || String(key);
    return last.charAt(0).toUpperCase() + last.slice(1);
  }

  function openMenu() {
    profMenu.classList.remove("hidden");
  }

  function closeMenu() {
    profMenu.classList.add("hidden");
  }

  function toggleMenu() {
    profMenu.classList.toggle("hidden");
  }

  function buildMenu() {
    profMenu.innerHTML = "";

    for (const pk of profKeys) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = prettyProfName(pk);
      btn.addEventListener("click", () => {
        currentProfKey = pk;
        selected = new Set(); // per-profession reset; change if you want multi-prof builds
        render();
        closeMenu();
      });
      profMenu.appendChild(btn);
    }
  }

  profBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMenu();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) closeMenu();
  });

  // ---------- Skill prerequisite logic ----------
  function reqsFor(skillName) {
    const s = skillByName.get(skillName);
    return Array.isArray(s?.skills_required) ? s.skills_required : [];
  }

  function canSelect(skillName) {
    if (selected.has(skillName)) return true;
    const req = reqsFor(skillName);
    return req.every((r) => selected.has(r));
  }

  function selectWithPrereqs(skillName) {
    const stack = [skillName];

    while (stack.length) {
      const n = stack.pop();
      const s = skillByName.get(n);
      if (!s) continue;

      const req = reqsFor(n);
      for (const r of req) {
        if (!selected.has(r)) stack.push(r);
      }
      selected.add(n);
    }
  }

  function deselectCascade(skillName) {
    selected.delete(skillName);

    let changed = true;
    while (changed) {
      changed = false;
      for (const n of Array.from(selected)) {
        const req = reqsFor(n);
        if (!req.every((r) => selected.has(r))) {
          selected.delete(n);
          changed = true;
        }
      }
    }
  }

  // ---------- Calculations ----------
  function calcSPUsed() {
    let total = 0;
    for (const n of selected) {
      total += Number(skillByName.get(n)?.skillpoint_cost ?? 0);
    }
    return total;
  }

  function calcMods() {
    const agg = new Map(); // mod -> sum

    for (const n of selected) {
      const mods = skillByName.get(n)?.mods;
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

  // ---------- Labels ----------
  // Improve later by providing a mapping table for exact SWG names.
  function labelFromSkillName(name) {
    const parts = String(name).split("_");
    const last = parts[parts.length - 1];
    const num = Number(last);

    let roman = "";
    if (Number.isFinite(num)) {
      roman = ["", "I", "II", "III", "IV", "V"][num] || String(num);
    }

    const weapon = parts.includes("rifle")
      ? "Rifles"
      : parts.includes("pistol")
      ? "Pistols"
      : parts.includes("carbine")
      ? "Carbines"
      : parts.includes("support")
      ? "Ranged Support"
      : parts[parts.length - 2] || name;

    return roman ? `${weapon} ${roman}` : name;
  }

  // ---------- Rendering ----------
  function makeSkillButton(label, skillName) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "skill";
    b.dataset.skill = skillName;
    b.textContent = label;

    const enabled = canSelect(skillName);
    b.disabled = !enabled;

    if (selected.has(skillName)) b.classList.add("on");

    b.addEventListener("click", () => {
      if (selected.has(skillName)) {
        deselectCascade(skillName);
      } else {
        selectWithPrereqs(skillName);
      }
      render();
    });

    return b;
  }

  function renderTreesForProfession(p) {
    treesWrap.innerHTML = "";

    const trees = Array.isArray(p?.trees) ? p.trees : [];

    // Expecting 4 columns; each column is 4 rows (fourByFour)
    for (let col = 0; col < 4; col++) {
      const colDiv = document.createElement("div");
      colDiv.className = "col";

      const tree = Array.isArray(trees[col]) ? trees[col] : [];

      // Data is stored novice->master (01..04); display should be master->novice.
      for (let row = 3; row >= 0; row--) {
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
  }

  function renderModsPanel() {
    const mods = calcMods();
    modsBody.innerHTML = "";

    for (const [k, v] of mods) {
      const r = document.createElement("div");
      r.className = "modrow";
      r.innerHTML = `<div>${k}</div><div>${v}</div>`;
      modsBody.appendChild(r);
    }
  }

  function renderXPPanel() {
    const xp = calcXP();

    xpBody.innerHTML = xp.length
      ? xp
          .map(
            ([t, v]) =>
              `<div><strong>${t}:</strong> ${Number(v).toLocaleString()}</div>`
          )
          .join("")
      : `<div style="opacity:.85">Select skills to see XP requirements.</div>`;
  }

  function renderSPBar() {
    const cap = SP_CAP_DEFAULT;
    const used = calcSPUsed();

    spCapEl.textContent = String(cap);
    spUsedEl.textContent = String(used);
    barFill.style.width = `${Math.min(100, (used / cap) * 100)}%`;
  }

  function renderNoviceMaster(p) {
    const noviceName = p?.novice?.name || null;
    const masterName = p?.master?.name || null;

    // Novice
    noviceBtn.disabled = !noviceName;
    noviceBtn.className = "skill skill-wide" + (noviceName && selected.has(noviceName) ? " on" : "");
    noviceBtn.textContent = "Novice";
    noviceBtn.onclick = noviceName
      ? () => {
          if (selected.has(noviceName)) deselectCascade(noviceName);
          else selectWithPrereqs(noviceName);
          render();
        }
      : null;

    // Master
    masterBtn.disabled = !masterName || (!canSelect(masterName) && !selected.has(masterName));
    masterBtn.className = "skill skill-wide" + (masterName && selected.has(masterName) ? " on" : "");
    masterBtn.textContent = "Master";
    masterBtn.onclick = masterName
      ? () => {
          if (selected.has(masterName)) deselectCascade(masterName);
          else selectWithPrereqs(masterName);
          render();
        }
      : null;
  }

  function renderHeader() {
    profTitle.textContent = prettyProfName(currentProfKey);
    // Keep arrow stable by using HTML entity
    profBtn.innerHTML = `Select Profession <span aria-hidden="true">&#9662;</span>`;
  }

  function render() {
    const p = professions[currentProfKey];
    if (!p) {
      dbg(`ERROR: Current profession key not found: ${currentProfKey}`);
      return;
    }

    renderHeader();
    renderSPBar();
    renderNoviceMaster(p);
    renderTreesForProfession(p);
    renderModsPanel();
    renderXPPanel();
  }

  // ---------- Reset ----------
  resetBtn.addEventListener("click", () => {
    selected = new Set();
    render();
  });

  // ---------- Init ----------
  buildMenu();
  render();

  // Optional debug: comment out if you don't want it always visible
  // dbg(`OK: Loaded professions=${profKeys.length}\nFirst=${profKeys[0]}`);
})();
