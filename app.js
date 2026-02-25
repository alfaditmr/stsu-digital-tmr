// ================= Firebase (CDN Modules) =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  remove,
  query,
  orderByChild,
  limitToLast,
  equalTo,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

// ✅ PASTE config kamu (sudah kamu kasih)
const firebaseConfig = {
  apiKey: "AIzaSyDqIE0cumE-7RgK3XE5QIYyQLpzgl1nB8A",
  authDomain: "stsu-ee385.firebaseapp.com",
  databaseURL: "https://stsu-ee385-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "stsu-ee385",
  storageBucket: "stsu-ee385.firebasestorage.app",
  messagingSenderId: "415025124329",
  appId: "1:415025124329:web:bbfd49874ddf236d16b178"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ================= UI Helpers =================
const $ = (id) => document.getElementById(id);

function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }

function setMsg(el, text, type=""){
  el.textContent = text || "";
  el.className = "msg" + (type ? " " + type : "");
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function toIDDate(iso){ // yyyy-mm-dd -> dd/mm/yyyy
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function dayNameID(iso){
  if(!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const names = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  return names[d.getDay()];
}

function formatIDR(n){
  const v = Number(n||0);
  return "Rp " + v.toLocaleString("id-ID");
}

function parseIDR(str){
  if(str == null) return 0;
  const s = String(str).replace(/[^\d]/g,"");
  return s ? Number(s) : 0;
}

function monthKey(iso){ // yyyy-mm-dd -> yyyy-mm
  if(!iso) return "";
  return iso.slice(0,7);
}

function yyyymmdd(iso){ // yyyy-mm-dd -> yyyymmdd
  if(!iso) return "";
  return iso.replaceAll("-","");
}

// ================= Drawer =================
const drawer = $("drawer");
const drawerBackdrop = $("drawerBackdrop");
$("menuBtn").onclick = () => { show(drawer); show(drawerBackdrop); };
$("drawerClose").onclick = closeDrawer;
drawerBackdrop.onclick = closeDrawer;

function closeDrawer(){
  hide(drawer); hide(drawerBackdrop);
}

drawer.addEventListener("click", (e)=>{
  const btn = e.target.closest("[data-route]");
  if(!btn) return;
  const route = btn.getAttribute("data-route");
  navigate(route);
  closeDrawer();
});

// ================= State =================
let ME = null; // {uid,email,role}
let currentRoute = "login";
let currentTemplate = null; // loaded template for create
let currentDoc = null; // current stsu form doc (draft in memory)
let chart = null;

// ================= Routes =================
function navigate(route){
  currentRoute = route;

  hide($("viewLogin"));
  hide($("viewDashboard"));
  hide($("viewCreate"));
  hide($("viewSettings"));

  if(route === "login"){
    show($("viewLogin"));
  }else if(route === "dashboard"){
    show($("viewDashboard"));
    loadDashboard().catch(console.error);
  }else if(route === "create"){
    show($("viewCreate"));
    initCreate().catch(console.error);
  }else if(route === "settings"){
    show($("viewSettings"));
  }
}

function setAuthUI(isAuthed){
  $("authStatus").textContent = isAuthed ? "ON" : "OFF";
  $("authPill").textContent = "Auth: " + (isAuthed ? "ON" : "OFF");
  if(isAuthed) $("authPill").style.borderColor = "rgba(22,163,74,.25)";
  else $("authPill").style.borderColor = "rgba(15,23,42,.10)";
}

// ================= Auth =================
$("loginBtn").onclick = async ()=>{
  setMsg($("loginMsg"), "");
  const email = $("loginEmail").value.trim();
  const pass = $("loginPass").value;
  if(!email || !pass){
    setMsg($("loginMsg"), "Email dan password wajib diisi.", "err");
    return;
  }
  try{
    await signInWithEmailAndPassword(auth, email, pass);
    setMsg($("loginMsg"), "Login berhasil ✅", "ok");
  }catch(err){
    setMsg($("loginMsg"), err.message || "Gagal login.", "err");
  }
};

$("resetBtn").onclick = async ()=>{
  setMsg($("loginMsg"), "");
  const email = $("loginEmail").value.trim();
  if(!email){
    setMsg($("loginMsg"), "Isi email dulu untuk reset password.", "err");
    return;
  }
  try{
    await sendPasswordResetEmail(auth, email);
    setMsg($("loginMsg"), "Link reset password sudah dikirim ke email ✅", "ok");
  }catch(err){
    setMsg($("loginMsg"), err.message || "Gagal kirim reset.", "err");
  }
};

$("logoutBtn").onclick = async ()=>{
  await signOut(auth);
};

onAuthStateChanged(auth, async (user)=>{
  if(!user){
    ME = null;
    setAuthUI(false);
    $("uidText").textContent = "-";
    $("emailText").textContent = "-";
    $("roleText").textContent = "-";
    $("meName").textContent = "-";
    $("meRole").textContent = "-";
    hide($("logoutBtn"));
    hide($("settingsNavItem"));
    navigate("login");
    return;
  }

  setAuthUI(true);
  const uid = user.uid;
  const email = user.email || "-";

  // role from RTDB
  const roleSnap = await get(ref(db, `roles/${uid}`));
  const role = roleSnap.exists() ? roleSnap.val() : "user";
  ME = { uid, email, role };

  $("uidText").textContent = uid;
  $("emailText").textContent = email;
  $("roleText").textContent = role;
  $("meName").textContent = role === "admin" ? "Admin STSU" : "User";
  $("meRole").textContent = role;

  show($("logoutBtn"));
  if(role === "admin") show($("settingsNavItem"));
  else hide($("settingsNavItem"));

  // default route
  navigate("dashboard");
});

// ================= Templates =================
async function loadTemplate(kind){
  const snap = await get(ref(db, `templates/${kind}`));
  if(!snap.exists()) throw new Error(`Template ${kind} belum ada di RTDB.`);
  return snap.val();
}

// ================= Create STSU =================
async function initCreate(){
  setMsg($("createMsg"), "");
  $("tglTransaksi").value ||= todayISO();
  $("tglStsu").value ||= ""; // boleh kosong

  const jenis = $("jenisSelect").value;
  currentTemplate = await loadTemplate(jenis);

  // build fresh form doc
  currentDoc = makeNewDoc(jenis, currentTemplate);
  renderSections();

  // show preview no without increment
  await refreshNoPreview(false);

  // render print
  renderPrint();
}

$("jenisSelect").onchange = async ()=>{
  await initCreate();
};

$("refreshNoBtn").onclick = async ()=>{
  await refreshNoPreview(false); // IMPORTANT: do not increment counter
};

$("resetFormBtn").onclick = async ()=>{
  $("tglTransaksi").value = todayISO();
  $("tglStsu").value = "";
  await initCreate();
};

function makeNewDoc(jenis, tpl){
  const sections = (tpl.sections || []).map(s => ({
    id: s.id || crypto.randomUUID(),
    name: s.name || "Section",
    enabled: s.enabled !== false,
    items: Array.isArray(s.items) ? s.items.map(x=>({label:x.label||"", nominal:Number(x.nominal||0)})) : []
  }));

  // let user add new section above E-ticketing later; default as template order
  return {
    ownerUid: ME.uid,
    jenis,
    transaksiDate: $("tglTransaksi").value || todayISO(),
    stsuDate: $("tglStsu").value || "",
    status: "draft",
    stsuNo: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    meta: {
      kepalaSeksi: "NAMA KEPALA SEKSI",
      bendahara: "NAMA BENDAHARA"
    },
    sections
  };
}

function cleanZeroItems(doc){
  const cloned = structuredClone(doc);
  cloned.sections = cloned.sections
    .filter(s => s.enabled !== false)
    .map(s => ({
      ...s,
      items: (s.items || [])
        .map(it => ({ label: (it.label||"").trim(), nominal: Number(it.nominal||0) }))
        .filter(it => it.label && it.nominal > 0) // ✅ ignore 0
    }))
    .filter(s => (s.items||[]).length > 0); // hide empty section
  return cloned;
}

function calcTotals(doc){
  const bySection = {};
  let total = 0;
  for(const s of (doc.sections||[])){
    const sub = (s.items||[]).reduce((a,it)=>a + Number(it.nominal||0), 0);
    bySection[s.id] = sub;
    total += sub;
  }
  return { bySection, total };
}

async function refreshNoPreview(commitIncrement){
  const transaksi = $("tglTransaksi").value;
  const jenis = $("jenisSelect").value;
  if(!transaksi){
    $("noPreview").value = "";
    setMsg($("createMsg"), "Tanggal transaksi wajib diisi.", "err");
    return;
  }

  const yyyy = transaksi.slice(0,4);
  const dd = transaksi.slice(8,10);
  const mm = transaksi.slice(5,7);
  const ymd = yyyymmdd(transaksi);
  const counterPath = `counters/${yyyy}/${jenis}/${ymd}`;

  if(commitIncrement){
    // ✅ increment only on save draft/final
    const counterRef = ref(db, counterPath);
    const tx = await runTransaction(counterRef, (cur)=> (Number(cur||0) + 1));
    const seq = tx.snapshot.val();
    const no = `${seq}/${dd}/${mm}/SU/${yyyy}`;
    $("noPreview").value = no;
    return no;
  }else{
    // preview only: read current and show +1 (no write)
    const snap = await get(ref(db, counterPath));
    const cur = snap.exists() ? Number(snap.val()||0) : 0;
    const no = `${cur+1}/${dd}/${mm}/SU/${yyyy}`;
    $("noPreview").value = no;
    return no;
  }
}

function renderSections(){
  const wrap = $("sectionsWrap");
  wrap.innerHTML = "";

  currentDoc.transaksiDate = $("tglTransaksi").value || currentDoc.transaksiDate;
  currentDoc.stsuDate = $("tglStsu").value || currentDoc.stsuDate;

  currentDoc.sections.forEach((sec, idx)=>{
    const card = document.createElement("div");
    card.className = "sectionCard";

    const head = document.createElement("div");
    head.className = "sectionHead";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="sectionTitle">${escapeHtml(sec.name)}</div>
      <div class="muted small">${sec.enabled ? "Aktif" : "Nonaktif"} • Item nominal 0 diabaikan</div>
    `;

    const tools = document.createElement("div");
    tools.className = "sectionTools";
    tools.innerHTML = `
      <label class="toggle">
        <input type="checkbox" ${sec.enabled ? "checked":""} data-act="toggle" data-idx="${idx}">
        Aktif
      </label>
      <button class="miniBtn" data-act="rename" data-idx="${idx}">Ubah nama</button>
      <button class="miniBtn" data-act="addRow" data-idx="${idx}">+ Baris</button>
      <button class="miniBtn danger" data-act="delSection" data-idx="${idx}">Hapus</button>
    `;

    head.appendChild(left);
    head.appendChild(tools);

    // table
    const table = document.createElement("table");
    table.className = "itemsTable";
    const tbody = document.createElement("tbody");

    (sec.items||[]).forEach((it, rowIdx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <input data-idx="${idx}" data-row="${rowIdx}" data-field="label" value="${escapeAttr(it.label||"")}" placeholder="Kategori..." />
        </td>
        <td style="text-align:right">
          <input data-idx="${idx}" data-row="${rowIdx}" data-field="nominal" inputmode="numeric" value="${it.nominal ? formatPlain(it.nominal) : ""}" placeholder="0" />
        </td>
        <td style="width:86px; text-align:right">
          <button class="miniBtn danger" data-act="delRow" data-idx="${idx}" data-row="${rowIdx}">Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // subtotal preview (on screen)
    const cleaned = cleanZeroItems(currentDoc);
    const totals = calcTotals(cleaned);
    const sub = totals.bySection[sec.id] || 0;

    const subtotal = document.createElement("div");
    subtotal.className = "subtotalRow";
    subtotal.innerHTML = `
      <div class="subLabel">Subtotal ${escapeHtml(sec.name)}</div>
      <div class="subAmount">${formatIDR(sub)}</div>
    `;

    card.appendChild(head);
    card.appendChild(table);
    card.appendChild(subtotal);
    wrap.appendChild(card);
  });
}

$("sectionsWrap").addEventListener("input", (e)=>{
  const inp = e.target.closest("input");
  if(!inp) return;
  const si = Number(inp.getAttribute("data-idx"));
  const ri = Number(inp.getAttribute("data-row"));
  const field = inp.getAttribute("data-field");
  if(Number.isNaN(si) || Number.isNaN(ri)) return;

  const sec = currentDoc.sections[si];
  if(!sec || !sec.items[ri]) return;

  if(field === "label"){
    sec.items[ri].label = inp.value;
  }else if(field === "nominal"){
    sec.items[ri].nominal = parseIDR(inp.value);
  }

  // re-render print + subtotals live
  renderSections();
  renderPrint();
});

$("sectionsWrap").addEventListener("blur", (e)=>{
  const inp = e.target.closest("input[data-field='nominal']");
  if(!inp) return;
  inp.value = inp.value ? formatPlain(parseIDR(inp.value)) : "";
}, true);

$("sectionsWrap").addEventListener("click", (e)=>{
  const btn = e.target.closest("[data-act]");
  if(!btn) return;

  const act = btn.getAttribute("data-act");
  const si = Number(btn.getAttribute("data-idx"));
  const ri = btn.getAttribute("data-row") != null ? Number(btn.getAttribute("data-row")) : null;

  if(act === "toggle"){
    const cb = btn;
    currentDoc.sections[si].enabled = cb.checked;
  }
  if(act === "rename"){
    const nm = prompt("Nama section:", currentDoc.sections[si].name);
    if(nm != null && nm.trim()) currentDoc.sections[si].name = nm.trim();
  }
  if(act === "addRow"){
    currentDoc.sections[si].items.push({ label:"", nominal:0 });
  }
  if(act === "delRow"){
    currentDoc.sections[si].items.splice(ri,1);
  }
  if(act === "delSection"){
    if(confirm("Hapus section ini?")){
      currentDoc.sections.splice(si,1);
    }
  }

  renderSections();
  renderPrint();
});

$("addSectionBtn").onclick = ()=>{
  const nm = prompt("Nama section baru:", "Section Baru");
  if(!nm || !nm.trim()) return;

  // insert above E-ticketing if exists
  const idxET = currentDoc.sections.findIndex(s => (s.id||"").includes("e_ticketing") || s.name.toLowerCase().includes("e-ticket"));
  const newSec = { id: crypto.randomUUID(), name: nm.trim(), enabled:true, items: [] };
  if(idxET >= 0) currentDoc.sections.splice(idxET, 0, newSec);
  else currentDoc.sections.unshift(newSec);

  renderSections();
  renderPrint();
};

// ================= Save Draft / Final =================
async function saveDoc(status){
  setMsg($("createMsg"), "");
  const transaksi = $("tglTransaksi").value;
  if(!transaksi){
    setMsg($("createMsg"), "Tanggal transaksi wajib diisi.", "err");
    return;
  }

  // increment counter ONLY here
  const stsuNo = await refreshNoPreview(true);

  // build clean doc
  currentDoc.jenis = $("jenisSelect").value;
  currentDoc.transaksiDate = transaksi;
  currentDoc.stsuDate = $("tglStsu").value || "";
  currentDoc.status = status;
  currentDoc.stsuNo = stsuNo;
  currentDoc.ownerUid = ME.uid;
  currentDoc.updatedAt = Date.now();
  if(!currentDoc.createdAt) currentDoc.createdAt = Date.now();

  const cleaned = cleanZeroItems(currentDoc);
  const totals = calcTotals(cleaned);
  cleaned.total = totals.total;

  if(totals.total <= 0){
    setMsg($("createMsg"), "Total masih 0. Isi minimal 1 nominal > 0.", "err");
    return;
  }

  // write to stsu/{uid}/{pushId}
  const baseRef = ref(db, `stsu/${ME.uid}`);
  const newRef = push(baseRef);
  cleaned.id = newRef.key;

  await set(newRef, cleaned);

  // index for dashboard
  const idxRef = ref(db, `stsu_index/${ME.uid}/${cleaned.id}`);
  await set(idxRef, {
    id: cleaned.id,
    uid: ME.uid,
    createdAt: cleaned.createdAt,
    updatedAt: cleaned.updatedAt,
    transaksiDate: cleaned.transaksiDate,
    stsuDate: cleaned.stsuDate || "",
    jenis: cleaned.jenis,
    status: cleaned.status,
    stsuNo: cleaned.stsuNo,
    total: cleaned.total
  });

  setMsg($("createMsg"), `Tersimpan (${status.toUpperCase()}) ✅ Nomor: ${stsuNo}`, "ok");
  $("statusBadge").textContent = status.toUpperCase();

  // refresh dashboard cache
  // keep form (optional). You can reset if you want.
}

$("saveDraftBtn").onclick = ()=> saveDoc("draft").catch(err=>{
  console.error(err);
  setMsg($("createMsg"), err.message || "Gagal simpan draft.", "err");
});

$("saveFinalBtn").onclick = ()=> saveDoc("final").catch(err=>{
  console.error(err);
  setMsg($("createMsg"), err.message || "Gagal simpan final.", "err");
});

// ================= Print =================
$("printBtn").onclick = ()=>{
  // ensure print area updated & clean items only
  renderPrint();
  window.print();
};

// ================= Print Render (A4 clean) =================
function renderPrint(){
  const paper = $("printArea");
  const doc = cleanZeroItems(currentDoc);
  const totals = calcTotals(doc);

  const title = (currentTemplate?.title || "SURAT TANDA SETOR UANG");
  const no = $("noPreview").value || "";

  const jenis = $("jenisSelect").value;
  const tglTrans = doc.transaksiDate;
  const tglStsu = doc.stsuDate;

  // closing text only for retribusi & template.closingEnabled
  const closingEnabled = (jenis === "retribusi") && (currentTemplate?.closingEnabled !== false);

  const terbilang = toTerbilangID(totals.total);

  paper.innerHTML = `
    <div class="printHeader" style="text-align:center; margin-bottom:14px">
      <div style="font-weight:900; letter-spacing:.4px">${escapeHtml(title)}</div>
      <div style="margin-top:4px; font-size:12px">No: ${escapeHtml(no)}</div>
    </div>

    <div class="printBody">
      ${doc.sections.map(sec => renderSectionPrint(sec, totals.bySection[sec.id] || 0)).join("")}

      <div style="border-top:2px solid #111827; margin:12px 0 8px"></div>

      <div style="display:grid; grid-template-columns:1fr auto; gap:12px; font-weight:900">
        <div>JUMLAH TOTAL</div>
        <div>${formatIDR(totals.total)}</div>
      </div>

      <div style="margin-top:6px; font-size:12px">
        <b>Terbilang :</b> ${escapeHtml(terbilang)}
      </div>

      ${
        closingEnabled ? `
        <div style="margin-top:10px; font-size:12px; line-height:1.45">
          Disetor uang kebendahara penerimaan hasil retribusi layanan masuk tempat rekreasi dan pemakaian fasilitas TMR
          pada hari <b>${escapeHtml(dayNameID(tglTrans))}</b> tanggal <b>${escapeHtml(toIDDate(tglTrans))}</b>
          dengan STSU No. <b>${escapeHtml(no)}</b> dengan uang sebesar <b>${formatIDR(totals.total)}</b>
        </div>
        ` : ``
      }

      <div style="margin-top:16px; display:flex; justify-content:flex-end; font-size:12px">
        <div style="text-align:right">
          Jakarta, ${tglStsu ? escapeHtml(toIDDate(tglStsu)) : ".............."}
        </div>
      </div>

      <div style="margin-top:18px; display:grid; grid-template-columns:1fr 1fr; gap:40px; font-size:12px">
        <div style="text-align:left">
          Kepala Seksi Pelayanan & Informasi
          <div style="height:44px"></div>
          <div style="font-weight:900; text-decoration:underline">${escapeHtml(doc.meta.kepalaSeksi || "NAMA KEPALA SEKSI")}</div>
        </div>
        <div style="text-align:right">
          Bendahara Penerimaan
          <div style="height:44px"></div>
          <div style="font-weight:900; text-decoration:underline">${escapeHtml(doc.meta.bendahara || "NAMA BENDAHARA")}</div>
        </div>
      </div>
    </div>
  `;
}

function renderSectionPrint(sec, subtotal){
  const rows = (sec.items||[])
    .filter(it => it.label && Number(it.nominal||0) > 0)
    .map(it => `
      <div style="display:grid; grid-template-columns:1fr auto; gap:12px; padding:4px 0; border-bottom:1px solid rgba(15,23,42,.10)">
        <div>${escapeHtml(it.label)}</div>
        <div style="text-align:right">${formatIDR(it.nominal)}</div>
      </div>
    `).join("");

  if(!rows) return "";

  // ✅ subtotal label “nempel” ke nilai (leader line)
  return `
    <div style="margin-top:10px">
      <div style="font-weight:900; margin-bottom:6px">${escapeHtml(sec.name)}</div>
      ${rows}
      <div style="display:grid; grid-template-columns:1fr auto; gap:12px; padding-top:8px; font-weight:900">
        <div style="display:flex; gap:8px; align-items:center">
          <span>Subtotal ${escapeHtml(sec.name)}</span>
          <span style="flex:1; border-bottom:2px dashed rgba(15,23,42,.25); transform:translateY(2px)"></span>
        </div>
        <div style="text-align:right; min-width:170px">${formatIDR(subtotal)}</div>
      </div>
    </div>
  `;
}

// ================= Dashboard =================
$("loadDashboardBtn").onclick = ()=> loadDashboard().catch(console.error);
$("clearSearchBtn").onclick = ()=>{
  $("searchDate").value = "";
  loadDashboard().catch(console.error);
};

async function loadDashboard(){
  if(!ME) return;

  // default month to current
  if(!$("filterMonth").value){
    const now = new Date();
    const mm = String(now.getMonth()+1).padStart(2,"0");
    $("filterMonth").value = `${now.getFullYear()}-${mm}`;
  }

  const jenis = $("filterJenis").value;
  const m = $("filterMonth").value; // yyyy-mm
  const searchDate = $("searchDate").value; // yyyy-mm-dd (optional)

  // get last 10 (simple, reliable)
  const idxQ = query(ref(db, `stsu_index/${ME.uid}`), orderByChild("createdAt"), limitToLast(10));
  const snap = await get(idxQ);

  let items = [];
  if(snap.exists()){
    const obj = snap.val();
    items = Object.values(obj);
    // newest first
    items.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  }

  // filter local for jenis/month/search
  items = items.filter(x => x.jenis === jenis);
  if(searchDate){
    items = items.filter(x => x.transaksiDate === searchDate);
  }else{
    items = items.filter(x => monthKey(x.transaksiDate) === m);
  }

  renderStsuList(items);
  renderChart(items, m, jenis);
}

function renderStsuList(items){
  const list = $("stsuList");
  list.innerHTML = "";

  if(items.length === 0){
    $("dashInfo").textContent = "Belum ada data untuk filter ini.";
    return;
  }

  const total = items.reduce((a,x)=>a+Number(x.total||0),0);
  $("dashInfo").textContent = `Total: ${formatIDR(total)} • Menampilkan ${items.length} data`;

  for(const it of items){
    const el = document.createElement("div");
    el.className = "itemCard";
    el.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemNo">${escapeHtml(it.stsuNo || "-")}</div>
          <div class="itemMeta">
            ${escapeHtml(it.status || "-").toUpperCase()} •
            Transaksi: ${escapeHtml(toIDDate(it.transaksiDate))} •
            Total: <b>${formatIDR(it.total)}</b>
          </div>
        </div>
        <div class="itemMeta">${escapeHtml(it.jenis)}</div>
      </div>

      <div class="itemActions">
        <button class="miniBtn ok" data-act="open" data-id="${it.id}">Buka</button>
        <button class="miniBtn" data-act="duplicate" data-id="${it.id}">Duplikat</button>
        <button class="miniBtn danger" data-act="delete" data-id="${it.id}">Hapus</button>
      </div>
    `;
    list.appendChild(el);
  }
}

$("stsuList").addEventListener("click", async (e)=>{
  const btn = e.target.closest("[data-act]");
  if(!btn) return;
  const act = btn.getAttribute("data-act");
  const id = btn.getAttribute("data-id");

  if(act === "open"){
    await openStsu(id);
  }
  if(act === "duplicate"){
    await duplicateStsu(id);
  }
  if(act === "delete"){
    if(!confirm("Hapus STSU ini?")) return;
    await deleteStsu(id);
    await loadDashboard();
  }
});

async function openStsu(id){
  const snap = await get(ref(db, `stsu/${ME.uid}/${id}`));
  if(!snap.exists()){
    alert("Data tidak ditemukan.");
    return;
  }
  const doc = snap.val();
  // load into create view
  $("jenisSelect").value = doc.jenis || "retribusi";
  currentTemplate = await loadTemplate($("jenisSelect").value);

  currentDoc = doc;
  $("tglTransaksi").value = doc.transaksiDate || todayISO();
  $("tglStsu").value = doc.stsuDate || "";
  $("noPreview").value = doc.stsuNo || "";

  renderSections();
  renderPrint();
  $("statusBadge").textContent = (doc.status || "draft").toUpperCase();

  navigate("create");
}

async function duplicateStsu(id){
  const snap = await get(ref(db, `stsu/${ME.uid}/${id}`));
  if(!snap.exists()) return alert("Data tidak ditemukan.");

  const doc = snap.val();
  doc.id = null;
  doc.stsuNo = "";
  doc.status = "draft";
  doc.createdAt = Date.now();
  doc.updatedAt = Date.now();

  // load to create view (user will save draft to get new number)
  $("jenisSelect").value = doc.jenis || "retribusi";
  currentTemplate = await loadTemplate($("jenisSelect").value);

  currentDoc = doc;
  $("tglTransaksi").value = doc.transaksiDate || todayISO();
  $("tglStsu").value = "";
  await refreshNoPreview(false);

  renderSections();
  renderPrint();
  $("statusBadge").textContent = "DRAFT";

  navigate("create");
}

async function deleteStsu(id){
  // remove main doc and index
  await remove(ref(db, `stsu/${ME.uid}/${id}`));
  await remove(ref(db, `stsu_index/${ME.uid}/${id}`));
}

// ================= Chart =================
function renderChart(items, month, jenis){
  const ctx = $("chartCanvas");
  if(chart){ chart.destroy(); chart = null; }

  // group by transaksiDate
  const map = new Map();
  for(const it of items){
    const d = it.transaksiDate;
    map.set(d, (map.get(d)||0) + Number(it.total||0));
  }

  // labels sorted
  const labels = Array.from(map.keys()).sort();
  const data = labels.map(k => map.get(k));

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.map(toIDDate),
      datasets: [{ label: `Pendapatan (${jenis})`, data }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          ticks: {
            callback: (v)=> Number(v).toLocaleString("id-ID")
          }
        }
      }
    }
  });
}

