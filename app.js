import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
  getDatabase, ref,
  get, set, update, push, remove,
  query, orderByChild, limitToLast, startAt, endAt,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

/** ================== CONFIG (punya kamu) ================== */
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

/** ================== HELPERS ================== */
const $ = (id)=>document.getElementById(id);

function rupiah(n){
  const x = Number(n||0);
  return "Rp " + x.toLocaleString("id-ID");
}
function toNumber(input){
  const s = String(input ?? "").replace(/[^\d]/g,"");
  return s ? Number(s) : 0;
}
function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function msg(el, text, ok=true){
  el.className = "msg " + (ok ? "ok":"err");
  el.textContent = text;
}
function clearMsg(el){ el.className="msg"; el.textContent=""; }

function humanDateLong(iso){
  if(!iso) return "";
  const dt = new Date(iso+"T00:00:00");
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}
function isoShort(iso){
  if(!iso) return "-";
  const [y,m,d]=iso.split("-");
  return `${d}/${m}/${y}`;
}
function dayNameIndonesia(iso){
  if(!iso) return "";
  const dt = new Date(iso+"T00:00:00");
  const days = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  return days[dt.getDay()];
}
function terbilang(n){
  n = Math.floor(Number(n||0));
  if(n===0) return "nol rupiah";
  const satuan = ["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];
  function t(x){
    x = Math.floor(x);
    if(x<12) return satuan[x];
    if(x<20) return t(x-10)+" belas";
    if(x<100) return t(x/10)+" puluh"+(x%10? " "+t(x%10):"");
    if(x<200) return "seratus"+(x-100? " "+t(x-100):"");
    if(x<1000) return t(x/100)+" ratus"+(x%100? " "+t(x%100):"");
    if(x<2000) return "seribu"+(x-1000? " "+t(x-1000):"");
    if(x<1000000) return t(x/1000)+" ribu"+(x%1000? " "+t(x%1000):"");
    if(x<1000000000) return t(x/1000000)+" juta"+(x%1000000? " "+t(x%1000000):"");
    if(x<1000000000000) return t(x/1000000000)+" miliar"+(x%1000000000? " "+t(x%1000000000):"");
    return t(x/1000000000000)+" triliun"+(x%1000000000000? " "+t(x%1000000000000):"");
  }
  return (t(n).trim() + " rupiah").replace(/\s+/g," ");
}

/** ================== NAV / DRAWER ================== */
function openMenu(){
  $("drawer").classList.remove("hidden");
  $("backdrop").classList.remove("hidden");
}
function closeMenu(){
  $("drawer").classList.add("hidden");
  $("backdrop").classList.add("hidden");
}
function showPage(name){
  ["login","dashboard","buat"].forEach(p=> $("page-"+p)?.classList.add("hidden"));
  $("page-"+name)?.classList.remove("hidden");
}
$("btnMenu").addEventListener("click", openMenu);
$("btnCloseMenu").addEventListener("click", closeMenu);
$("backdrop").addEventListener("click", closeMenu);
document.querySelectorAll(".nav").forEach(btn=>{
  btn.addEventListener("click", async ()=>{
    closeMenu();
    const go = btn.dataset.go;
    showPage(go);
    if(go==="dashboard") await loadLast10();
  });
});

/** ================== DEFAULT TEMPLATE ================== */
const DEFAULT_SECTIONS = [
  { title:"Pemakaian Fasilitas", enabled:true, items:["Panggung","Lahan terbuka"] },
  { title:"Section Baru (Custom)", enabled:false, items:["Retribusi juru foto","Retribusi video","Retribusi lainnya"] },
  { title:"E-ticketing", enabled:true, items:[
    "Dewasa","Anak","Rombongan Dewasa","Rombongan Anak","Taman Satwa Anak",
    "Pusat Primata Hari Biasa Anak","Pusat Primata Hari Biasa Dewasa",
    "Pusat Primata Hari Besar Anak","Pusat Primata Hari Besar Dewasa",
    "Kendaraan Gol 1","Kendaraan Gol 2","Kendaraan Gol 3","Motor","Sepeda"
  ]},
  { title:"Tiket Online", enabled:true, items:[
    "Dewasa","Anak","Taman Satwa Anak",
    "Pusat Primata Hari Biasa Anak","Pusat Primata Hari Biasa Dewasa",
    "Pusat Primata Hari Besar Anak","Pusat Primata Hari Besar Dewasa",
    "Kendaraan Gol 2","Kendaraan Gol 3","Motor","Sepeda"
  ]},
  { title:"Vending Machine", enabled:false, items:["Dewasa","Anak"] },
  { title:"New Gate", enabled:true, items:[
    "Dewasa","Anak","Kendaraan Gol 1","Kendaraan Gol 3","Motor","Sepeda"
  ]}
];

/** ================== STATE ================== */
let user = null;
let role = "user";
let currentEditingId = null;     // stsuId kalau sedang edit draft/final
let chartDaily = null;

/** ================== AUTH UI ================== */
$("btnLogin").addEventListener("click", async ()=>{
  clearMsg($("loginMsg"));
  const email = $("loginEmail").value.trim();
  const pass = $("loginPass").value.trim();
  if(!email || !pass) return msg($("loginMsg"), "Email & password wajib.", false);

  try{
    await signInWithEmailAndPassword(auth, email, pass);
    msg($("loginMsg"), "Login berhasil ✅", true);
  }catch(e){
    msg($("loginMsg"), "Login gagal: " + (e?.message||e), false);
  }
});
$("btnReset").addEventListener("click", async ()=>{
  clearMsg($("loginMsg"));
  const email = $("loginEmail").value.trim();
  if(!email) return msg($("loginMsg"), "Isi email dulu untuk reset password.", false);

  try{
    await sendPasswordResetEmail(auth, email);
    msg($("loginMsg"), "Link reset sudah dikirim ✅", true);
  }catch(e){
    msg($("loginMsg"), "Gagal reset: " + (e?.message||e), false);
  }
});
$("btnLogout").addEventListener("click", async ()=>{
  await signOut(auth);
  closeMenu();
});

onAuthStateChanged(auth, async (u)=>{
  user = u || null;

  if(!user){
    role = "user";
    $("authBadge").textContent = "Auth: OFF";
    $("uidText").textContent = "-";
    $("roleText").textContent = "-";

    $("stAuth").textContent="OFF";
    $("stUid").textContent="-";
    $("stEmail").textContent="-";
    $("stRole").textContent="-";

    showPage("login");
    return;
  }

  $("authBadge").textContent = "Auth: ON";
  $("uidText").textContent = user.uid;

  $("stAuth").textContent="ON";
  $("stUid").textContent=user.uid;
  $("stEmail").textContent=user.email || "-";

  // role dari RTDB (opsional)
  const rs = await get(ref(db, `roles/${user.uid}`));
  role = rs.exists() ? rs.val() : "user";
  $("roleText").textContent = role;
  $("stRole").textContent = role;

  // init form
  resetBuatForm();
  renderSections(DEFAULT_SECTIONS);

  // default nama (boleh kamu ganti)
  $("namaKasi").value = $("namaKasi").value || "NAMA KEPALA SEKSI";
  $("namaBend").value = $("namaBend").value || "NAMA BENDAHARA";

  showPage("dashboard");
  await loadLast10();
});

/** ================== CLEAN: ignore nominal 0 ================== */
function collectForm(){
  const jenis = $("jenis").value;
  const tglTransaksi = $("tglTransaksi").value;
  const tglStsu = $("tglStsu").value || "";
  const kasi = $("namaKasi").value.trim() || "NAMA KEPALA SEKSI";
  const bend = $("namaBend").value.trim() || "NAMA BENDAHARA";

  const sections = [];
  document.querySelectorAll("#sectionsWrap .sectionCard").forEach(card=>{
    const enabled = card.querySelector(".secEnabled")?.checked ?? true;
    const title = card.querySelector(".sectionTitle")?.textContent?.trim() || "Section";

    const items = [];
    card.querySelectorAll(".itemRow").forEach(r=>{
      const label = (r.querySelector(".itName")?.value || "").trim();
      const nominal = toNumber(r.querySelector(".itVal")?.value);

      // IGNORE 0
      if(!label) return;
      if(!nominal || nominal <= 0) return;

      items.push({ label, nominal });
    });

    // section kosong tidak ditampilkan di print dan tidak disimpan (kecuali kamu mau simpan kosong — kamu minta jangan)
    if(!enabled) return;
    if(items.length === 0) return;

    const subtotal = items.reduce((a,i)=>a+Number(i.nominal||0),0);
    sections.push({ title, items, subtotal });
  });

  const total = sections.reduce((a,s)=>a+Number(s.subtotal||0),0);

  return { jenis, tglTransaksi, tglStsu, kasi, bend, sections, total };
}

/** ================== NOMOR: preview vs booking ================== */
async function previewNextNo({ tglTransaksi, jenis }){
  if(!tglTransaksi) throw new Error("Tanggal transaksi wajib diisi.");

  const year = tglTransaksi.slice(0,4);
  const dd = tglTransaksi.slice(8,10);
  const mm = tglTransaksi.slice(5,7);
  const jenisKey = (jenis === "Lainnya") ? "L" : "SU";

  const snap = await get(ref(db, `counters/${year}/${jenisKey}`));
  const cur = snap.exists() ? Number(snap.val() || 0) : 0;
  const next = cur + 1; // preview only

  return `${next}/${dd}/${mm}/${jenisKey}/${year}`;
}

// BOOKING nomor: counter naik (dipanggil saat SIMPAN DRAFT)
async function bookNo({ tglTransaksi, jenis }){
  if(!tglTransaksi) throw new Error("Tanggal transaksi wajib diisi.");

  const year = tglTransaksi.slice(0,4);
  const dd = tglTransaksi.slice(8,10);
  const mm = tglTransaksi.slice(5,7);
  const jenisKey = (jenis === "Lainnya") ? "L" : "SU";

  const counterRef = ref(db, `counters/${year}/${jenisKey}`);
  const tx = await runTransaction(counterRef, (cur)=>{
    const c = Number(cur || 0);
    return c + 1; // booking
  });

  const issued = Number(tx.snapshot.val());
  return `${issued}/${dd}/${mm}/${jenisKey}/${year}`;
}

/** ================== RENDER SECTIONS UI ================== */
function makeItemRow(label="", nominal=""){
  const row = document.createElement("div");
  row.className = "itemRow";
  row.innerHTML = `
    <input class="itName" placeholder="Kategori" value="${escapeHtml(label)}">
    <input class="itVal" placeholder="Nominal" inputmode="numeric" value="${escapeHtml(nominal)}">
    <button class="btn danger" type="button">Hapus</button>
  `;
  row.querySelector(".btn.danger").addEventListener("click", ()=>{
    row.remove();
    refreshPreview();
  });
  row.querySelector(".itName").addEventListener("input", refreshPreview);
  row.querySelector(".itVal").addEventListener("input", refreshPreview);
  return row;
}

function renderSections(sectionTemplates){
  const wrap = $("sectionsWrap");
  wrap.innerHTML = "";

  sectionTemplates.forEach(sec=>{
    const card = document.createElement("div");
    card.className = "sectionCard";
    card.innerHTML = `
      <div class="sectionHead">
        <div>
          <div class="sectionTitle">${escapeHtml(sec.title)}</div>
          <div class="sectionMeta">Nominal 0 tidak dihitung.</div>
        </div>
        <div class="sectionActions">
          <label class="switch">Aktif <input class="secEnabled" type="checkbox" ${sec.enabled ? "checked":""}></label>
          <button class="btn" type="button" data-add>+ Baris</button>
        </div>
      </div>
      <div class="items"></div>
    `;
    const itemsEl = card.querySelector(".items");

    (sec.items||[]).forEach(name=>{
      itemsEl.appendChild(makeItemRow(name, ""));
    });

    card.querySelector("[data-add]").addEventListener("click", ()=>{
      itemsEl.appendChild(makeItemRow("", ""));
      refreshPreview();
    });
    card.querySelector(".secEnabled").addEventListener("change", refreshPreview);

    wrap.appendChild(card);
  });

  refreshPreview();
}

// tambah section custom (muncul di atas E-ticketing sesuai request kamu dulu)
$("btnAddSection").addEventListener("click", ()=>{
  const name = prompt("Nama Section baru?");
  if(!name) return;

  const wrap = $("sectionsWrap");
  const card = document.createElement("div");
  card.className = "sectionCard";
  card.innerHTML = `
    <div class="sectionHead">
      <div>
        <div class="sectionTitle">${escapeHtml(name)}</div>
        <div class="sectionMeta">Custom section (bisa tambah/hapus baris).</div>
      </div>
      <div class="sectionActions">
        <label class="switch">Aktif <input class="secEnabled" type="checkbox" checked></label>
        <button class="btn" type="button" data-add>+ Baris</button>
        <button class="btn danger" type="button" data-del>Hapus Section</button>
      </div>
    </div>
    <div class="items"></div>
  `;
  const itemsEl = card.querySelector(".items");
  itemsEl.appendChild(makeItemRow("", ""));

  card.querySelector("[data-add]").addEventListener("click", ()=>{
    itemsEl.appendChild(makeItemRow("", ""));
    refreshPreview();
  });
  card.querySelector(".secEnabled").addEventListener("change", refreshPreview);
  card.querySelector("[data-del]").addEventListener("click", ()=>{
    card.remove(); refreshPreview();
  });

  // sisipkan setelah section pertama (fasilitas) biar “di atas E-ticketing”
  const afterFirst = wrap.children[1] || null;
  wrap.insertBefore(card, afterFirst);

  refreshPreview();
});

/** ================== PREVIEW / PRINT RENDER ================== */
function renderPaper({ noStsu, status, data }){
  const lines = [];
  lines.push(`<div class="a4-title">SURAT TANDA SETOR UANG</div>`);
  lines.push(`<div class="a4-no">No: ${escapeHtml(noStsu || "-")} &nbsp; <span style="color:#64748b">(${escapeHtml(status||"")})</span></div>`);

  data.sections.forEach(sec=>{
    lines.push(`<table class="a4-table">`);
    lines.push(`<tr><td class="a4-sec" colspan="2">${escapeHtml(sec.title)}</td></tr>`);

    sec.items.forEach(it=>{
      lines.push(`
        <tr>
          <td class="a4-item">${escapeHtml(it.label)}</td>
          <td class="a4-val">${rupiah(it.nominal)}</td>
        </tr>
      `);
    });

    lines.push(`
      <tr class="a4-subrow">
        <td colspan="2">
          <div class="a4-subwrap">
            <span class="a4-sublabel">Subtotal ${escapeHtml(sec.title)}</span>
            <span class="a4-subdots"></span>
            <span class="a4-subamt">${rupiah(sec.subtotal)}</span>
          </div>
        </td>
      </tr>
    `);

    lines.push(`</table>`);
  });

  lines.push(`
    <div class="a4-total">
      <div>JUMLAH TOTAL</div>
      <div>${rupiah(data.total)}</div>
    </div>
    <div class="a4-terbilang"><b>Terbilang :</b> ${escapeHtml(terbilang(data.total))}</div>
  `);

  // Penutup hanya Retribusi
  if(data.jenis === "Retribusi"){
    const hari = data.tglTransaksi ? dayNameIndonesia(data.tglTransaksi) : "....";
    const tglShort = data.tglTransaksi ? isoShort(data.tglTransaksi) : "....";

    lines.push(`
      <div class="a4-penutup">
        Disetor uang kebendahara penerimaan hasil retribusi layanan masuk tempat rekreasi dan pemakaian fasilitas TMR
        pada hari ${escapeHtml(hari)} tanggal ${escapeHtml(tglShort)} dengan STSU No. ${escapeHtml(noStsu || "-")}
        dengan uang sebesar ${rupiah(data.total)}.
      </div>
    `);
  }

  const ttdText = data.tglStsu ? `Jakarta, ${escapeHtml(humanDateLong(data.tglStsu))}` : `Jakarta, ...............`;

  lines.push(`
    <div class="a4-ttd">
      <div class="a4-left">
        Kepala Seksi Pelayanan & Informasi
        <div class="a4-name">${escapeHtml(data.kasi)}</div>
      </div>
      <div class="a4-right">
        <div class="place">${ttdText}</div>
        Bendahara Penerimaan
        <div class="a4-name">${escapeHtml(data.bend)}</div>
      </div>
    </div>
  `);

  $("paper").innerHTML = lines.join("");
}

function refreshPreview(){
  clearMsg($("buatMsg"));
  const form = collectForm();

  // jangan render kalau belum isi tgl transaksi
  if(!form.tglTransaksi){
    $("paper").innerHTML = `<div class="muted">Isi tanggal transaksi untuk mulai.</div>`;
    return;
  }

  // kalau belum ada item >0
  if(form.total <= 0){
    $("paper").innerHTML = `<div class="muted">Isi minimal 1 item nominal &gt; 0 untuk preview.</div>`;
    return;
  }

  const status = currentEditingId ? "EDIT" : "NEW";
  renderPaper({ noStsu: $("noStsu").value || "-", status, data: form });
}

/** ================== BUTTONS ================== */
$("btnPreview").addEventListener("click", refreshPreview);

$("btnPrint").addEventListener("click", ()=>{
  refreshPreview();
  window.print();
});

// Refresh nomor = preview only (tidak naik counter)
$("btnRefreshNo").addEventListener("click", async ()=>{
  clearMsg($("buatMsg"));
  const jenis = $("jenis").value;
  const tglTransaksi = $("tglTransaksi").value;

  try{
    const previewNo = await previewNextNo({ tglTransaksi, jenis });
    $("noStsu").value = previewNo;
    msg($("buatMsg"), "Nomor (preview) dibuat. Counter belum naik.", true);
    refreshPreview();
  }catch(e){
    msg($("buatMsg"), e?.message || String(e), false);
  }
});

// Simpan Draft = booking nomor (counter naik) + tampil di dashboard
$("btnSaveDraft").addEventListener("click", async ()=>{
  clearMsg($("buatMsg"));
  if(!user) return;

  const form = collectForm();
  if(!form.tglTransaksi) return msg($("buatMsg"), "Tanggal transaksi wajib diisi.", false);
  if(form.total <= 0) return msg($("buatMsg"), "Total 0 tidak boleh disimpan. Isi minimal 1 item > 0.", false);

  try{
    // kalau edit draft yang sudah ada -> jangan booking nomor lagi
    // (kalau kamu mau behavior beda, bilang ya)
    let noStsu = $("noStsu").value || "";

    if(!currentEditingId){
      // booking nomor resmi (counter naik)
      noStsu = await bookNo({ tglTransaksi: form.tglTransaksi, jenis: form.jenis });
      $("noStsu").value = noStsu;
    }else{
      // kalau sedang edit existing STSU, pertahankan nomor
      const snap = await get(ref(db, `stsu/${currentEditingId}`));
      if(snap.exists()){
        noStsu = snap.val().noStsu || $("noStsu").value;
        $("noStsu").value = noStsu;
      }
    }

    const now = Date.now();

    // Simpan ke stsu
    let stsuId = currentEditingId;
    if(!stsuId){
      stsuId = push(ref(db, "stsu")).key;
      currentEditingId = stsuId;
    }

    const payload = {
      stsuId,
      uid: user.uid,
      status: "DRAFT",
      noStsu,
      jenis: form.jenis,
      tglTransaksi: form.tglTransaksi,
      tglStsu: form.tglStsu || "",
      kasi: form.kasi,
      bend: form.bend,
      sections: form.sections,
      total: form.total,
      createdAt: now,
      updatedAt: now
    };

    const indexPayload = {
      stsuId,
      uid: user.uid,
      status: "DRAFT",
      noStsu,
      jenis: form.jenis,
      tglTransaksi: form.tglTransaksi,
      total: form.total,
      createdAt: now,
      updatedAt: now
    };

    const updates = {};
    updates[`stsu/${stsuId}`] = payload;
    updates[`stsu_index/${stsuId}`] = indexPayload;

    await update(ref(db), updates);

    $("buatBadge").textContent = "DRAFT";
    msg($("buatMsg"), `Draft tersimpan ✅ Nomor resmi: ${noStsu}`, true);
    refreshPreview();

  }catch(e){
    msg($("buatMsg"), "Gagal simpan draft: " + (e?.message||e), false);
  }
});

// Final = ubah status jadi FINAL (tanpa booking nomor lagi)
$("btnFinal").addEventListener("click", async ()=>{
  clearMsg($("buatMsg"));
  if(!user) return;

  if(!currentEditingId) return msg($("buatMsg"), "Tidak ada draft yang dipilih. Simpan Draft dulu.", false);

  try{
    const now = Date.now();
    const tglStsu = $("tglStsu").value || "";

    const updates = {};
    updates[`stsu/${currentEditingId}/status`] = "FINAL";
    updates[`stsu/${currentEditingId}/tglStsu`] = tglStsu;
    updates[`stsu/${currentEditingId}/updatedAt`] = now;

    updates[`stsu_index/${currentEditingId}/status`] = "FINAL";
    updates[`stsu_index/${currentEditingId}/updatedAt`] = now;

    await update(ref(db), updates);

    $("buatBadge").textContent = "FINAL";
    msg($("buatMsg"), "Berhasil FINAL ✅ (nomor tidak berubah)", true);
    refreshPreview();
  }catch(e){
    msg($("buatMsg"), "Gagal final: " + (e?.message||e), false);
  }
});

/** ================== RESET FORM BUAT ================== */
function resetBuatForm(){
  currentEditingId = null;
  $("buatBadge").textContent = "DRAFT";
  $("jenis").value = "Retribusi";
  $("tglTransaksi").value = "";
  $("tglStsu").value = "";
  $("noStsu").value = "";
  clearMsg($("buatMsg"));
  $("paper").innerHTML = `<div class="muted">Isi data dulu untuk melihat preview.</div>`;
}

/** ================== DASHBOARD (last 10 + search tanggal) ================== */
$("btnLoadLast10").addEventListener("click", loadLast10);
$("btnSearchTanggal").addEventListener("click", searchByTanggal);

$("qJenis").addEventListener("change", ()=> {
  // re-render list dari cache terakhir? paling gampang: muat ulang last10
  // biar simple: kalau user sudah isi tanggal, search; kalau tidak, last10
  if($("qTanggal").value) searchByTanggal();
  else loadLast10();
});

async function loadLast10(){
  if(!user) return;
  $("dashInfo").textContent = "Memuat...";

  const q = query(ref(db, "stsu_index"), orderByChild("createdAt"), limitToLast(10));
  const snap = await get(q);
  const val = snap.val() || {};
  let arr = Object.values(val);

  // filter by jenis
  const jenis = $("qJenis").value;
  if(jenis !== "ALL") arr = arr.filter(x=>x.jenis === jenis);

  // urut newest
  arr.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  renderDashboardList(arr, `Menampilkan ${arr.length} dari 10 terakhir`);
}

async function searchByTanggal(){
  if(!user) return;
  const tgl = $("qTanggal").value;
  if(!tgl) return renderDashboardList([], "Isi tanggal transaksi untuk search.");

  $("dashInfo").textContent = "Mencari...";

  const q = query(
    ref(db, "stsu_index"),
    orderByChild("tglTransaksi"),
    startAt(tgl),
    endAt(tgl + "\uf8ff")
  );
  const snap = await get(q);
  const val = snap.val() || {};
  let arr = Object.values(val);

  // filter by jenis
  const jenis = $("qJenis").value;
  if(jenis !== "ALL") arr = arr.filter(x=>x.jenis === jenis);

  // urut newest
  arr.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  renderDashboardList(arr, `Hasil search tanggal ${isoShort(tgl)}: ${arr.length} data`);
}

function renderDashboardList(arr, infoText){
  const list = $("stsuList");
  list.innerHTML = "";

  const total = arr.reduce((a,x)=>a+Number(x.total||0),0);
  $("sumCount").textContent = String(arr.length);
  $("sumTotal").textContent = rupiah(total);
  $("dashInfo").textContent = infoText;

  // chart
  renderChart(arr);

  arr.forEach(x=>{
    const row = document.createElement("div");
    row.className = "trow";
    row.innerHTML = `
      <div><b>${escapeHtml(x.noStsu||"-")}</b></div>
      <div>${escapeHtml(x.tglTransaksi ? isoShort(x.tglTransaksi) : "-")}</div>
      <div>${escapeHtml(x.jenis||"-")}</div>
      <div><span class="badge">${escapeHtml(x.status||"-")}</span></div>
      <div class="tr">${rupiah(x.total||0)}</div>
      <div class="tr">
        <button class="btn" data-act="open">Buka</button>
        <button class="btn danger" data-act="del">Hapus</button>
      </div>
    `;

    row.querySelector('[data-act="open"]').addEventListener("click", async ()=>{
      await openStsu(x.stsuId);
    });

    row.querySelector('[data-act="del"]').addEventListener("click", async ()=>{
      if(!confirm("Hapus STSU ini?")) return;
      await remove(ref(db, `stsu/${x.stsuId}`));
      await remove(ref(db, `stsu_index/${x.stsuId}`));
      // refresh current list context
      if($("qTanggal").value) await searchByTanggal();
      else await loadLast10();
    });

    list.appendChild(row);
  });
}

async function openStsu(stsuId){
  const snap = await get(ref(db, `stsu/${stsuId}`));
  if(!snap.exists()){
    alert("Data STSU tidak ditemukan.");
    return;
  }
  const d = snap.val();

  // pindah ke page buat
  showPage("buat");

  currentEditingId = stsuId;
  $("buatBadge").textContent = d.status || "DRAFT";

  $("jenis").value = d.jenis || "Retribusi";
  $("tglTransaksi").value = d.tglTransaksi || "";
  $("tglStsu").value = d.tglStsu || "";
  $("noStsu").value = d.noStsu || "";
  $("namaKasi").value = d.kasi || "NAMA KEPALA SEKSI";
  $("namaBend").value = d.bend || "NAMA BENDAHARA";

  // render sections from saved data (langsung persis data tersimpan)
  const wrap = $("sectionsWrap");
  wrap.innerHTML = "";

  (d.sections||[]).forEach(sec=>{
    const card = document.createElement("div");
    card.className = "sectionCard";
    card.innerHTML = `
      <div class="sectionHead">
        <div>
          <div class="sectionTitle">${escapeHtml(sec.title||"Section")}</div>
          <div class="sectionMeta">Edit data lalu Simpan Draft / Final.</div>
        </div>
        <div class="sectionActions">
          <label class="switch">Aktif <input class="secEnabled" type="checkbox" checked></label>
          <button class="btn" type="button" data-add>+ Baris</button>
        </div>
      </div>
      <div class="items"></div>
    `;
    const itemsEl = card.querySelector(".items");
    (sec.items||[]).forEach(it=>{
      itemsEl.appendChild(makeItemRow(it.label, String(it.nominal)));
    });

    card.querySelector("[data-add]").addEventListener("click", ()=>{
      itemsEl.appendChild(makeItemRow("", ""));
      refreshPreview();
    });
    card.querySelector(".secEnabled").addEventListener("change", refreshPreview);

    wrap.appendChild(card);
  });

  refreshPreview();
}

/** ================== CHART ================== */
function renderChart(arr){
  const ctx = $("chartDaily");
  if(!ctx) return;

  // group by tglTransaksi (from current list)
  const byDate = {};
  for(const x of arr){
    const t = x.tglTransaksi || "";
    if(!t) continue;
    byDate[t] = (byDate[t] || 0) + Number(x.total || 0);
  }

  const keys = Object.keys(byDate).sort();
  const labels = keys.map(isoShort);
  const values = keys.map(k=>byDate[k]);

  if(chartDaily){
    chartDaily.destroy();
    chartDaily = null;
  }

  chartDaily = new Chart(ctx, {
    type:"line",
    data:{
      labels,
      datasets:[{ label:"Pendapatan", data: values }]
    },
    options:{
      responsive:true,
      plugins:{ legend:{ display:true }},
      scales:{
        y:{
          ticks:{ callback:(v)=> "Rp " + Number(v).toLocaleString("id-ID") }
        }
      }
    }
  });
}

/** ================== INIT EXTRA ================== */
$("jenis").addEventListener("change", ()=>{ refreshPreview(); });
$("tglTransaksi").addEventListener("change", ()=>{
  // kalau tanggal berubah, nomor preview lama jangan bikin bingung
  // kita kosongkan nomor (biar user klik refresh atau simpan draft)
  if(!currentEditingId) $("noStsu").value = "";
  refreshPreview();
});
$("tglStsu").addEventListener("change", refreshPreview);
$("namaKasi").addEventListener("input", refreshPreview);
$("namaBend").addEventListener("input", refreshPreview);
