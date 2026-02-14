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
  const PROF_DISPLAY_NAMES = {
    combat_marksman: "Marksmen",
    combat_rifle: "Rifleman",
    combat_bountyhunter: "Bounty Hunter",
    bountyhunter: "Bounty Hunter",
    combat_unarmed: "Tera Kasi Master",
    combat_2hsword: "Swordsman",
    combat_1hsword: "Fencer",
    combat_polearm: "Pikeman",
    outdoors_creaturehandler: "Creature Handler",
    creaturehandler: "Creature Handler",
    outdoors_bio_engineer: "Bio Engineer",
    crafting_droidengineer: "Droid Engineer",
    science_combatmedic: "Combat Medic",
    social_imagedesigner: "Image Designer",
    force_sensitive_crafting_mastery: "Crafting Mastery",
    force_sensitive_combat_prowess: "Combat Prowess",
    force_discipline_enhancements: "Enhancer",
    force_sensitive_enhanced_reflexes: "Enhanced Reflexes",
    force_sensitive_heightened_senses: "Heightened Senses",
    force_discipline_healing: "Force Healing",
  };

  // Hide non-profession rank tracks from the profession dropdown.
  const EXCLUDED_PROFESSION_KEYS = new Set(["force_rank_light", "force_rank_dark", "force_title_jedi", "pilot_imperial_navy", "pilot_neutral", "pilot_rebel_navy"]);

  // Keep these professions pinned at the top of the dropdown in this exact order.
  const STARTING_PROFESSION_ORDER = [
    "crafting_artisan",    // Artisan
    "combat_brawler",      // Brawler
    "social_entertainer",  // Entertainer
    "combat_marksman",     // Marksmen
    "science_medic",       // Medic
    "outdoors_scout",      // Scout
  ];

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
  const buildStrip = $("buildStrip");
  const downloadBtn = $("downloadBtn");
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
    ["buildStrip", buildStrip],
    ["downloadBtn", downloadBtn],
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
  const skillToProfession = new Map();

  for (const pk of profKeys) {
    const p = professions[pk];
    if (!p) continue;

    if (p?.novice?.name) {
      skillByName.set(p.novice.name, p.novice);
      skillToProfession.set(p.novice.name, pk);
    }
    if (p?.master?.name) {
      skillByName.set(p.master.name, p.master);
      skillToProfession.set(p.master.name, pk);
    }

    if (Array.isArray(p?.trees)) {
      for (const tree of p.trees) {
        if (!Array.isArray(tree)) continue;
        for (const node of tree) {
          if (node?.name) {
            skillByName.set(node.name, node);
            skillToProfession.set(node.name, pk);
          }
        }
      }
    }
  }

  // ---------- State ----------
  function isVisibleProfessionKey(k) {
    return !!professions[k] && !EXCLUDED_PROFESSION_KEYS.has(k);
  }

  const DEFAULT_VISIBLE_PROF_KEY =
    STARTING_PROFESSION_ORDER.find((k) => isVisibleProfessionKey(k)) ||
    profKeys.find((k) => isVisibleProfessionKey(k)) ||
    profKeys[0];

  let currentProfKey = DEFAULT_VISIBLE_PROF_KEY;
  let selected = new Set();

  // ---------- UI: Profession dropdown ----------
  function prettyProfName(key) {
    if (PROF_DISPLAY_NAMES[key]) return PROF_DISPLAY_NAMES[key];
    // Fallback: derive from profession name key, dropping category prefix.
    const raw = String(key);
    const parts = raw.split("_");
    const base = parts.length > 1 ? parts.slice(1).join(" ") : raw;
    return base.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function menuProfessionKeys() {
    const existingStart = STARTING_PROFESSION_ORDER.filter((k) => isVisibleProfessionKey(k));
    const startSet = new Set(existingStart);

    const remainder = profKeys
      .filter((k) => !startSet.has(k) && isVisibleProfessionKey(k))
      .sort((a, b) =>
        prettyProfName(a).localeCompare(prettyProfName(b), undefined, { sensitivity: "base" })
      );

    return [...existingStart, ...remainder];
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

    for (const pk of menuProfessionKeys()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = prettyProfName(pk);
      btn.addEventListener("click", () => {
        currentProfKey = pk;
        render();
        closeMenu();
      });
      profMenu.appendChild(btn);
    }
  }

  function selectedProfessions() {
    const counts = new Map();

    for (const skillName of selected) {
      const pk = skillToProfession.get(skillName);
      if (!pk) continue;
      counts.set(pk, (counts.get(pk) || 0) + 1);
    }

    return Array.from(counts.entries()).sort((a, b) =>
      prettyProfName(a[0]).localeCompare(prettyProfName(b[0]))
    );
  }

  function renderBuildStrip() {
    const profs = selectedProfessions();
    buildStrip.innerHTML = "";

    if (!profs.length) {
      const empty = document.createElement("div");
      empty.className = "build-empty";
      empty.textContent = "Selected Build: none yet";
      buildStrip.appendChild(empty);
      return;
    }

    for (const [pk, count] of profs) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "build-chip" + (pk === currentProfKey ? " active" : "");
      b.textContent = `${prettyProfName(pk)} (${count})`;
      b.addEventListener("click", () => {
        currentProfKey = pk;
        render();
      });
      buildStrip.appendChild(b);
    }
  }

  function skillDisplayName(skillName) {
    return SD?.skill_names?.[skillName] || skillName;
  }

  function buildTemplateText() {
    const byProf = new Map();
    const mods = calcMods();

    for (const skillName of selected) {
      const pk = skillToProfession.get(skillName) || "unknown";
      if (!byProf.has(pk)) byProf.set(pk, []);
      byProf.get(pk).push(skillName);
    }

    const lines = [];
    lines.push("Bellum Gero Skill Template");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Skill Points: ${calcSPUsed()}/${SP_CAP_DEFAULT}`);
    lines.push(`Total Skills: ${selected.size}`);
    lines.push("");
    lines.push("[Skill Mods]");
    if (mods.length) {
      for (const [name, value] of mods) {
        lines.push(`- ${name}: ${value}`);
      }
    } else {
      lines.push("- none");
    }
    lines.push("");

    const profs = Array.from(byProf.keys()).sort((a, b) => a.localeCompare(b));
    for (const pk of profs) {
      const skills = byProf.get(pk).slice().sort((a, b) => a.localeCompare(b));
      lines.push(`[${prettyProfName(pk)}]`);
      for (const skillName of skills) {
        lines.push(`- ${skillName} | ${skillDisplayName(skillName)}`);
      }
      lines.push("");
    }

    if (!profs.length) {
      lines.push("No skills selected.");
    }

    return lines.join("\n");
  }

  function downloadTemplate() {
    const text = buildTemplateText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `skill-template-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

  function projectedSelectionWithPrereqs(skillName) {
    const next = new Set(selected);
    const stack = [skillName];

    while (stack.length) {
      const n = stack.pop();
      const s = skillByName.get(n);
      if (!s) continue;

      const req = reqsFor(n);
      for (const r of req) {
        if (!next.has(r)) stack.push(r);
      }
      next.add(n);
    }

    return next;
  }

  function calcSPUsedFromSet(setRef) {
    let total = 0;
    for (const n of setRef) {
      total += Number(skillByName.get(n)?.skillpoint_cost ?? 0);
    }
    return total;
  }

  function canSelectWithinCap(skillName) {
    if (selected.has(skillName)) return true;
    const projected = projectedSelectionWithPrereqs(skillName);
    return calcSPUsedFromSet(projected) <= SP_CAP_DEFAULT;
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
    return calcSPUsedFromSet(selected);
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
  function labelFromSkillName(name, professionName = "", treeCol = -1) {
    const parts = String(name).split("_");

    // Brawler uses richer names in skill_names (e.g. "Unarmed I: Street Fighting").
    // Render them directly so branch labels match the intended tree names.
    if (
      professionName === "combat_brawler" ||
      String(name).includes("combat_brawler_")
    ) {
      const brawlerName = SD?.skill_names?.[name];
      if (brawlerName) {
        return String(brawlerName).replace(/:\s*/, "\n");
      }
    }

    // Artisan also has explicit labels in skill_names (e.g. "Engineering I: Tinkering").
    if (
      professionName === "crafting_artisan" ||
      String(name).includes("crafting_artisan_")
    ) {
      const artisanName = SD?.skill_names?.[name];
      if (artisanName) {
        return String(artisanName).replace(/:\s*/, "\n");
      }
    }

    // Entertainer labels should use explicit skill_names text.
    if (
      professionName === "social_entertainer" ||
      String(name).includes("social_entertainer_")
    ) {
      const entertainerName = SD?.skill_names?.[name];
      if (entertainerName) {
        return String(entertainerName).replace(/:\s*/, "\n");
      }
    }

    // Marksman labels should use explicit skill_names text.
    if (
      professionName === "combat_marksman" ||
      String(name).includes("combat_marksman_")
    ) {
      const marksmanName = SD?.skill_names?.[name];
      if (marksmanName) {
        return String(marksmanName).replace(/:\s*/, "\n");
      }
    }

    // Force-sensitive progression labels should use explicit skill_names text.
    if (
      professionName === "force_sensitive_combat_prowess" ||
      String(name).includes("force_sensitive_combat_prowess_")
    ) {
      const prowessName = SD?.skill_names?.[name];
      if (prowessName) {
        return String(prowessName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "force_sensitive_crafting_mastery" ||
      String(name).includes("force_sensitive_crafting_mastery_")
    ) {
      const craftingMasteryName = SD?.skill_names?.[name];
      if (craftingMasteryName) {
        return String(craftingMasteryName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "force_sensitive_enhanced_reflexes" ||
      String(name).includes("force_sensitive_enhanced_reflexes_")
    ) {
      const enhancedReflexesName = SD?.skill_names?.[name];
      if (enhancedReflexesName) {
        return String(enhancedReflexesName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "force_sensitive_heightened_senses" ||
      String(name).includes("force_sensitive_heightened_senses_")
    ) {
      const heightenedSensesName = SD?.skill_names?.[name];
      if (heightenedSensesName) {
        return String(heightenedSensesName).replace(/:\s*/, "\n");
      }
    }

    // Additional profession labels should use explicit skill_names text.
    if (
      professionName === "crafting_architect" ||
      String(name).includes("crafting_architect_")
    ) {
      const architectName = SD?.skill_names?.[name];
      if (architectName) {
        return String(architectName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "crafting_armorsmith" ||
      String(name).includes("crafting_armorsmith_")
    ) {
      const armorsmithName = SD?.skill_names?.[name];
      if (armorsmithName) {
        return String(armorsmithName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "outdoors_bio_engineer" ||
      String(name).includes("outdoors_bio_engineer_")
    ) {
      const bioEngineerName = SD?.skill_names?.[name];
      if (bioEngineerName) {
        return String(bioEngineerName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "combat_bountyhunter" ||
      String(name).includes("combat_bountyhunter_")
    ) {
      const bountyHunterName = SD?.skill_names?.[name];
      if (bountyHunterName) {
        return String(bountyHunterName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "combat_carbine" ||
      String(name).includes("combat_carbine_")
    ) {
      const carbineerName = SD?.skill_names?.[name];
      if (carbineerName) {
        return String(carbineerName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "crafting_chef" ||
      String(name).includes("crafting_chef_")
    ) {
      const chefName = SD?.skill_names?.[name];
      if (chefName) {
        return String(chefName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "science_combatmedic" ||
      String(name).includes("science_combatmedic_")
    ) {
      const combatMedicName = SD?.skill_names?.[name];
      if (combatMedicName) {
        return String(combatMedicName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "combat_commando" ||
      String(name).includes("combat_commando_")
    ) {
      const commandoName = SD?.skill_names?.[name];
      if (commandoName) {
        return String(commandoName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "outdoors_creaturehandler" ||
      String(name).includes("outdoors_creaturehandler_")
    ) {
      const creatureHandlerName = SD?.skill_names?.[name];
      if (creatureHandlerName) {
        return String(creatureHandlerName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "social_dancer" ||
      String(name).includes("social_dancer_")
    ) {
      const dancerName = SD?.skill_names?.[name];
      if (dancerName) {
        return String(dancerName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "science_doctor" ||
      String(name).includes("science_doctor_")
    ) {
      const doctorName = SD?.skill_names?.[name];
      if (doctorName) {
        return String(doctorName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "crafting_droidengineer" ||
      String(name).includes("crafting_droidengineer_")
    ) {
      const droidEngineerName = SD?.skill_names?.[name];
      if (droidEngineerName) {
        return String(droidEngineerName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "combat_1hsword" ||
      String(name).includes("combat_1hsword_")
    ) {
      const fencerName = SD?.skill_names?.[name];
      if (fencerName) {
        return String(fencerName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "social_imagedesigner" ||
      String(name).includes("social_imagedesigner_")
    ) {
      const imageDesignerName = SD?.skill_names?.[name];
      if (imageDesignerName) {
        return String(imageDesignerName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "crafting_merchant" ||
      String(name).includes("crafting_merchant_")
    ) {
      const merchantName = SD?.skill_names?.[name];
      if (merchantName) {
        return String(merchantName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "social_musician" ||
      String(name).includes("social_musician_")
    ) {
      const musicianName = SD?.skill_names?.[name];
      if (musicianName) {
        return String(musicianName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "combat_polearm" ||
      String(name).includes("combat_polearm_")
    ) {
      const pikemanName = SD?.skill_names?.[name];
      if (pikemanName) {
        return String(pikemanName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "social_politician" ||
      String(name).includes("social_politician_")
    ) {
      const politicianName = SD?.skill_names?.[name];
      if (politicianName) {
        return String(politicianName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "combat_pistol" ||
      String(name).includes("combat_pistol_")
    ) {
      const pistoleerName = SD?.skill_names?.[name];
      if (pistoleerName) {
        return String(pistoleerName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "outdoors_ranger" ||
      String(name).includes("outdoors_ranger_")
    ) {
      const rangerName = SD?.skill_names?.[name];
      if (rangerName) {
        return String(rangerName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "combat_rifle" ||
      String(name).includes("combat_rifle_")
    ) {
      const riflemanName = SD?.skill_names?.[name];
      if (riflemanName) {
        return String(riflemanName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "crafting_shipwright" ||
      String(name).includes("crafting_shipwright_")
    ) {
      const shipwrightName = SD?.skill_names?.[name];
      if (shipwrightName) {
        return String(shipwrightName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "combat_smuggler" ||
      String(name).includes("combat_smuggler_")
    ) {
      const smugglerName = SD?.skill_names?.[name];
      if (smugglerName) {
        return String(smugglerName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "outdoors_squadleader" ||
      String(name).includes("outdoors_squadleader_")
    ) {
      const squadLeaderName = SD?.skill_names?.[name];
      if (squadLeaderName) {
        return String(squadLeaderName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "combat_2hsword" ||
      String(name).includes("combat_2hsword_")
    ) {
      const swordsmanName = SD?.skill_names?.[name];
      if (swordsmanName) {
        return String(swordsmanName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "crafting_tailor" ||
      String(name).includes("crafting_tailor_")
    ) {
      const tailorName = SD?.skill_names?.[name];
      if (tailorName) {
        return String(tailorName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "combat_unarmed" ||
      String(name).includes("combat_unarmed_")
    ) {
      const teraKasiName = SD?.skill_names?.[name];
      if (teraKasiName) {
        return String(teraKasiName).replace(/:\s*/, "\n");
      }
    }

    if (
      professionName === "crafting_weaponsmith" ||
      String(name).includes("crafting_weaponsmith_")
    ) {
      const weaponsmithName = SD?.skill_names?.[name];
      if (weaponsmithName) {
        return String(weaponsmithName).replace(/:\s*/, "\n");
      }
    }

    // Medic labels should use explicit skill_names text.
    if (
      professionName === "science_medic" ||
      String(name).includes("science_medic_")
    ) {
      const medicName = SD?.skill_names?.[name];
      if (medicName) {
        return String(medicName).replace(/:\s*/, "\n");
      }
    }

    // Scout labels should use explicit skill_names text.
    if (
      professionName === "outdoors_scout" ||
      String(name).includes("outdoors_scout_")
    ) {
      const scoutName = SD?.skill_names?.[name];
      if (scoutName) {
        return String(scoutName).replace(/:\s*/, "\n");
      }
    }

    // Profession-specific branch labels where raw node names are ambiguous.
    if (professionName === "force_sensitive_enhanced_reflexes") {
      const branchByCol = ["Ranged Defense", "Melee Defense", "Vehicle Control", "Survival"];
      const fixed = branchByCol[treeCol];
      const tier = Number(parts[parts.length - 1]);
      const tierRoman = Number.isFinite(tier)
        ? (["", "I", "II", "III", "IV", "V"][tier] || String(tier))
        : "";
      if (fixed) return tierRoman ? `${fixed} ${tierRoman}` : fixed;
    }

    const isForceHealingNode =
      professionName === "force_discipline_healing" ||
      String(name).includes("force_discipline_healing_");

    if (isForceHealingNode) {
      const branchByCol = ["Force Rejuvenation", "Force Restoration", "Force Assist", "Force Purification"];
      const fixed = branchByCol[treeCol];
      const tier = Number(parts[parts.length - 1]);
      const tierRoman = Number.isFinite(tier)
        ? (["", "I", "II", "III", "IV", "V"][tier] || String(tier))
        : "";
      if (fixed) return tierRoman ? `${fixed} ${tierRoman}` : fixed;
    }
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
      : parts.includes("ranged") && parts.includes("defense")
      ? "Ranged Defense"
      : parts.includes("melee") && parts.includes("defense")
      ? "Melee Defense"
      : parts.includes("vehicle") && parts.includes("control")
      ? "Vehicle Control"
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

    // Block new picks that would exceed the skill point cap.
    b.disabled = !selected.has(skillName) && !canSelectWithinCap(skillName);

    if (selected.has(skillName)) b.classList.add("on");

    b.addEventListener("click", () => {
      if (selected.has(skillName)) {
        deselectCascade(skillName);
      } else {
        if (!canSelectWithinCap(skillName)) return;
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

        const label = labelFromSkillName(node.name, p?.name, col);
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
    noviceBtn.disabled = !noviceName || (!selected.has(noviceName) && !canSelectWithinCap(noviceName));
    noviceBtn.className = "skill skill-wide" + (noviceName && selected.has(noviceName) ? " on" : "");
    noviceBtn.textContent = noviceName ? skillDisplayName(noviceName) : "Novice";
    noviceBtn.onclick = noviceName
      ? () => {
          if (selected.has(noviceName)) deselectCascade(noviceName);
          else {
            if (!canSelectWithinCap(noviceName)) return;
            selectWithPrereqs(noviceName);
          }
          render();
        }
      : null;

    // Master
    masterBtn.disabled = !masterName || (!selected.has(masterName) && !canSelectWithinCap(masterName));
    masterBtn.className = "skill skill-wide" + (masterName && selected.has(masterName) ? " on" : "");
    masterBtn.textContent = masterName ? skillDisplayName(masterName) : "Master";
    masterBtn.onclick = masterName
      ? () => {
          if (selected.has(masterName)) deselectCascade(masterName);
          else {
            if (!canSelectWithinCap(masterName)) return;
            selectWithPrereqs(masterName);
          }
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
    if (!isVisibleProfessionKey(currentProfKey)) {
      currentProfKey = DEFAULT_VISIBLE_PROF_KEY;
    }

    const p = professions[currentProfKey];
    if (!p) {
      dbg(`ERROR: Current profession key not found: ${currentProfKey}`);
      return;
    }

    renderHeader();
    renderBuildStrip();
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

  downloadBtn.addEventListener("click", () => {
    downloadTemplate();
  });

  // ---------- Init ----------
  buildMenu();
  render();

  // Optional debug: comment out if you don't want it always visible
  // dbg(`OK: Loaded professions=${profKeys.length}\nFirst=${profKeys[0]}`);
})();








