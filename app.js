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
  remove,
  push,
  query,
  orderByChild,
  limitToLast,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

/* ================== CONFIG ================== */
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

/* ================== DOM ================== */
const $ = (id) => document.getElementById(id);

// Login
const loginCard = $("loginCard");
const emailEl = $("email");
const passEl = $("password");
const loginBtn = $("loginBtn");
const resetBtn = $("resetBtn");
const loginMsg = $("loginMsg");
const loginBadge = $("loginBadge");

// Drawer
const drawer = $("drawer");
const drawerBackdrop = $("drawerBackdrop");
const menuBtn = $("menuBtn");
const drawerClose = $("drawerClose");
const logoutBtn = $("logoutBtn");
const userInfo = $("userInfo");

// Nav cards
const dashboardCard = $("dashboardCard");
const buatCard = $("buatCard");

// Pills
const authPill = $("authPill");

// Dashboard
const searchDate = $("searchDate");
const searchBtn = $("searchBtn");
const last10Btn = $("last10Btn");
const stsuList = $("stsuList");
const dashMsg = $("dashMsg");
const sumCount = $("sumCount");
const sumTotal = $("sumTotal");

// Buat STSU
const txDate = $("txDate");
const singleNominal = $("singleNominal");
const stsuNoEl = $("stsuNo");
const newDraftBtn = $("newDraftBtn");
const saveDraftBtn = $("saveDraftBtn");
const saveFinalBtn = $("saveFinalBtn");
const printBtn = $("printBtn");
const buatMsg = $("buatMsg");
const buatBadge = $("buatBadge");

// Input sections (contoh)
const inputFasilitas = $("inputFasilitas");
const inputEticket = $("inputEticket");
const addFasilitas = $("addFasilitas");
const addEticket = $("addEticket");

// Doc sections
const docNo = $("docNo");
const secFasilitas = $("secFasilitas");
const secEticket = $("secEticket");
const subFasilitas = $("subFasilitas");
const subEticket = $("subEticket");
const grandTotal = $("grandTotal");
const terbilangEl = $("terbilang");
const docPara = $("docPara");
const signDate = $("signDate");

/* ================== STATE ================== */
let currentUser = null;
let currentRole = "user";

// Draft session (ini kunci supaya tidak “push berulang”)
let currentDraftId = null;      // key stsu (tetap)
let currentDraftStatus = "DRAFT"; // DRAFT/FINAL
let currentStsuNo = "";         // akan muncul setelah simpan

/* ================== UTIL ================== */
const nf = new Intl.NumberFormat("id-ID");
const rupiah = (n) => "Rp " + nf.format(Number(n || 0));

function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
function toDDMMYYYY(iso){
  // iso: YYYY-MM-DD
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function onlyDigits(str){ return (str||"").replace(/[^\d]/g,""); }

function formatInputRupiah(el){
  const raw = onlyDigits(el.value);
  if(!raw){ el.value = ""; return 0; }
  const num = Number(raw);
  el.value = nf.format(num);
  return num;
}

// Terbilang simpel (cukup untuk preview — kalau mau versi lengkap kita rapihin berikutnya)
function terbilangID(n){
  n = Number(n||0);
  if(n === 0) return "nol rupiah";
  // biar cepat & aman, kita tampilkan angka + rupiah dulu (bisa upgrade nanti)
  return `${nf.format(n)} rupiah`;
}

function openDrawer(){
  drawer.classList.add("open");
  drawerBackdrop.classList.add("open");
}
function closeDrawer(){
  drawer.classList.remove("open");
  drawerBackdrop.classList.remove("open");
}
function showCard(which){
  // which: 'dashboard'|'buat'
  dashboardCard.style.display = (which === "dashboard") ? "block" : "none";
  buatCard.style.display = (which === "buat") ? "block" : "none";
  closeDrawer();
}

/* ================== DB PATHS ================== */
function pRole(uid){ return `roles/${uid}`; }
function pStsu(uid, id){ return `stsu/${uid}/${id}`; }
function pIndex(uid, id){ return `stsu_index/${uid}/${id}`; }
function pCounter(uid, dateKey){ return `counters/${uid}/${dateKey}`; }

/* ================== AUTH ================== */
async function fetchRole(uid){
  const snap = await get(ref(db, pRole(uid)));
  const val = snap.exists() ? snap.val() : "user";
  return val || "user";
}

function setAuthUI(isOn){
  authPill.textContent = `Auth: ${isOn ? "ON" : "OFF"}`;
  loginBadge.textContent = isOn ? "Login ✅" : "Login ❌";
  loginBadge.className = isOn ? "badge ok" : "badge";
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  if(!user){
    setAuthUI(false);
    userInfo.textContent = "Belum login";
    loginCard.style.display = "block";
    dashboardCard.style.display = "none";
    buatCard.style.display = "none";
    closeDrawer();
    return;
  }

  // logged in
  setAuthUI(true);
  loginCard.style.display = "none";
  dashboardCard.style.display = "block";
  buatCard.style.display = "block";

  currentRole = await fetchRole(user.uid);
  userInfo.textContent = `${user.email} · role: ${currentRole}`;

  // init defaults
  if(!txDate.value) txDate.value = todayISO();
  if(!searchDate.value) searchDate.value = todayISO();

  // start draft session
  newDraftSession();

  // load last 10
  await loadLast10();
  showCard("dashboard");
});

