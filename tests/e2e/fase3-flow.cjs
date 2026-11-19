// Uji alur Fase 3 (Admin HR, approval kertas, cetak, laporan).
//   node tests/e2e/fase3-flow.cjs <folder-screenshot> <folder-berisi-memo.pdf>
const { chromium } = require('playwright');
const [SHOTS, DIR] = process.argv.slice(2);
const B = 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch();
  const log = (...a) => console.log(...a);
  async function as(nama, opts = { viewport: { width: 1366, height: 900 } }) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', e => log('PAGEERROR', e.message));
    page.on('dialog', d => d.accept());
    await page.goto(B + '/login');
    await page.getByRole('button', { name: new RegExp(nama) }).first().click();
    await page.waitForURL(B + '/');
    return { ctx, page };
  }
  const status = (page) => page.locator('[role=status]').last().innerText();
  const simulate = async (page, jl, div, req, se = 'Contract') => {
    const f = page.locator('section:has(h2:text("Simulator")) form');
    await f.locator('select[name=jobLevel]').selectOption(jl);
    await f.locator('select[name=divisiKode]').selectOption(div);
    await f.locator('select[name=statusEmployment]').selectOption(se);
    await f.locator('select[name=requesterNik]').selectOption(req);
    await f.getByRole('button', { name: 'Simulasikan' }).click();
    await page.waitForTimeout(700);
    return (await page.locator('section:has(h2:text("Simulator")) form + *').innerText()).replace(/\s+/g, ' ');
  };

  // ===== Admin HR =====
  let { ctx, page } = await as('Nadia Kusuma');
  log('nav:', (await page.locator('nav').first().innerText()).replace(/\s+/g, ' | '));
  // Hari libur
  await page.goto(B + '/admin/libur?tahun=2027');
  await page.fill('textarea[name=baris]', '17/08/2027;Hari Kemerdekaan RI\n31-02-2027;salah');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(700);
  log('libur invalid:', await status(page));
  await page.fill('textarea[name=baris]', '17/08/2027;Hari Kemerdekaan RI\n2027-12-25;Hari Raya Natal');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForSelector('text=Hari Raya Natal');
  log('libur 2027:', (await page.locator('li .tabular-nums').allInnerTexts()).join(', '));
  // Simulator
  await page.goto(B + '/admin/approval');
  log('sim Operator PRO (Rudi):', await simulate(page, 'Operator', 'PRO', '300001'));
  log('sim Division Head HRD (Siti):', await simulate(page, 'Division Head', 'HRD', '200001'));
  log('sim Operator QA:', await simulate(page, 'Operator', 'QA', ''));
  // Aturan baru khusus PMO Project
  await page.getByRole('link', { name: '+ Aturan Baru' }).click();
  await page.fill('#nama', 'Staf PMO — Project');
  for (const j of ['Operator', 'Technician']) await page.check(`input[name=jobLevels][value="${j}"]`);
  await page.selectOption('select[name=divisiKode]', 'PMO');
  await page.selectOption('select[name=statusEmployment]', 'Project');
  await page.selectOption('select[name=approver1]', 'ROLE:KADIV_PEMOHON');
  await page.selectOption('select[name=approver3]', 'PERSON:100002');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(700);
  log('approver3 tanpa approver2:', await status(page));
  await page.selectOption('select[name=approver2]', 'PERSON:100002');
  await page.selectOption('select[name=approver3]', '');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForURL(B + '/admin/approval');
  log('sim Operator PMO Project:', await simulate(page, 'Operator', 'PMO', '300004', 'Project'));
  log('sim Operator PMO Contract:', await simulate(page, 'Operator', 'PMO', '300004', 'Contract'));
  await page.screenshot({ path: SHOTS + '/20-admin-approval.png', fullPage: true });
  // Divisi
  await page.goto(B + '/admin/divisi');
  log('divisi belum lengkap:', await page.locator('b.text-red-600').innerText());
  // Karyawan: Yoga dapat dept tambahan WS B
  await page.goto(B + '/admin/karyawan/300003');
  await page.check('input[name=extraDepartments][value="WS B"]');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForURL(/saved=300003/);
  log('karyawan tersimpan:', await page.locator('.bg-emerald-50').innerText());
  // tidak bisa cabut admin sendiri
  await page.goto(B + '/admin/karyawan/400004');
  await page.uncheck('input[name=roles][value=ADMIN_HR]');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(700);
  log('cabut admin sendiri:', await status(page));
  // master: tambah jabatan
  await page.goto(B + '/admin/master');
  const jab = page.locator('section:has(h2:text("Daftar Jabatan"))');
  await jab.locator('input[name=nama]').fill('Rigger');
  await jab.getByRole('button', { name: 'Tambah' }).click();
  await page.waitForTimeout(700);
  log('jabatan duplikat:', await jab.locator('[role=status]').innerText());
  await jab.locator('input[name=nama]').fill('Pipe Fitter');
  await jab.getByRole('button', { name: 'Tambah' }).click();
  await jab.locator('li:has-text("Pipe Fitter")').waitFor();
  log('jabatan baru tampil');
  await ctx.close();

  // Yoga: dropdown departemen
  ({ ctx, page } = await as('Yoga Pratama'));
  await page.goto(B + '/pr/baru');
  log('dept Yoga:', await page.locator('#departemenKode option').allInnerTexts());
  await ctx.close();

  // ===== Approval kertas =====
  ({ ctx, page } = await as('Rudi Hartono'));
  await page.goto(B + '/pr/baru');
  await page.fill('#jobTitle', 'Fitter');
  await page.selectOption('#jobLevel', 'Operator');
  await page.selectOption('#lokasiKerja', 'Workshop');
  await page.fill('#jobResponsibilities', 'Fit-up komponen baja.');
  await page.selectOption('#levelPendidikan', 'SMA/SMK');
  await page.selectOption('#pengalaman', '1-2 tahun');
  for (const [id, v] of [['jurusan', 'Teknik Mesin'], ['hardSkills', 'Fit-up'], ['softSkills', 'Teamwork']]) { await page.fill('#' + id, v); await page.press('#' + id, 'Enter'); }
  await page.getByRole('button', { name: 'Tidak', exact: true }).click();
  await page.selectOption('#statusEmployment', 'Contract');
  await page.selectOption('#durationContract', '6 months');
  await page.selectOption('#jenisKebutuhan', 'Additional');
  await page.getByRole('button', { name: 'Lanjut: Tinjau & Ajukan' }).click();
  await page.getByRole('button', { name: 'Ya, Ajukan PR' }).click();
  await page.waitForURL(/\?baru=1/);
  const prUrl = page.url().replace('?baru=1', '');
  await ctx.close();

  ({ ctx, page } = await as('Adnan'));
  await page.goto(prUrl);
  await page.getByRole('button', { name: 'Input Approval Kertas' }).click();
  log('default penandatangan:', await page.inputValue('#signerName'));
  await page.fill('#signedDate', '2026-12-01');
  log('tanggal masa depan valid di browser?', await page.$eval('#signedDate', (e) => e.validity.valid));
  await page.fill('#signedDate', '2026-11-19');
  await page.fill('#paper-catatan', 'Disetujui saat rapat produksi.');
  await page.setInputFiles('#scan', DIR + '/memo.pdf');
  await page.getByRole('button', { name: 'Simpan Approval Kertas' }).click();
  await page.waitForSelector('text=approval kertas');
  log('timeline:', (await page.locator('#timeline').innerText()).replace(/\s+/g, ' '));
  await ctx.close();
  ({ ctx, page } = await as('Siti Rahmawati'));
  await page.goto(prUrl);
  await page.getByRole('button', { name: 'Setujui' }).click();
  await page.getByRole('button', { name: 'Konfirmasi Setujui' }).click();
  await page.waitForSelector('text=Progres Rekrutmen');
  // Cetak
  const [pp] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: /Cetak PR/ }).click()]);
  await pp.waitForLoadState();
  log('cetak header:', (await pp.locator('header').innerText()).replace(/\s+/g, ' '));
  await pp.screenshot({ path: SHOTS + '/21-cetak-pr.png', fullPage: true });
  await pp.emulateMedia({ media: 'print' });
  const pdf = await pp.pdf({ path: SHOTS + '/21-cetak-pr.pdf', format: 'A4', printBackground: true });
  log('PDF bytes:', pdf.length, 'tombol tersembunyi saat print:', !(await pp.getByRole('button', { name: /Cetak/ }).isVisible()));
  await ctx.close();

  // ===== Laporan =====
  ({ ctx, page } = await as('Adnan'));
  await page.goto(B + '/laporan');
  log('laporan Adnan:', (await page.locator('main section').first().innerText()).replace(/\s+/g, ' '));
  log('fulfillment:', (await page.locator('text=Fulfillment rate').locator('..').innerText()).replace(/\s+/g, ' '));
  log('beban PIC:', (await page.locator('section:has(h2:text("Beban kerja")) tbody').innerText()).replace(/\s+/g, ' '));
  await page.screenshot({ path: SHOTS + '/22-laporan.png', fullPage: true });
  await ctx.close();
  ({ ctx, page } = await as('Agus Prasetyo'));
  await page.goto(B + '/laporan');
  log('laporan Kadiv:', await page.locator('h1 + p').innerText(), '| ada filter divisi?', await page.locator('select[name=divisi]').count());
  log('admin oleh Kadiv:', (await (await page.goto(B + '/admin/karyawan')) && page.locator('main').innerText()).slice(0, 40));
  await ctx.close();
  ({ ctx, page } = await as('Rudi Hartono'));
  await page.goto(B + '/laporan');
  log('laporan oleh Rudi →', page.url());
  await ctx.close();
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
