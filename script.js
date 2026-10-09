/* ---------- Config ---------- */
const USE_MOCK = true;                 // set to false when the backend is ready
const API_URL = "/api/classify";       // agree on this path with the backend team
const MAX_SIZE = 5 * 1024 * 1024;      // 5 MB
const ALLOWED = [".pdf", ".docx"];

/* ---------- API ---------- */
async function classifyResumes(files) {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 1500));
    return files.map((f, i) => i === 1
      ? { file: f.name, error: "Could not read text from this file. Try a text-based PDF." }
      : {
          file: f.name,
          candidate_summary: "Recent graduate with strong Python and SQL skills and one internship in data work.",
          skills: ["Python", "SQL", "Pandas", "Git"],
          education: ["BS Computer Science"],
          experience_years: 1,
          recommended_roles: [
            { title: "Data Analyst", fit_score: 87, reasons: ["Strong SQL and Python", "Internship with reporting tasks"], gaps: ["No dashboard tools such as Tableau"] },
            { title: "Junior Developer", fit_score: 68, reasons: ["CS degree", "Uses Git"], gaps: ["No web framework experience"] },
            { title: "QA Tester", fit_score: 41, reasons: ["Attention to detail in projects"], gaps: ["No testing tools listed"] }
          ]
        });
  }
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  const res = await fetch(API_URL, { method: "POST", body: fd });
  if (!res.ok) {
    let msg = "Request failed (" + res.status + ")";
    try { msg = (await res.json()).error || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

/* ---------- Elements & state ---------- */
const $ = id => document.getElementById(id);
const zone = $("drop-zone"), input = $("file-input"), list = $("file-list");
const message = $("message"), analyzeBtn = $("analyze-resume");
let files = [];

/* ---------- Helpers ---------- */
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}
const showView = name => {
  ["upload", "loading", "results"].forEach(v => { $(v + "-view").hidden = v !== name; });
};
const scoreColor = n => n >= 75 ? "var(--good)" : n >= 50 ? "var(--mid)" : "var(--low)";
const fmtSize = b => b < 1048576 ? Math.round(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB";

/* ---------- File selection ---------- */
function addFiles(incoming) {
  const problems = [];
  Array.from(incoming).forEach(f => {
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!ALLOWED.includes(ext)) problems.push(f.name + " is not a PDF or DOCX file.");
    else if (f.size > MAX_SIZE) problems.push(f.name + " is larger than 5 MB.");
    else if (!files.some(x => x.name === f.name && x.size === f.size)) files.push(f);
  });
  message.textContent = problems.join(" ");
  renderFiles();
}

function renderFiles() {
  list.innerHTML = files.map((f, i) =>
    `<li><span>${esc(f.name)}<span class="size">${fmtSize(f.size)}</span></span>
     <button data-i="${i}" aria-label="Remove ${esc(f.name)}">Remove</button></li>`).join("");
  analyzeBtn.disabled = files.length === 0;
}

list.addEventListener("click", e => {
  const i = e.target.dataset.i;
  if (i !== undefined) { files.splice(Number(i), 1); renderFiles(); }
});

zone.addEventListener("click", () => input.click());
zone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });

["dragenter", "dragover"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("dragover"); }));
["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("dragover"); }));
zone.addEventListener("drop", e => addFiles(e.dataTransfer.files));

/* ---------- Analyze ---------- */
analyzeBtn.addEventListener("click", async () => {
  showView("loading");
  try {
    renderResults(await classifyResumes(files));
    showView("results");
  } catch (err) {
    showView("upload");
    message.textContent = "Analysis failed: " + err.message + ". Check your connection and try again.";
  }
});

function renderResults(data) {
  $("results").innerHTML = data.map(d => {
    if (d.error) {
      return `<article class="result error"><h2>${esc(d.file)}</h2><p>${esc(d.error)}</p></article>`;
    }
    const roles = (d.recommended_roles || []).slice()
      .sort((a, b) => b.fit_score - a.fit_score)
      .map(r => `
        <div class="role">
          <div class="role-head"><span>${esc(r.title)}</span><span>${esc(r.fit_score)}%</span></div>
          <div class="bar" role="img" aria-label="Fit score ${esc(r.fit_score)} percent">
            <span style="width:${Math.max(0, Math.min(100, Number(r.fit_score) || 0))}%;background:${scoreColor(r.fit_score)}"></span>
          </div>
          <details>
            <summary>Why this role</summary>
            <ul>${(r.reasons || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
            ${(r.gaps && r.gaps.length) ? `<p><b>Gaps:</b></p><ul>${r.gaps.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          </details>
        </div>`).join("");

    return `
      <article class="result">
        <h2>${esc(d.file)}</h2>
        <p class="summary">${esc(d.candidate_summary)}</p>
        <div class="meta">
          <div><b>Education:</b> ${(d.education || []).map(esc).join("; ") || "Not found"}</div>
          <div><b>Experience:</b> ${esc(d.experience_years)} year(s)</div>
        </div>
        <h3>Skills</h3>
        <ul class="tags">${(d.skills || []).map(s => `<li>${esc(s)}</li>`).join("")}</ul>
        <h3>Recommended roles</h3>
        ${roles}
      </article>`;
  }).join("");
}

/* ---------- Reset ---------- */
$("reset").addEventListener("click", () => {
  files = [];
  message.textContent = "";
  renderFiles();
  showView("upload");
});