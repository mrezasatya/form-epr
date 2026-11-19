// Uji alur end-to-end (Playwright). Jalankan server dulu, DB berisi seed dummy:
//   node tests/e2e/smoke-flow.cjs <folder-screenshot>
const { chromium } = require('playwright');
const SHOTS = process.argv[2];
const B = 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch();
  const log = (...a) => console.log(...a);
  async function as(nama, opts = {}) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', e => log('PAGEERROR', e.message));
    await page.goto(B + '/login');
    await page.getByRole('button', { name: new RegExp(nama) }).first().click();
    await page.waitForURL(B + '/');
    return { ctx, page };
  }
  async function addTag(page, id, values) {
    for (const v of values) { await page.fill('#' + id, v); await page.press('#' + id, 'Enter'); }
  }

  // 1. Rudi (Dept Head WS A) membuat PR Operator Replacement — tampilan HP
  let { ctx, page } = await as('Rudi Hartono', { viewport: { width: 390, height: 844 } });
  await page.goto(B + '/pr/baru');
  await page.screenshot({ path: SHOTS + '/01-form-kosong-hp.png', fullPage: true });
  // Coba lanjut tanpa isi → validasi muncul
  await page.getByRole('button', { name: 'Lanjut: Tinjau & Ajukan' }).click();
  const errCount = await page.locator('.field-error').count();
  log('validasi kosong, jumlah error:', errCount);
  await page.fill('#jobTitle', 'Welder');
  await page.selectOption('#jobLevel', 'Operator');
  await page.selectOption('#lokasiKerja', 'Workshop');
  await page.fill('#jobResponsibilities', 'Melakukan pengelasan SMAW/GTAW sesuai WPS dan gambar kerja.');
  await page.selectOption('#levelPendidikan', 'SMA/SMK');
  await page.selectOption('#pengalaman', '1-2 tahun');
  await addTag(page, 'jurusan', ['Teknik Pengelasan']);
  await addTag(page, 'hardSkills', ['SMAW, GTAW, Membaca gambar teknik']);
  await addTag(page, 'softSkills', ['Teamwork, Disiplin']);
  await page.getByRole('button', { name: 'Ya', exact: true }).click();
  await addTag(page, 'sertifikasi', ['Welder (SMAW/GTAW/FCAW – ASME/AWS/BNSP)']);
  await page.selectOption('#statusEmployment', 'Contract');
  await page.selectOption('#durationContract', 'Others');
  await page.fill('#durationOthers', 'Sampai proyek selesai');
  await page.fill('#kebutuhan', '2');
  await page.selectOption('#jenisKebutuhan', 'Replacement');
  await addTag(page, 'replaced', ['Joko Susilo']);
  log('expected date default:', await page.inputValue('#expectedDate'));
  await page.screenshot({ path: SHOTS + '/02-form-terisi-hp.png', fullPage: true });
  await page.getByRole('button', { name: 'Lanjut: Tinjau & Ajukan' }).click();
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: SHOTS + '/03-konfirmasi-hp.png' });
  await page.getByRole('button', { name: 'Ya, Ajukan PR' }).click();
  await page.waitForURL(/\/pr\/.+\?baru=1/);
  const prUrl = page.url().replace('?baru=1', '');
  log('sukses:', (await page.locator('.bg-emerald-50').first().innerText()).trim());
  await ctx.close();

  // 2. Agus (Kadiv PRO) menyetujui Approval 1
  ({ ctx, page } = await as('Agus Prasetyo', { viewport: { width: 1280, height: 900 } }));
  log('beranda Agus, approval menunggu:', await page.locator('text=Menunggu approval Anda').locator('..').locator('..').innerText().then(t => t.replace(/\s+/g, ' ')));
  await page.goto(prUrl);
  await page.getByRole('button', { name: 'Setujui' }).click();
  await page.fill('#catatan', 'OK, prioritaskan untuk proyek tower.');
  await page.getByRole('button', { name: 'Konfirmasi Setujui' }).click();
  await page.waitForSelector('text=Menunggu Approval 2');
  await page.screenshot({ path: SHOTS + '/04-detail-setelah-approval1.png', fullPage: true });
  await ctx.close();

  // 3. Siti (Kepala HRD) menyetujui Approval 2 → Disetujui / Open
  ({ ctx, page } = await as('Siti Rahmawati'));
  await page.goto(prUrl);
  await page.getByRole('button', { name: 'Setujui' }).click();
  await page.getByRole('button', { name: 'Konfirmasi Setujui' }).click();
  await page.waitForSelector('text=Progres Rekrutmen');
  log('status akhir:', await page.locator('.badge').allInnerTexts());
  await ctx.close();

  // 4. Agus (Kadiv) mengajukan PR Section Head → approval 1 dilewati; Siti menolak
  ({ ctx, page } = await as('Agus Prasetyo'));
  await page.goto(B + '/pr/baru');
  log('opsi departemen Kadiv:', (await page.locator('#departemenKode option').allInnerTexts()).length - 1);
  await page.selectOption('#departemenKode', 'QC');
  await page.fill('#jobTitle', 'Section Head QC');
  await page.selectOption('#jobLevel', 'Section Head');
  await page.selectOption('#lokasiKerja', 'Workshop');
  await page.fill('#jobResponsibilities', 'Memimpin tim QC fabrikasi.');
  await page.selectOption('#levelPendidikan', 'D4/S1');
  await page.selectOption('#pengalaman', '>5 tahun');
  await addTag(page, 'jurusan', ['Semua jurusan']);
  await addTag(page, 'hardSkills', ['NDT']);
  await addTag(page, 'softSkills', ['Leadership']);
  await page.getByRole('button', { name: 'Tidak', exact: true }).click();
  await page.selectOption('#statusEmployment', 'Contract');
  await page.selectOption('#durationContract', '12 months');
  await page.selectOption('#jenisKebutuhan', 'Additional');
  await page.getByRole('button', { name: 'Lanjut: Tinjau & Ajukan' }).click();
  await page.getByRole('button', { name: 'Ya, Ajukan PR' }).click();
  await page.waitForURL(/\?baru=1/);
  const pr2 = page.url().replace('?baru=1', '');
  log('PR2 timeline:', (await page.locator('ol').innerText()).replace(/\s+/g, ' '));
  await ctx.close();

  ({ ctx, page } = await as('Siti Rahmawati'));
  await page.goto(pr2);
  await page.getByRole('button', { name: 'Tolak' }).click();
  await page.getByRole('button', { name: 'Konfirmasi Tolak' }).click();
  log('tolak tanpa alasan:', await page.locator('.field-error').innerText());
  await page.fill('#catatan', 'Belum ada di rencana manpower 2026.');
  await page.getByRole('button', { name: 'Konfirmasi Tolak' }).click();
  await page.waitForSelector('text=Ditolak');
  await ctx.close();

  // 5. Rudi mencoba melihat PR2 (divisi sama tapi bukan pemilik/Kadiv) → 404
  ({ ctx, page } = await as('Rudi Hartono'));
  const resp = await page.goto(pr2);
  log('akses PR orang lain oleh Rudi:', resp.status());
  await page.goto(B + '/notifikasi');
  log('notifikasi Rudi:', await page.locator('article h2').allInnerTexts());
  await page.goto(B + '/pr');
  await page.screenshot({ path: SHOTS + '/05-daftar-pr.png', fullPage: true });
  await ctx.close();

  // 6. Agus: duplikat PR yang ditolak
  ({ ctx, page } = await as('Agus Prasetyo', { viewport: { width: 390, height: 844 } }));
  await page.goto(pr2);
  await page.screenshot({ path: SHOTS + '/06-pr-ditolak-hp.png', fullPage: true });
  await page.getByRole('link', { name: 'Duplikat PR' }).click();
  log('duplikat job title:', await page.inputValue('#jobTitle'));
  await page.getByRole('button', { name: 'Simpan Draft' }).click();
  await page.waitForURL(/draft=/);
  log('draft tersimpan:', page.url().includes('draft='));
  await ctx.close();

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
