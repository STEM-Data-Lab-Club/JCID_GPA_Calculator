// JCID GPA Calculator v1.1 (client-side only)

const CFG = {
  decimals: 2,
  mypMax: 4.0,
  dp: {
    defaultCredits: { "IB HL": 6, "IB SL": 4 },
    excludeTypes: new Set(["TOK", "CAS", "EE"]),
    ibHL: { 7: 4.5, 6: 4.1, 5: 3.7, 4: 3.3, 3: 2.8, 2: 2.4, 1: 0.0 },
    ibSL: { 7: 4.3, 6: 3.9, 5: 3.5, 4: 3.1, 3: 2.6, 2: 2.1, 1: 0.0 }
  },
  nonIbBands: [
    { min: 93, max: 100, gp: 4.0 },
    { min: 85, max: 92,  gp: 3.5 },
    { min: 78, max: 84,  gp: 3.2 },
    { min: 70, max: 77,  gp: 2.9 },
    { min: 60, max: 69,  gp: 2.4 },
    { min: 45, max: 59,  gp: 1.8 },
    { min: 0,  max: 44,  gp: 0.0 }
  ]
};

const $ = (id) => document.getElementById(id);
const mypBody = document.querySelector("#myp-table tbody");
const dpBody = document.querySelector("#dp-table tbody");

function fmt(x){
  return Number.isFinite(x) ? x.toFixed(CFG.decimals) : "—";
}

function roundRaw(raw){
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.floor(n + 0.5); // 92.5 -> 93
}

function rawToGP(raw){
  const r = roundRaw(raw);
  if (r === null) return null;
  for (const b of CFG.nonIbBands){
    if (r >= b.min && r <= b.max) return b.gp;
  }
  return null;
}

function ibToGP(type, score){
  const s = Number(score);
  if (!Number.isFinite(s) || s < 1 || s > 7) return null;
  if (type === "IB HL") return CFG.dp.ibHL[s] ?? null;
  if (type === "IB SL") return CFG.dp.ibSL[s] ?? null;
  return null;
}

function compute(rows){
  let num = 0, den = 0, count = 0;
  for (const r of rows){
    if (!r.included) continue;
    if (!Number.isFinite(r.gp)) continue;
    if (!Number.isFinite(r.credit) || r.credit <= 0) continue;
    num += r.gp * r.credit;
    den += r.credit;
    count += 1;
  }
  return { gpa: den > 0 ? (num/den) : null, credits: den, count };
}

/* Tabs */
function setTab(btnId){
  const tabs = [
    { btn:"tab-myp", panel:"panel-myp" },
    { btn:"tab-dp", panel:"panel-dp" },
    { btn:"tab-policy", panel:"panel-policy" }
  ];
  for (const t of tabs){
    const active = t.btn === btnId;
    $(t.btn).setAttribute("aria-selected", active ? "true" : "false");
    $(t.panel).hidden = !active;
  }
}
$("tab-myp").addEventListener("click", ()=>setTab("tab-myp"));
$("tab-dp").addEventListener("click", ()=>setTab("tab-dp"));
$("tab-policy").addEventListener("click", ()=>setTab("tab-policy"));

/* MYP rows */
function mypRow(){
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="subj" placeholder="e.g., Mathematics"/></td>
    <td><input class="raw" placeholder="0-100" inputmode="decimal"/></td>
    <td><input class="local" placeholder="1-8" inputmode="numeric"/></td>
    <td><input class="credit" placeholder="Credit" inputmode="decimal"/></td>
    <td class="gp">—</td>
    <td class="ctr">—</td>
    <td><button class="icon-del" title="Remove">🗑</button></td>
  `;
  tr.querySelector(".icon-del").addEventListener("click", ()=>{ tr.remove(); recalcMYP(); });
  tr.addEventListener("input", recalcMYP);
  return tr;
}

function readMYP(){
  const out = [];
  for (const tr of [...mypBody.querySelectorAll("tr")]){
    const subj = tr.querySelector(".subj").value.trim() || "Untitled";
    const raw = tr.querySelector(".raw").value.trim();
    const creditStr = tr.querySelector(".credit").value.trim();

    const gp0 = rawToGP(raw);
    const gp = gp0 === null ? null : Math.min(gp0, CFG.mypMax);

    const credit = Number(creditStr);
    const creditNum = Number.isFinite(credit) ? credit : NaN;

    const included = (gp !== null) && Number.isFinite(creditNum) && creditNum > 0;

    tr.querySelector(".gp").textContent = gp === null ? "—" : fmt(gp);
    tr.querySelector(".ctr").textContent = included ? fmt(gp * creditNum) : "—";

    out.push({ subj, gp, credit: creditNum, included });
  }
  return out;
}

function renderBreakdown(elId, rows){
  const box = $(elId);
  const included = rows.filter(r=>r.included);
  if (!included.length){
    box.className = "muted small";
    box.textContent = "Add subjects to see contributions.";
    return;
  }
  box.className = "";
  box.innerHTML = "";
  included.forEach(r=>{
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="l">
        <div><b>${escapeHtml(r.subj)}</b></div>
        <div class="s">${fmt(r.gp)} × ${fmt(r.credit)}</div>
      </div>
      <div><b>${fmt(r.gp * r.credit)}</b></div>
    `;
    box.appendChild(row);
  });
}