// ================= Settings (Admin template JSON editor) =================
$("loadTplBtn").onclick = async ()=>{
  try{
    const key = $("tplSelect").value;
    const tpl = await loadTemplate(key);
    $("tplJson").value = JSON.stringify(tpl, null, 2);
    setMsg($("settingsMsg"), "Template dimuat ✅", "ok");
  }catch(err){
    setMsg($("settingsMsg"), err.message || "Gagal muat template.", "err");
  }
};

$("saveTplBtn").onclick = async ()=>{
  try{
    if(!ME || ME.role !== "admin"){
      setMsg($("settingsMsg"), "Khusus admin.", "err");
      return;
    }
    const key = $("tplSelect").value;
    const obj = JSON.parse($("tplJson").value || "{}");
    await set(ref(db, `templates/${key}`), obj);
    setMsg($("settingsMsg"), "Template tersimpan ✅", "ok");
  }catch(err){
    setMsg($("settingsMsg"), err.message || "Gagal simpan template.", "err");
  }
};

// ================= Utilities =================
function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeAttr(s){ return escapeHtml(s); }

function formatPlain(n){
  return Number(n||0).toLocaleString("id-ID");
}

// Terbilang ID (simple, cukup buat STSU)
function toTerbilangID(n){
  n = Math.floor(Number(n||0));
  if(n === 0) return "nol rupiah";

  const satuan = ["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];
  function terbilang(x){
    x = Math.floor(x);
    if(x < 12) return satuan[x];
    if(x < 20) return terbilang(x-10) + " belas";
    if(x < 100) return terbilang(Math.floor(x/10)) + " puluh" + (x%10 ? " " + terbilang(x%10) : "");
    if(x < 200) return "seratus" + (x-100 ? " " + terbilang(x-100) : "");
    if(x < 1000) return terbilang(Math.floor(x/100)) + " ratus" + (x%100 ? " " + terbilang(x%100) : "");
    if(x < 2000) return "seribu" + (x-1000 ? " " + terbilang(x-1000) : "");
    if(x < 1000000) return terbilang(Math.floor(x/1000)) + " ribu" + (x%1000 ? " " + terbilang(x%1000) : "");
    if(x < 1000000000) return terbilang(Math.floor(x/1000000)) + " juta" + (x%1000000 ? " " + terbilang(x%1000000) : "");
    if(x < 1000000000000) return terbilang(Math.floor(x/1000000000)) + " miliar" + (x%1000000000 ? " " + terbilang(x%1000000000) : "");
    return terbilang(Math.floor(x/1000000000000)) + " triliun" + (x%1000000000000 ? " " + terbilang(x%1000000000000) : "");
  }
  return (terbilang(n) + " rupiah").replace(/\s+/g," ").trim();
}

// ================= Default inputs =================
$("filterJenis").value = "lainnya";
$("filterMonth").value = "";
$("tglTransaksi").value = todayISO();
