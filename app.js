// ===========================
// JCID GPA Calculator (v1.0)
// Client-side only
// ===========================

// ---- Config (JCID rules) ----
const CFG = {
  decimals: 2,

  // DP mappings (explicit; NOT derived from credits)
  dp: {
    defaultCredits: { "IB HL": 6, "IB SL": 4 },
    excludeTypes: new Set(["TOK", "CAS", "EE"]),
    ibHL: { 7: 4.5, 6: 4.1, 5: 3.7, 4: 3.3, 3: 2.8, 2: 2.4, 1: 0.0 },
    ibSL: { 7: 4.3, 6: 3.9, 5: 3.5, 4: 3.1, 3: 2.6, 2: 2.1, 1: 0.0 },
  },

  // Non-IB raw score bands (MYP + DP Non-IB; also used for excluded display)
  nonIbBands: [
    { min: 93, max: 100, gp: 4.0 },
    { min: 85, max: 92,  gp: 3.5 },
    { min: 78, max: 84,  gp: 3.2 },
    { min: 70, max: 77,  gp: 2.9 },
    { min: 60, max: 69,  gp: 2.4 },
    { min: 45, max: 59,  gp: 1.8 },
    { min: 0,  max: 44,  gp: 0.0 },
  ],

  // MYP max GPA is 4.00 (by scale)
  mypMax: 4.0,
};

const $ = (id) => document.getElementById(id);

function setTab(activeBtnId) {
  const tabs = [
    { btn: "tab-myp", panel: "panel-myp" },
    { btn: "tab-dp", panel: "panel-dp" },
    { btn: "tab-policy", panel: "panel-policy" },
  ];
  for (const t of tabs) {
    const active = t.btn === activeBtnId;
    $(t.btn).setAttribute("aria-selected", active ? "true" : "false");
    $(t.panel).hidden = !active;
  }
}

// ---- Rounding rule: nearest integer, .5 rounds up ----
function roundRaw(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return Math.floor(n + 0.5); // ensures 92.5 -> 93
}

function rawToNonIbGP(raw) {
  const r = roundRaw(raw);
  if (r === null) return null;
  for (const b of CFG.nonIbBands) {
    if (r >= b.min && r <= b.max) return b.gp;
  }
  return null;
}

function ibToGP(type, score) {
  const s = Number(score);
  if (!Number.isFinite(s) || s < 1 || s > 7) return null;
  if (type === "IB HL") return CFG.dp.ibHL[s] ?? null;
  if (type === "IB SL") return CFG.dp.ibSL[s] ?? null;
  return null;
}

function fmt(x) {
  return Number.isFinite(x) ? x.toFixed(CFG.decimals) : "—";
}

// ---- GPA calc ----
function computeGPA(rows) {
  let num = 0;
  let den = 0;
  let count = 0;

  for (const r of rows) {
    if (!r.included) continue;
    if (!Number.isFinite(r.gp)) continue;
    if (!Number.isFinite(r.credit) || r.credit <= 0) continue;
    num += r.gp * r.credit;
    den += r.credit;
    count += 1;
  }
  return {
    gpa: den > 0 ? (num / den) : null,
    credits: den,
    count
  };
}

// ===========================
// MYP UI
// ===========================
const mypBody = document.querySelector("#myp-table tbody");