loginBtn.addEventListener("click", async () => {
  loginMsg.textContent = "";
  try{
    const email = emailEl.value.trim();
    const pass = passEl.value;
    await signInWithEmailAndPassword(auth, email, pass); // 1
    loginMsg.textContent = "Login berhasil ✅";
  }catch(e){
    loginMsg.textContent = `Login gagal: ${e.message}`;
  }
});

resetBtn.addEventListener("click", async () => {
  loginMsg.textContent = "";
  try{
    const email = emailEl.value.trim();
    if(!email) return (loginMsg.textContent = "Isi email dulu.");
    await sendPasswordResetEmail(auth, email);
    loginMsg.textContent = "Link reset password terkirim (cek email).";
  }catch(e){
    loginMsg.textContent = `Gagal reset: ${e.message}`;
  }
});

logoutBtn.addEventListener("click", async ()=>{ await signOut(auth); });

/* ================== DRAWER NAV ================== */
menuBtn.addEventListener("click", openDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);
drawerClose.addEventListener("click", closeDrawer);
drawer.querySelectorAll("[data-nav]").forEach(btn=>{
  btn.addEventListener("click", ()=> showCard(btn.getAttribute("data-nav")));
});

/* ================== INPUT TEMPLATE DEFAULT ================== */
const DEFAULT_FASILITAS = ["Panggung", "Lahan terbuka"];
const DEFAULT_ETICKET = ["Dewasa", "Anak"];

function makeRow(label="", nominal=0){
  const wrap = document.createElement("div");
  wrap.className = "rowline";
  wrap.innerHTML = `
    <input class="lbl" type="text" placeholder="Kategori..." value="${label}"/>
    <input class="nom" type="text" inputmode="numeric" placeholder="0" value="${nominal?nf.format(nominal):""}"/>
    <button class="btn small del" type="button">Hapus</button>
  `;
  const nomEl = wrap.querySelector(".nom");
  nomEl.addEventListener("input", () => {
    // jangan re-render page (biar keyboard tidak “hilang”)
    formatInputRupiah(nomEl);
    renderDocFromInputs();
  });
  wrap.querySelector(".lbl").addEventListener("input", () => {
    renderDocFromInputs();
  });
  wrap.querySelector(".del").addEventListener("click", () => {
    wrap.remove();
    renderDocFromInputs();
  });
  return wrap;
}

function initInputs(){
  inputFasilitas.innerHTML = "";
  inputEticket.innerHTML = "";

  DEFAULT_FASILITAS.forEach(k=> inputFasilitas.appendChild(makeRow(k, 0)));
  DEFAULT_ETICKET.forEach(k=> inputEticket.appendChild(makeRow(k, 0)));

  renderDocFromInputs();
}

