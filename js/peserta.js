let bankSoal = [];
let pengaturan = null;
let sedangKirim = false;
let waktuMulaiUjian = null;
let durasiMenit = 60;
let timerInterval = null;
let sudahAutoSubmit = false;

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("btnAmbilSoal")
    .addEventListener("click", ambilSoal);

  document
    .getElementById("btnMulai")
    .addEventListener("click", mulaiUjian);

  document
    .getElementById("btnKirim")
    .addEventListener("click", () => kirimJawaban(false));
});

async function ambilSoal() {
  tampilInfo("Mengambil soal dari Google Sheet...");

  try {
    const result = await apiGet("getSoal");

    if (!result.success) {
      throw new Error(result.message || "Gagal mengambil soal.");
    }

    bankSoal = result.data.soal || [];
    pengaturan = result.data.pengaturan || {};

    durasiMenit = Number(pengaturan.durasiMenit || 60);

    tampilPeriode(pengaturan);

    tampilInfo(`${bankSoal.length} soal berhasil dimuat.`);
  } catch (error) {
    tampilInfo("Gagal mengambil soal: " + error.message);
  }
}

async function mulaiUjian() {
  const nama = document.getElementById("nama").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();

  if (!nama || !email) {
    tampilInfo("Nama dan email wajib diisi.");
    return;
  }

  if (bankSoal.length === 0) {
    tampilInfo("Klik tombol Ambil Soal terlebih dahulu.");
    return;
  }

  try {
    tampilInfo("Mengecek status peserta...");

    const result = await apiGet("mulaiUjian", {
      nama,
      email
    });

    if (!result.success) {
      throw new Error(result.message || "Tidak bisa memulai ujian.");
    }

    renderSoal();

    waktuMulaiUjian = Date.now();
    sudahAutoSubmit = false;

    mulaiTimer();

    document
      .getElementById("areaUjian")
      .classList.remove("hidden");

    tampilInfo("Ujian dimulai. Timer berjalan.");
  } catch (error) {
    tampilInfo(error.message);
  }
}

function renderSoal() {
  const form = document.getElementById("formUjian");

  form.innerHTML = "";

  bankSoal.forEach((soal, index) => {
    const pilihan = acakArray([
      soal.benar,
      ...soal.salah
    ]);

    const div = document.createElement("div");

    div.className = "blok-soal";

    div.innerHTML = `
      <div class="flex items-start gap-4 mb-5">
        <div class="nomor-soal">
          ${index + 1}
        </div>

        <div class="min-w-0">
          <p class="text-xs uppercase tracking-wide text-slate-400 font-bold mb-1">
            Soal Nomor ${index + 1}
          </p>

          <p class="text-base md:text-lg font-semibold leading-relaxed text-slate-800 whitespace-pre-wrap">
            ${escapeHtml(soal.idsoal)}
          </p>
        </div>
      </div>

      <div class="space-y-3">
        ${pilihan.map((p, pilihanIndex) => `
          <label class="pilihan-jawaban">
            <input
              type="radio"
              name="${escapeHtml(soal.idsoal)}"
              value="${escapeHtml(p)}"
            />

            <div class="flex gap-3 min-w-0">
              <span class="shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold">
                ${String.fromCharCode(65 + pilihanIndex)}
              </span>

              <span class="leading-relaxed text-slate-700 whitespace-pre-wrap">
                ${escapeHtml(p)}
              </span>
            </div>
          </label>
        `).join("")}
      </div>
    `;

    form.appendChild(div);
  });
}

function mulaiTimer() {
  clearInterval(timerInterval);

  const timerEl = document.getElementById("timerUjian");

  function updateTimer() {
    const selesai =
      waktuMulaiUjian + durasiMenit * 60 * 1000;

    const sisa =
      selesai - Date.now();

    if (sisa <= 0) {
      clearInterval(timerInterval);

      timerEl.textContent = "Waktu Habis";

      autoSubmitKarenaWaktuHabis();

      return;
    }

    const menit =
      Math.floor(sisa / 1000 / 60);

    const detik =
      Math.floor((sisa / 1000) % 60);

    timerEl.textContent =
      `Sisa Waktu: ${String(menit).padStart(2, "0")}:${String(detik).padStart(2, "0")}`;
  }

  updateTimer();

  timerInterval =
    setInterval(updateTimer, 1000);
}

async function autoSubmitKarenaWaktuHabis() {
  if (sudahAutoSubmit) return;

  sudahAutoSubmit = true;

  tampilInfo(
    "Waktu habis. Jawaban yang sudah terisi otomatis dikirim."
  );

  await kirimJawaban(true);
}

async function kirimJawaban(forceSubmit = false) {
  if (sedangKirim) return;

  const nama =
    document.getElementById("nama").value.trim();

  const email =
    document.getElementById("email").value.trim().toLowerCase();

  const jawaban = {};
  let skor = 0;

  for (const soal of bankSoal) {
    const input =
      document.querySelector(
        `input[name="${CSS.escape(soal.idsoal)}"]:checked`
      );

    if (!input) {
      if (forceSubmit) {
        jawaban[soal.idsoal] = "";
        continue;
      }

      tampilInfo(`Soal "${soal.idsoal}" belum dijawab.`);
      return;
    }

    jawaban[soal.idsoal] = input.value;

    if (input.value === soal.benar) {
      skor++;
    }
  }

  const payload = {
    action: "saveRespon",
    nama,
    email,
    jawaban,
    skor,
    total: bankSoal.length,
    waktuMulai:
      waktuMulaiUjian
        ? new Date(waktuMulaiUjian).toISOString()
        : "",
    waktuKirim:
      new Date().toISOString(),
    durasiMenit
  };

  try {
    sedangKirim = true;

    tampilInfo("Mengirim jawaban...");

    const result = await apiPost(payload);

    if (!result.success) {
      throw new Error(result.message || "Gagal menyimpan jawaban.");
    }

    clearInterval(timerInterval);

    tampilInfo(
      `Jawaban berhasil dikirim. Skor: ${skor}/${bankSoal.length}`
    );

    document
      .getElementById("areaUjian")
      .classList.add("hidden");
  } catch (error) {
    tampilInfo(error.message);
  } finally {
    sedangKirim = false;
  }
}

function tampilPeriode(data) {
  const el = document.getElementById("periodeInfo");

  if (!el) return;

  el.innerHTML = `
    <b>Pengaturan Ujian</b><br>
    Periode Dibuka: ${escapeHtml(data.mulai || "-")}<br>
    Periode Ditutup: ${escapeHtml(data.selesai || "-")}<br>
    Durasi Pengerjaan: ${escapeHtml(data.durasiMenit || 60)} menit<br>
    Status Periode:
    ${
      data.aktif
        ? '<b class="text-green-700">Aktif</b>'
        : '<b class="text-red-700">Tidak aktif</b>'
    }
  `;

  el.classList.remove("hidden");
}