function mypRow() {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="myp-subj" placeholder="e.g., Mathematics"/></td>
    <td><input class="myp-raw" placeholder="0-100" inputmode="decimal"/></td>
    <td><input class="myp-local" placeholder="1-8" inputmode="numeric"/></td>
    <td><input class="myp-credit" placeholder="Credit" inputmode="decimal"/></td>
    <td class="myp-gp">—</td>
    <td class="myp-ctr">—</td>
    <td><button class="icon-del" title="Remove">🗑</button></td>
  `;

  tr.querySelector(".icon-del").addEventListener("click", () => {
    tr.remove();
    recalcMYP();
  });

  tr.addEventListener("input", recalcMYP);
  return tr;
}

function mypReadRows() {
  const rows = [];
  for (const tr of [...mypBody.querySelectorAll("tr")]) {
    const raw = tr.querySelector(".myp-raw").value.trim();
    const creditStr = tr.querySelector(".myp-credit").value.trim();

    const gp0 = rawToNonIbGP(raw);
    const gp = gp0 === null ? null : Math.min(gp0, CFG.mypMax);

    const credit = Number(creditStr);
    const creditNum = Number.isFinite(credit) ? credit : NaN;

    const included = gp !== null && Number.isFinite(creditNum) && creditNum > 0;

    // render row computed
    tr.querySelector(".myp-gp").textContent = gp === null ? "—" : fmt(gp);
    tr.querySelector(".myp-ctr").textContent = included ? fmt(gp * creditNum) : "—";

    rows.push({ gp, credit: creditNum, included });
  }
  return rows;
}

function validateMYP() {
  const errors = [];
  const trs = [...mypBody.querySelectorAll("tr")];
  trs.forEach((tr, i) => {
    const raw = tr.querySelector(".myp-raw").value.trim();
    const credit = tr.querySelector(".myp-credit").value.trim();

    if (raw !== "" && roundRaw(raw) === null) {
      errors.push(`Row ${i + 1}: Raw score must be 0–100 (decimals allowed; 0.5 rounds up).`);
    }
    if (credit !== "" && (!Number.isFinite(Number(credit)) || Number(credit) <= 0)) {
      errors.push(`Row ${i + 1}: Credit must be a positive number.`);
    }
  });

  const box = $("myp-alert");
  if (errors.length) {
    box.hidden = false;
    box.innerHTML = "<b>Fix the following:</b><br/>" + errors.map(e => "• " + e).join("<br/>");
  } else {
    box.hidden = true;
    box.textContent = "";
  }
}

function recalcMYP() {
  const rows = mypReadRows();
  const { gpa, credits, count } = computeGPA(rows);
  $("myp-gpa").textContent = gpa === null ? "—" : fmt(gpa);
  $("myp-credits").textContent = fmt(credits);
  $("myp-count").textContent = String(count);
  validateMYP();
}

$("myp-add").addEventListener("click", () => {
  mypBody.appendChild(mypRow());
  recalcMYP();
});

$("myp-reset").addEventListener("click", () => {
  mypBody.innerHTML = "";
  mypBody.appendChild(mypRow());
  recalcMYP();
});

$("myp-print").addEventListener("click", () => window.print());

// ===========================
// DP UI
// ===========================
const dpBody = document.querySelector("#dp-table tbody");
const DP_TYPES = ["IB HL", "IB SL", "Non-IB", "TOK", "CAS", "EE"];

function dpScoreControl(type, presetScore = "") {
  // IB: dropdown 1-7, Non-IB/TOK/CAS/EE: raw input
  if (type === "IB HL" || type === "IB SL") {
    const sel = document.createElement("select");
    sel.className = "dp-score";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "—";
    sel.appendChild(placeholder);
    for (let i = 1; i <= 7; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      sel.appendChild(opt);
    }
    sel.value = presetScore === "" ? "" : String(presetScore);
    return sel;
  }
  const inp = document.createElement("input");
  inp.className = "dp-score";
  inp.placeholder = "0-100";
  inp.inputMode = "decimal";
  inp.value = presetScore === "" ? "" : String(presetScore);
  return inp;
}

function dpRow(prefill = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="dp-subj" placeholder="e.g., Math HL"/></td>
    <td>
      <select class="dp-type"></select>
    </td>
    <td class="dp-scorecell"></td>
    <td><input class="dp-credit" placeholder="Credit" inputmode="decimal"/></td>
    <td class="dp-gp">—</td>
    <td class="dp-status"></td>
    <td class="dp-ctr">—</td>
    <td><button class="icon-del" title="Remove">🗑</button></td>
  `;

  const subj = tr.querySelector(".dp-subj");
  const typeSel = tr.querySelector(".dp-type");
  const scoreCell = tr.querySelector(".dp-scorecell");
  const creditInp = tr.querySelector(".dp-credit");

  DP_TYPES.forEach(t => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    typeSel.appendChild(o);
  });

  subj.value = prefill.subject ?? "";
  typeSel.value = prefill.type ?? "IB HL";

  // score control
  const scoreCtrl = dpScoreControl(typeSel.value, prefill.score ?? "");
  scoreCell.appendChild(scoreCtrl);

  // default credits for IB HL/SL
  const def = CFG.dp.defaultCredits[typeSel.value];
  if (prefill.credit !== undefined) {
    creditInp.value = String(prefill.credit);
  } else if (def !== undefined) {
    creditInp.value = String(def);
  } else {
    creditInp.value = "";
  }

  function renderStatus(excluded) {
    const td = tr.querySelector(".dp-status");
    td.innerHTML = excluded
      ? `<span class="status status-ex">Excluded</span>`
      : `<span class="status status-in">Included</span>`;
  }

  function onTypeChange() {
    scoreCell.innerHTML = "";
    const newCtrl = dpScoreControl(typeSel.value, "");
    scoreCell.appendChild(newCtrl);

    const d = CFG.dp.defaultCredits[typeSel.value];
    if (d !== undefined) creditInp.value = String(d);

    renderStatus(CFG.dp.excludeTypes.has(typeSel.value));
    recalcDP();
  }

  typeSel.addEventListener("change", onTypeChange);

  tr.addEventListener("input", recalcDP);
  tr.querySelector(".icon-del").addEventListener("click", () => {
    tr.remove();
    recalcDP();
  });

  renderStatus(CFG.dp.excludeTypes.has(typeSel.value));
  return tr;
}