addFasilitas.addEventListener("click", ()=> { inputFasilitas.appendChild(makeRow("",0)); });
addEticket.addEventListener("click", ()=> { inputEticket.appendChild(makeRow("",0)); });

singleNominal.addEventListener("input", ()=> formatInputRupiah(singleNominal));

/* ================== DOC RENDER ================== */
function getRowsFrom(container){
  const rows = [];
  container.querySelectorAll(".rowline").forEach(r=>{
    const label = r.querySelector(".lbl").value.trim();
    const num = Number(onlyDigits(r.querySelector(".nom").value||"0")) || 0;
    if(!label) return;
    if(num <= 0) return; // IGNORE 0 (tidak disimpan, tidak dicetak)
    rows.push({ label, amount: num });
  });
  return rows;
}

function renderSection(targetEl, rows){
  targetEl.innerHTML = "";
  rows.forEach(x=>{
    const div = document.createElement("div");
    div.className = "sec-row";
    div.innerHTML = `<span>${x.label}</span><span>${rupiah(x.amount)}</span>`;
    targetEl.appendChild(div);
  });
}

function sumRows(rows){ return rows.reduce((a,b)=>a+Number(b.amount||0),0); }

function renderDocFromInputs(){
  const dIso = txDate.value || todayISO();
  const dPretty = toDDMMYYYY(dIso);

  // nomor dokumen
  docNo.textContent = currentStsuNo ? currentStsuNo : "-";
  $("docNo").textContent = currentStsuNo ? currentStsuNo : "-";

  const fas = getRowsFrom(inputFasilitas);
  const eti = getRowsFrom(inputEticket);

  renderSection(secFasilitas, fas);
  renderSection(secEticket, eti);

  const subF = sumRows(fas);
  const subE = sumRows(eti);
  const total = subF + subE;

  subFasilitas.textContent = rupiah(subF);
  subEticket.textContent = rupiah(subE);
  grandTotal.textContent = rupiah(total);
  terbilangEl.textContent = terbilangID(total);

  signDate.textContent = "............";
  docPara.textContent =
    `Disetor uang kebendahara penerimaan hasil retribusi layanan masuk tempat rekreasi dan pemakaian fasilitas TMR pada hari ${dPretty} dengan STSU No. ${currentStsuNo || "-"} dengan uang sebesar ${rupiah(total)}.`;
}

/* ================== DRAFT SESSION ================== */
function newDraftSession(){
  currentDraftId = null;
  currentDraftStatus = "DRAFT";
  currentStsuNo = "";
  stsuNoEl.value = "";
  buatBadge.textContent = "DRAFT";
  buatBadge.className = "badge";

  initInputs();
  renderDocFromInputs();
  buatMsg.textContent = "Draft baru siap. Nomor STSU keluar setelah simpan.";
}

newDraftBtn.addEventListener("click", ()=>{
  newDraftSession();
});

/* ================== COUNTER: nomor naik hanya saat simpan ================== */
async function reserveStsuNo(uid, isoDate){
  // Format nomor: {urut}/{dd}/{mm}/SU/{yyyy}
  // counter per tanggal (YYYY-MM-DD)
  const dateKey = isoDate; // aman & mudah
  const counterRef = ref(db, pCounter(uid, dateKey));

  const result = await runTransaction(counterRef, (cur) => {
    if(cur === null) return 1;
    return Number(cur) + 1;
  });

  const n = Number(result.snapshot.val() || 1);
  const [y,m,d] = isoDate.split("-");
  return `${n}/${d}/${m}/SU/${y}`;
}

/* ================== SAVE / UPDATE ================== */
let saving = false;