function validateMYP(){
  const errs = [];
  const trs = [...mypBody.querySelectorAll("tr")];
  trs.forEach((tr,i)=>{
    const raw = tr.querySelector(".raw").value.trim();
    const credit = tr.querySelector(".credit").value.trim();
    if (raw !== "" && roundRaw(raw) === null) errs.push(`Row ${i+1}: Raw score must be 0–100 (0.5 rounds up).`);
    if (credit !== "" && (!Number.isFinite(Number(credit)) || Number(credit) <= 0)) errs.push(`Row ${i+1}: Credit must be a positive number.`);
  });
  const box = $("myp-alert");
  if (errs.length){
    box.hidden = false;
    box.innerHTML = "<b>Fix the following:</b><br/>" + errs.map(e=>"• "+escapeHtml(e)).join("<br/>");
  } else {
    box.hidden = true;
    box.textContent = "";
  }
}

function recalcMYP(){
  const rows = readMYP();
  const { gpa, credits, count } = compute(rows);
  $("myp-gpa").textContent = gpa === null ? "—" : fmt(gpa);
  $("myp-credits").textContent = fmt(credits);
  $("myp-count").textContent = String(count);
  renderBreakdown("myp-breakdown", rows);
  validateMYP();
}

$("myp-add").addEventListener("click", ()=>{ mypBody.appendChild(mypRow()); recalcMYP(); });
$("myp-reset").addEventListener("click", ()=>{
  mypBody.innerHTML = "";
  mypBody.appendChild(mypRow());
  recalcMYP();
});
$("myp-print").addEventListener("click", ()=>window.print());

/* DP rows */
const DP_TYPES = ["IB HL","IB SL","Non-IB","TOK","CAS","EE"];

function scoreControl(type, preset=""){
  if (type === "IB HL" || type === "IB SL"){
    const sel = document.createElement("select");
    sel.className = "score";
    const ph = document.createElement("option");
    ph.value = ""; ph.textContent = "—";
    sel.appendChild(ph);
    for (let i=1;i<=7;i++){
      const o = document.createElement("option");
      o.value = String(i); o.textContent = String(i);
      sel.appendChild(o);
    }
    sel.value = preset === "" ? "" : String(preset);
    return sel;
  }
  const inp = document.createElement("input");
  inp.className = "score";
  inp.placeholder = "0-100";
  inp.inputMode = "decimal";
  inp.value = preset === "" ? "" : String(preset);
  return inp;
}