function dpReadRows() {
  const rows = [];
  for (const tr of [...dpBody.querySelectorAll("tr")]) {
    const type = tr.querySelector(".dp-type").value;
    const scoreEl = tr.querySelector(".dp-score");
    const creditStr = tr.querySelector(".dp-credit").value.trim();

    const excluded = CFG.dp.excludeTypes.has(type);

    let gp = null;
    if (type === "IB HL" || type === "IB SL") gp = ibToGP(type, scoreEl.value);
    else gp = rawToNonIbGP(scoreEl.value);

    const credit = Number(creditStr);
    const creditNum = Number.isFinite(credit) ? credit : NaN;

    const included = !excluded && gp !== null && Number.isFinite(creditNum) && creditNum > 0;

    tr.querySelector(".dp-gp").textContent = gp === null ? "—" : fmt(gp);
    tr.querySelector(".dp-ctr").textContent = excluded ? "Excluded" : (included ? fmt(gp * creditNum) : "—");

    rows.push({ gp, credit: creditNum, included });
  }
  return rows;
}

function validateDP() {
  const errors = [];
  const trs = [...dpBody.querySelectorAll("tr")];

  trs.forEach((tr, i) => {
    const type = tr.querySelector(".dp-type").value;
    const scoreEl = tr.querySelector(".dp-score");
    const credit = tr.querySelector(".dp-credit").value.trim();

    if (type === "IB HL" || type === "IB SL") {
      if (scoreEl.value !== "" && (Number(scoreEl.value) < 1 || Number(scoreEl.value) > 7)) {
        errors.push(`Row ${i + 1}: IB score must be 1–7.`);
      }
    } else {
      const raw = scoreEl.value.trim();
      if (raw !== "" && roundRaw(raw) === null) {
        errors.push(`Row ${i + 1}: Raw score must be 0–100 (decimals allowed; 0.5 rounds up).`);
      }
    }

    if (credit !== "" && (!Number.isFinite(Number(credit)) || Number(credit) < 0)) {
      errors.push(`Row ${i + 1}: Credit must be a non-negative number (excluded courses can be 0).`);
    }
  });

  const box = $("dp-alert");
  if (errors.length) {
    box.hidden = false;
    box.innerHTML = "<b>Fix the following:</b><br/>" + errors.map(e => "• " + e).join("<br/>");
  } else {
    box.hidden = true;
    box.textContent = "";
  }
}

function recalcDP() {
  const rows = dpReadRows();
  const { gpa, credits, count } = computeGPA(rows);
  $("dp-gpa").textContent = gpa === null ? "—" : fmt(gpa);
  $("dp-credits").textContent = fmt(credits);
  $("dp-count").textContent = String(count);
  validateDP();
}

$("dp-add").addEventListener("click", () => {
  dpBody.appendChild(dpRow());
  recalcDP();
});

$("dp-reset").addEventListener("click", () => {
  dpBody.innerHTML = "";
  dpBody.appendChild(dpRow());
  recalcDP();
});

$("dp-sample").addEventListener("click", () => {
  dpBody.innerHTML = "";
  dpBody.appendChild(dpRow({ subject: "Math HL",      type: "IB HL", score: 7, credit: 6 }));
  dpBody.appendChild(dpRow({ subject: "Physics HL",   type: "IB HL", score: 6, credit: 6 }));
  dpBody.appendChild(dpRow({ subject: "Chemistry HL", type: "IB HL", score: 7, credit: 6 }));
  dpBody.appendChild(dpRow({ subject: "English SL",   type: "IB SL", score: 7, credit: 4 }));
  dpBody.appendChild(dpRow({ subject: "Chinese SL",   type: "IB SL", score: 7, credit: 4 }));
  dpBody.appendChild(dpRow({ subject: "Economics SL", type: "IB SL", score: 6, credit: 4 }));
  dpBody.appendChild(dpRow({ subject: "TOK",          type: "TOK",   score: 92.5, credit: 0 }));
  recalcDP();
});

$("dp-print").addEventListener("click", () => window.print());

// ===========================
// Tabs wiring + init
// ===========================
$("tab-myp").addEventListener("click", () => setTab("tab-myp"));
$("tab-dp").addEventListener("click", () => setTab("tab-dp"));
$("tab-policy").addEventListener("click", () => setTab("tab-policy"));

// Add status pill styling (DP) after DOM loads
const style = document.createElement("style");
style.textContent = `
  .status{display:inline-block;padding:6px 10px;border-radius:999px;font-weight:700;font-size:13px;border:1px solid #e2e8f0}
  .status-in{background:#eaf8ef;border-color:#bdeccf;color:#166534}
  .status-ex{background:#f1f5f9;border-color:#e2e8f0;color:#334155}
`;
document.head.appendChild(style);

// initial
(function init(){
  mypBody.appendChild(mypRow());
  dpBody.appendChild(dpRow());
  recalcMYP();
  recalcDP();
})();