async function saveStsu(status){
  if(!currentUser) return;
  if(saving) return;
  saving = true;
  saveDraftBtn.disabled = true;
  saveFinalBtn.disabled = true;

  try{
    const uid = currentUser.uid;
    const iso = txDate.value || todayISO();

    // Ambil data (IGNORED nominal 0)
    const fas = getRowsFrom(inputFasilitas);
    const eti = getRowsFrom(inputEticket);

    const subF = sumRows(fas);
    const subE = sumRows(eti);
    const total = subF + subE;

    if(total <= 0){
      buatMsg.textContent = "Tidak ada nominal > 0. Tidak disimpan.";
      return;
    }

    // jika belum punya ID, buat sekali (supaya tidak push berulang)
    if(!currentDraftId){
      currentDraftId = push(ref(db, `stsu/${uid}`)).key;
    }

    // nomor hanya “reserve” saat pertama kali simpan (draft/final)
    if(!currentStsuNo){
      currentStsuNo = await reserveStsuNo(uid, iso);
      stsuNoEl.value = currentStsuNo;
    }

    const now = Date.now();
    const payload = {
      id: currentDraftId,
      uid,
      status,                 // DRAFT / FINAL
      stsuNo: currentStsuNo,
      date: iso,              // YYYY-MM-DD
      datePretty: toDDMMYYYY(iso),
      sections: {
        fasilitas: fas,
        eticket: eti
      },
      subtotal: { fasilitas: subF, eticket: subE },
      total,
      createdAt: now,
      updatedAt: now
    };

    // Upsert (set untuk data utama)
    await set(ref(db, pStsu(uid, currentDraftId)), payload);

    // Index untuk dashboard (ringkas)
    await set(ref(db, pIndex(uid, currentDraftId)), {
      id: currentDraftId,
      uid,
      status,
      stsuNo: currentStsuNo,
      date: iso,
      total,
      updatedAt: now
    });

    currentDraftStatus = status;
    buatBadge.textContent = status;
    buatBadge.className = (status === "FINAL") ? "badge ok" : "badge";
    renderDocFromInputs();

    buatMsg.textContent = `Tersimpan ${status} ✅`;
    await loadLast10();

  }catch(e){
    buatMsg.textContent = `Gagal simpan: ${e.message}`;
  }finally{
    saving = false;
    saveDraftBtn.disabled = false;
    saveFinalBtn.disabled = false;
  }
}

saveDraftBtn.addEventListener("click", ()=> saveStsu("DRAFT"));
saveFinalBtn.addEventListener("click", ()=> saveStsu("FINAL"));

/* ================== DASHBOARD LOAD ================== */
async function loadLast10(){
  if(!currentUser) return;
  const uid = currentUser.uid;

  dashMsg.textContent = "Memuat...";
  stsuList.innerHTML = "";

  const q = query(ref(db, `stsu_index/${uid}`), orderByChild("updatedAt"), limitToLast(10));
  const snap = await get(q);

  const arr = [];
  if(snap.exists()){
    snap.forEach(ch => arr.push(ch.val()));
  }
  arr.sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));

  renderList(arr);
  dashMsg.textContent = arr.length ? "" : "Belum ada data.";
}

async function loadByDate(iso){
  if(!currentUser) return;
  const uid = currentUser.uid;
  dashMsg.textContent = "Mencari...";
  stsuList.innerHTML = "";

  // RTDB query by child date but perlu index rules di server.
  // Untuk aman & sederhana, kita ambil index lalu filter client (data per user biasanya kecil).
  const snap = await get(ref(db, `stsu_index/${uid}`));
  const arr = [];
  if(snap.exists()){
    snap.forEach(ch => arr.push(ch.val()));
  }
  const filtered = arr
    .filter(x => x.date === iso)
    .sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0))
    .slice(0, 50);

  renderList(filtered);
  dashMsg.textContent = filtered.length ? "" : "Tidak ada data di tanggal itu.";
}

