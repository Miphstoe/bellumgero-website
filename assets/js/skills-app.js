(() => {
  const root = document.getElementById("skillRoot");
  const spTotalEl = document.getElementById("spTotal");

  if (!window.STATIC_DATA || !STATIC_DATA.skills) {
    root.textContent =
      "Skill data not found. Verify /assets/js/skills-data.js loads and defines STATIC_DATA.skills.";
    return;
  }

  // Flatten all skills into a single list
  const skillMap = new Map(); // name -> skill object

  for (const profKey of Object.keys(STATIC_DATA.skills)) {
    const prof = STATIC_DATA.skills[profKey];

    if (prof?.novice?.name) skillMap.set(prof.novice.name, prof.novice);
    if (prof?.master?.name) skillMap.set(prof.master.name, prof.master);

    if (Array.isArray(prof?.trees)) {
      for (const tree of prof.trees) {
        for (const node of tree) {
          if (node?.name) skillMap.set(node.name, node);
        }
      }
    }
  }

  const selected = new Set();

  function recalc() {
    let total = 0;
    for (const name of selected) {
      const s = skillMap.get(name);
      total += Number(s?.skillpoint_cost ?? 0);
    }
    spTotalEl.textContent = String(total);
  }

  // Render a basic checklist
  const frag = document.createDocumentFragment();

  for (const [name, s] of skillMap.entries()) {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.alignItems = "center";
    row.style.padding = "6px 0";
    row.style.borderBottom = "1px solid rgba(0,0,0,0.08)";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(name);
      else selected.delete(name);
      recalc();
    });

    const sp = Number(s?.skillpoint_cost ?? 0);
    const text = document.createElement("div");
    text.innerHTML = `<strong>${name}</strong><div style="opacity:.8">SP: ${sp}</div>`;

    row.appendChild(cb);
    row.appendChild(text);

    frag.appendChild(row);
  }

  root.appendChild(frag);
  recalc();
})();
