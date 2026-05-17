let dataSubmit = [];
let dataMengerjakan = [];

let pageSubmit = 1;
let pageSizeSubmit = 10;

let pageMengerjakan = 1;
const pageSizeMengerjakan = 10;

document.addEventListener("DOMContentLoaded", () => {
  const sudahLogin =
    sessionStorage.getItem("adminLogin") === "true";

  if (sudahLogin) {
    tampilkanDashboardAdmin();
  } else {
    tampilkanLoginAdmin();
  }

  document
    .getElementById("btnLoginAdmin")
    .addEventListener("click", loginAdmin);
});

function tampilkanLoginAdmin() {
  document
    .getElementById("loginAdminBox")
    .classList.remove("hidden");

  document
    .getElementById("dashboardAdmin")
    .classList.add("hidden");
}

function tampilkanDashboardAdmin() {
  document
    .getElementById("loginAdminBox")
    .classList.add("hidden");

  document
    .getElementById("dashboardAdmin")
    .classList.remove("hidden");

  aktifkanEventAdmin();
  loadDashboard();
}

async function loginAdmin() {
  const username =
    document.getElementById("adminUsername").value.trim();

  const password =
    document.getElementById("adminPassword").value.trim();

  if (!username || !password) {
    alert("Username dan password wajib diisi.");
    return;
  }

  try {
    const result =
      await apiGet("loginAdmin", {
        username,
        password
      });

    if (!result.success) {
      alert(result.message || "Login gagal.");
      return;
    }

    sessionStorage.setItem("adminLogin", "true");

    tampilkanDashboardAdmin();
  } catch (error) {
    alert("Gagal login: " + error.message);
  }
}

function aktifkanEventAdmin() {
  document
    .getElementById("btnImport")
    .addEventListener("click", importSoalExcel);

  document
    .getElementById("pageSizeSubmit")
    .addEventListener("change", ubahPageSizeSubmit);

  document
    .getElementById("prevSubmit")
    .addEventListener("click", prevSubmitPage);

  document
    .getElementById("nextSubmit")
    .addEventListener("click", nextSubmitPage);

  document
    .getElementById("prevMengerjakan")
    .addEventListener("click", prevMengerjakanPage);

  document
    .getElementById("nextMengerjakan")
    .addEventListener("click", nextMengerjakanPage);
}

async function loadDashboard() {
  adminInfo("Memuat dashboard...");

  try {
    const result =
      await apiGet("getDashboard");

    if (!result.success) {
      throw new Error(
        result.message || "Gagal memuat dashboard."
      );
    }

    const data = result.data;

    document.getElementById("statSoal").textContent =
      data.totalSoal || 0;

    document.getElementById("statSubmit").textContent =
      data.totalSubmit || 0;

    document.getElementById("statMengerjakan").textContent =
      data.totalMengerjakan || 0;

    document.getElementById("statDurasi").textContent =
      data.durasiMenit || 60;

    dataSubmit =
      data.submit || [];

    dataMengerjakan =
      data.mengerjakan || [];

    pageSubmit = 1;
    pageMengerjakan = 1;

    renderSubmit();
    renderMengerjakan();

    adminInfo("Dashboard berhasil dimuat.");
  } catch (error) {
    adminInfo("Gagal memuat dashboard: " + error.message);
  }
}

async function importSoalExcel() {
  const file =
    document.getElementById("fileImport").files[0];

  if (!file) {
    adminInfo("Pilih file Excel terlebih dahulu.");
    return;
  }

  try {
    adminInfo("Membaca file Excel...");

    const rows =
      await bacaExcel(file);

    const soal =
      rows
        .slice(1)
        .filter(row => row[0])
        .map(row => ({
          idsoal:
            String(row[0] || "").trim(),

          benar:
            String(row[1] || "").trim(),

          salah1:
            String(row[2] || "").trim(),

          salah2:
            String(row[3] || "").trim(),

          salah3:
            String(row[4] || "").trim(),

          salah4:
            String(row[5] || "").trim()
        }));

    if (soal.length === 0) {
      throw new Error(
        "Tidak ada soal yang terbaca dari Excel."
      );
    }

    adminInfo(`Mengimport ${soal.length} soal...`);

    const result =
      await apiPost({
        action: "importSoal",
        soal
      });

    if (!result.success) {
      throw new Error(
        result.message || "Gagal import soal."
      );
    }

    adminInfo(
      `${soal.length} soal berhasil diimport.`
    );

    await loadDashboard();
  } catch (error) {
    adminInfo("Gagal import soal: " + error.message);
  }
}