function renderList(arr){
  // summary
  sumCount.textContent = String(arr.length || 0);
  const total = arr.reduce((a,b)=>a+Number(b.total||0),0);
  sumTotal.textContent = rupiah(total);

  stsuList.innerHTML = "";
  arr.forEach(x=>{
    const div = document.createElement("div");
    div.className = "item";
    const tagClass = (x.status === "FINAL") ? "tag final" : "tag draft";
    div.innerHTML = `
      <div class="left">
        <div style="font-weight:900">${x.stsuNo || "-"}</div>
        <div class="meta">${x.date || ""} · ${rupiah(x.total || 0)} · <span class="${tagClass}">${x.status || ""}</span></div>
      </div>
      <div class="row" style="margin:0">
        <button class="btn small" data-act="edit" data-id="${x.id}">Edit</button>
        <button class="btn small danger" data-act="del" data-id="${x.id}">Hapus</button>
        <button class="btn small" data-act="print" data-id="${x.id}">Print</button>
      </div>
    `;
    stsuList.appendChild(div);
  });
}

last10Btn.addEventListener("click", loadLast10);
searchBtn.addEventListener("click", ()=> {
  const iso = searchDate.value;
  if(!iso) return (dashMsg.textContent = "Pilih tanggal dulu.");
  loadByDate(iso);
});

/* ================== EDIT / DELETE / PRINT from dashboard ================== */
stsuList.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const act = btn.dataset.act;
  const id = btn.dataset.id;
  if(!act || !id) return;

  if(act === "del"){
    if(!confirm("Hapus STSU ini?")) return;
    await deleteStsu(id);
    await loadLast10();
    return;
  }

  if(act === "edit"){
    await loadStsuToForm(id);
    showCard("buat");
    return;
  }

  if(act === "print"){
    await printFromDb(id);
    return;
  }
});

async function deleteStsu(id){
  if(!currentUser) return;
  const uid = currentUser.uid;
  await remove(ref(db, pStsu(uid, id)));
  await remove(ref(db, pIndex(uid, id)));
}

async function loadStsuToForm(id){
  if(!currentUser) return;
  const uid = currentUser.uid;
  const snap = await get(ref(db, pStsu(uid, id)));
  if(!snap.exists()){
    buatMsg.textContent = "Data tidak ditemukan.";
    return;
  }
  const data = snap.val();

  // set session
  currentDraftId = data.id;
  currentDraftStatus = data.status || "DRAFT";
  currentStsuNo = data.stsuNo || "";
  stsuNoEl.value = currentStsuNo;
  txDate.value = data.date || todayISO();

  buatBadge.textContent = currentDraftStatus;
  buatBadge.className = (currentDraftStatus === "FINAL") ? "badge ok" : "badge";

  // load inputs
  inputFasilitas.innerHTML = "";
  inputEticket.innerHTML = "";
  (data.sections?.fasilitas || []).forEach(r => inputFasilitas.appendChild(makeRow(r.label, r.amount)));
  (data.sections?.eticket || []).forEach(r => inputEticket.appendChild(makeRow(r.label, r.amount)));

  // kalau kosong, tetap sediakan default
  if(!inputFasilitas.children.length) DEFAULT_FASILITAS.forEach(k=> inputFasilitas.appendChild(makeRow(k, 0)));
  if(!inputEticket.children.length) DEFAULT_ETICKET.forEach(k=> inputEticket.appendChild(makeRow(k, 0)));

  renderDocFromInputs();
  buatMsg.textContent = "Mode edit aktif. Simpan Draft/Final akan update data ini (tidak bikin record baru).";
}