function dpRow(prefill={}){
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="subj" placeholder="e.g., Math HL"/></td>
    <td><select class="type"></select></td>
    <td class="scorecell"></td>
    <td><input class="credit" placeholder="Credit" inputmode="decimal"/></td>
    <td class="gp">—</td>
    <td class="status"></td>
    <td class="ctr">—</td>
    <td><button class="icon-del" title="Remove">🗑</button></td>
  `;

  const subj = tr.querySelector(".subj");
  const type = tr.querySelector(".type");
  const scorecell = tr.querySelector(".scorecell");
  const credit = tr.querySelector(".credit");

  DP_TYPES.forEach(t=>{
    const o=document.createElement("option");
    o.value=t; o.textContent=t;
    type.appendChild(o);
  });

  subj.value = prefill.subject ?? "";
  type.value = prefill.type ?? "IB HL";

  scorecell.appendChild(scoreControl(type.value, prefill.score ?? ""));

  const def = CFG.dp.defaultCredits[type.value];
  if (prefill.credit !== undefined) credit.value = String(prefill.credit);
  else if (def !== undefined) credit.value = String(def);
  else credit.value = "";

  function paintStatus(){
    const excluded = CFG.dp.excludeTypes.has(type.value);
    tr.querySelector(".status").innerHTML = excluded
      ? `<span class="status-pill ex">Excluded</span>`
      : `<span class="status-pill in">Included</span>`;
  }

  type.addEventListener("change", ()=>{
    scorecell.innerHTML="";
    scorecell.appendChild(scoreControl(type.value,""));
    const d = CFG.dp.defaultCredits[type.value];
    if (d !== undefined) credit.value = String(d);
    paintStatus();
    recalcDP();
  });

  tr.addEventListener("input", recalcDP);
  tr.querySelector(".icon-del").addEventListener("click", ()=>{ tr.remove(); recalcDP(); });

  paintStatus();
  return tr;
}

function readDP(){
  const out=[];
  for (const tr of [...dpBody.querySelectorAll("tr")]){
    const subj = tr.querySelector(".subj").value.trim() || "Untitled";
    const type = tr.querySelector(".type").value;
    const scoreEl = tr.querySelector(".score");
    const creditStr = tr.querySelector(".credit").value.trim();

    const excluded = CFG.dp.excludeTypes.has(type);

    let gp=null;
    if (type === "IB HL" || type === "IB SL") gp = ibToGP(type, scoreEl.value);
    else gp = rawToGP(scoreEl.value);

    const credit = Number(creditStr);
    const creditNum = Number.isFinite(credit) ? credit : NaN;

    const included = !excluded && gp !== null && Number.isFinite(creditNum) && creditNum > 0;

    tr.querySelector(".gp").textContent = gp === null ? "—" : fmt(gp);
    tr.querySelector(".ctr").textContent = excluded ? "Excluded" : (included ? fmt(gp*creditNum) : "—");

    out.push({ subj, gp, credit: creditNum, included });
  }
  return out;
}

function validateDP(){
  const errs=[];
  const trs=[...dpBody.querySelectorAll("tr")];
  trs.forEach((tr,i)=>{
    const type = tr.querySelector(".type").value;
    const scoreEl = tr.querySelector(".score");
    const credit = tr.querySelector(".credit").value.trim();

    if (type === "IB HL" || type === "IB SL"){
      if (scoreEl.value !== "" && (Number(scoreEl.value) < 1 || Number(scoreEl.value) > 7))
        errs.push(`Row ${i+1}: IB score must be 1–7.`);
    } else {
      const raw = scoreEl.value.trim();
      if (raw !== "" && roundRaw(raw) === null)
        errs.push(`Row ${i+1}: Raw score must be 0–100 (0.5 rounds up).`);
    }
    if (credit !== "" && (!Number.isFinite(Number(credit)) || Number(credit) < 0))
      errs.push(`Row ${i+1}: Credit must be non-negative (excluded courses can be 0).`);
  });

  const box=$("dp-alert");
  if (errs.length){
    box.hidden=false;
    box.innerHTML="<b>Fix the following:</b><br/>"+errs.map(e=>"• "+escapeHtml(e)).join("<br/>");
  } else {
    box.hidden=true;
    box.textContent="";
  }
}

function recalcDP(){
  const rows = readDP();
  const { gpa, credits, count } = compute(rows);
  $("dp-gpa").textContent = gpa === null ? "—" : fmt(gpa);
  $("dp-credits").textContent = fmt(credits);
  $("dp-count").textContent = String(count);
  renderBreakdown("dp-breakdown", rows);
  validateDP();
}

$("dp-add").addEventListener("click", ()=>{ dpBody.appendChild(dpRow()); recalcDP(); });
$("dp-reset").addEventListener("click", ()=>{
  dpBody.innerHTML="";
  dpBody.appendChild(dpRow());
  recalcDP();
});
$("dp-sample").addEventListener("click", ()=>{
  dpBody.innerHTML="";
  dpBody.appendChild(dpRow({subject:"Math HL", type:"IB HL", score:7, credit:6}));
  dpBody.appendChild(dpRow({subject:"Physics HL", type:"IB HL", score:6, credit:6}));
  dpBody.appendChild(dpRow({subject:"Chemistry HL", type:"IB HL", score:7, credit:6}));
  dpBody.appendChild(dpRow({subject:"English SL", type:"IB SL", score:7, credit:4}));
  dpBody.appendChild(dpRow({subject:"Chinese SL", type:"IB SL", score:7, credit:4}));
  dpBody.appendChild(dpRow({subject:"Economics SL", type:"IB SL", score:6, credit:4}));
  dpBody.appendChild(dpRow({subject:"TOK", type:"TOK", score:92.5, credit:0}));
  recalcDP();
});
$("dp-print").addEventListener("click", ()=>window.print());

/* status pill CSS injection (small) */
const style = document.createElement("style");
style.textContent = `
  .status-pill{display:inline-block;padding:6px 10px;border-radius:999px;font-weight:800;font-size:13px;border:1px solid #e2e8f0}
  .status-pill.in{background:#ecfdf5;border-color:#bdeccf;color:#166534}
  .status-pill.ex{background:#f1f5f9;border-color:#e2e8f0;color:#334155}
`;
document.head.appendChild(style);

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

/* init */
(function init(){
  mypBody.innerHTML="";
  mypBody.appendChild(mypRow());
  dpBody.innerHTML="";
  dpBody.appendChild(dpRow());
  recalcMYP();
  recalcDP();
})();