function bacaExcel(file) {
  return new Promise((resolve, reject) => {
    const reader =
      new FileReader();

    reader.onload = e => {
      try {
        const data =
          new Uint8Array(e.target.result);

        const workbook =
          XLSX.read(data, {
            type: "array"
          });

        const sheet =
          workbook.Sheets[
            workbook.SheetNames[0]
          ];

        const rows =
          XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            raw: false
          });

        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;

    reader.readAsArrayBuffer(file);
  });
}

function renderSubmit() {
  const tabel =
    document.getElementById("tabelSubmit");

  const totalPage =
    Math.max(
      1,
      Math.ceil(dataSubmit.length / pageSizeSubmit)
    );

  pageSubmit =
    Math.min(
      Math.max(pageSubmit, 1),
      totalPage
    );

  const start =
    (pageSubmit - 1) * pageSizeSubmit;

  const rows =
    dataSubmit.slice(
      start,
      start + pageSizeSubmit
    );

  if (rows.length === 0) {
    tabel.innerHTML =
      `<tbody>
        <tr>
          <td class="text-slate-500">
            Belum ada data submit.
          </td>
        </tr>
      </tbody>`;

    updateInfoSubmit(totalPage);

    return;
  }

  tabel.innerHTML = `
    <thead>
      <tr>
        <th>Waktu</th>
        <th>Nama</th>
        <th>Email</th>
        <th>Skor</th>
        <th>Total</th>
      </tr>
    </thead>

    <tbody>
      ${rows.map(row => `
        <tr>
          <td class="whitespace-nowrap">
            ${escapeHtml(row.timestamp || "")}
          </td>

          <td>
            ${escapeHtml(row.nama || "")}
          </td>

          <td>
            ${escapeHtml(row.email || "")}
          </td>

          <td>
            ${escapeHtml(row.skor || 0)}
          </td>

          <td>
            ${escapeHtml(row.total || "")}
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;

  updateInfoSubmit(totalPage);
}

function renderMengerjakan() {
  const tabel =
    document.getElementById("tabelMengerjakan");

  const totalPage =
    Math.max(
      1,
      Math.ceil(
        dataMengerjakan.length / pageSizeMengerjakan
      )
    );

  pageMengerjakan =
    Math.min(
      Math.max(pageMengerjakan, 1),
      totalPage
    );

  const start =
    (pageMengerjakan - 1) * pageSizeMengerjakan;

  const rows =
    dataMengerjakan.slice(
      start,
      start + pageSizeMengerjakan
    );

  if (rows.length === 0) {
    tabel.innerHTML =
      `<tbody>
        <tr>
          <td class="text-slate-500">
            Belum ada peserta sedang mengerjakan.
          </td>
        </tr>
      </tbody>`;

    updateInfoMengerjakan(totalPage);

    return;
  }

  tabel.innerHTML = `
    <thead>
      <tr>
        <th>Mulai</th>
        <th>Nama</th>
        <th>Email</th>
        <th>Status</th>
      </tr>
    </thead>

    <tbody>
      ${rows.map(row => `
        <tr>
          <td class="whitespace-nowrap">
            ${escapeHtml(row.mulai || "")}
          </td>

          <td>
            ${escapeHtml(row.nama || "")}
          </td>

          <td>
            ${escapeHtml(row.email || "")}
          </td>

          <td>
            ${escapeHtml(row.status || "")}
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;

  updateInfoMengerjakan(totalPage);
}

function ubahPageSizeSubmit() {
  pageSizeSubmit =
    Number(
      document.getElementById("pageSizeSubmit").value
    );

  pageSubmit = 1;

  renderSubmit();
}

function prevSubmitPage() {
  pageSubmit--;
  renderSubmit();
}

function nextSubmitPage() {
  pageSubmit++;
  renderSubmit();
}

function prevMengerjakanPage() {
  pageMengerjakan--;
  renderMengerjakan();
}

function nextMengerjakanPage() {
  pageMengerjakan++;
  renderMengerjakan();
}

function updateInfoSubmit(totalPage) {
  document.getElementById("infoPageSubmit").textContent =
    `Halaman ${pageSubmit} dari ${totalPage} • Total ${dataSubmit.length} data`;
}

function updateInfoMengerjakan(totalPage) {
  document.getElementById("infoPageMengerjakan").textContent =
    `Halaman ${pageMengerjakan} dari ${totalPage} • Total ${dataMengerjakan.length} data`;
}