function buildPrintHTML(docHtml){
  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>STSU Print</title>
<style>
  @page { size: A4; margin: 12mm; }
  body{ margin:0; font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial; }
  .doc{ width:210mm; min-height:297mm; }
  /* copy minimal style from .doc */
  .doc-title{font-weight:900;text-align:center;letter-spacing:.4px}
  .doc-no{margin-top:4px;text-align:center;font-size:12px}
  .doc-body{margin-top:14px}
  .sec-row{display:flex;justify-content:space-between;gap:10px;font-size:13px;border-bottom:1px solid rgba(15,23,42,.12);padding-bottom:6px}
  .sec-title{font-weight:850;margin-bottom:6px}
  .sec-sub{display:flex;align-items:center;gap:10px;margin-top:8px;font-weight:850;font-size:13px}
  .dots{flex:1;border-bottom:2px dashed rgba(15,23,42,.35);transform:translateY(-2px)}
  .doc-total{display:flex;justify-content:space-between;align-items:baseline;margin-top:14px;border-top:2px solid rgba(15,23,42,.65);padding-top:10px;font-weight:900}
  .doc-terbilang{margin-top:10px;font-size:13px}
  .doc-para{margin-top:10px;font-size:12px;line-height:1.5}
  .doc-sign{margin-top:26px;display:flex;justify-content:space-between;gap:18px}
  .sign-col{width:46%}
  .sign-col.right{text-align:right}
  .sign-line{margin-top:48px;display:inline-block;border-bottom:2px solid rgba(15,23,42,.65);padding-bottom:4px;font-weight:850}
</style>
</head>
<body>
${docHtml}
<script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);};</script>
</body>
</html>`;
}

function printCurrentDoc(){
  // print hanya dokumen (bukan layar)
  const html = buildPrintHTML(document.getElementById("doc").outerHTML);
  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(html);
  w.document.close();
}

printBtn.addEventListener("click", ()=>{
  // pastikan doc sudah ter-render
  renderDocFromInputs();
  printCurrentDoc();
});

async function printFromDb(id){
  if(!currentUser) return;
  const uid = currentUser.uid;
  const snap = await get(ref(db, pStsu(uid, id)));
  if(!snap.exists()) return alert("Data tidak ditemukan.");
  const data = snap.val();

  // render sementara ke DOM doc agar konsisten
  currentDraftId = data.id;
  currentStsuNo = data.stsuNo || "-";
  txDate.value = data.date || todayISO();

  // build doc html manual (tanpa panel lain)
  const makeSec = (title, rows, subtotalLabel, subVal) => {
    const rowsHtml = (rows||[]).map(r=>`<div class="sec-row"><span>${r.label}</span><span>${rupiah(r.amount)}</span></div>`).join("");
    return `
      <div class="doc-section">
        <div class="sec-title">${title}</div>
        <div class="sec-rows">${rowsHtml}</div>
        <div class="sec-sub"><span>${subtotalLabel}</span><span class="dots"></span><span>${rupiah(subVal)}</span></div>
      </div>
    `;
  };

  const iso = data.date || todayISO();
  const total = Number(data.total||0);

  const docHtml = `
  <div class="doc">
    <div class="doc-title">SURAT TANDA SETOR UANG</div>
    <div class="doc-no">No: ${data.stsuNo || "-"}</div>
    <div class="doc-body">
      ${makeSec("Pemakaian Fasilitas", data.sections?.fasilitas, "Subtotal Pemakaian Fasilitas", data.subtotal?.fasilitas || 0)}
      ${makeSec("E-ticketing", data.sections?.eticket, "Subtotal E-ticketing", data.subtotal?.eticket || 0)}

      <div class="doc-total">
        <div class="total-title">JUMLAH TOTAL</div>
        <div class="total-val">${rupiah(total)}</div>
      </div>

      <div class="doc-terbilang">
        <div class="muted">Terbilang :</div>
        <div>${terbilangID(total)}</div>
      </div>

      <div class="doc-para">
        Disetor uang kebendahara penerimaan hasil retribusi layanan masuk tempat rekreasi dan pemakaian fasilitas TMR
        pada hari ${toDDMMYYYY(iso)} dengan STSU No. ${data.stsuNo || "-"} dengan uang sebesar ${rupiah(total)}.
      </div>

      <div class="doc-sign">
        <div class="sign-col">
          <div class="muted">Kepala Seksi Pelayanan & Informasi</div>
          <div class="sign-line">NAMA KEPALA SEKSI</div>
        </div>
        <div class="sign-col right">
          <div class="muted">Jakarta, ............</div>
          <div class="muted" style="margin-top:22px;">Bendahara Penerimaan</div>
          <div class="sign-line">NAMA BENDAHARA</div>
        </div>
      </div>
    </div>
  </div>`;

  const html = buildPrintHTML(docHtml);
  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/* ================== INIT UI ================== */
dashboardCard.style.display = "none";
buatCard.style.display = "none";
txDate.value = todayISO();
searchDate.value = todayISO();
initInputs();
