// Uji alur Fase 2 (rekruter & pemohon). Butuh PR 001 berstatus Open tanpa Prioritas/PIC.
//   node tests/e2e/fase2-flow.cjs <folder-screenshot> <folder-berisi-memo.pdf-dan-palsu.pdf>
const { chromium } = require('playwright');
const ExcelJS = require('/home/user/form-epr/node_modules/exceljs');
const [SHOTS, DIR] = process.argv.slice(2);
const B = 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch();
  const log = (...a) => console.log(...a);
  async function as(nama, opts = { viewport: { width: 1366, height: 900 } }) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', e => log('PAGEERROR', e.message));
    await page.goto(B + '/login');
    await page.getByRole('button', { name: new RegExp(nama) }).first().click();
    await page.waitForURL(B + '/');
    return { ctx, page };
  }
  const err = async (page) => (await page.locator('.field-error').allInnerTexts()).join(' | ');

  // 1. Rekruter Adnan
  let { ctx, page } = await as('Adnan');
  await page.goto(B + '/rekrutmen');
  log('tile perlu dilengkapi:', await page.locator('a[href="/rekrutmen?status=PERLU_DILENGKAPI"] .text-2xl').innerText());
  await page.screenshot({ path: SHOTS + '/10-dashboard-rekruter.png', fullPage: true });
  await page.getByRole('link', { name: 'Welder' }).last().click(); // PR 001
  await page.waitForURL(/\/pr\//);
  const prUrl = page.url();
  log('PR:', await page.locator('.text-sm.text-slate-500').first().innerText());
  log('tombol status nonaktif sebelum PIC:', await page.getByRole('button', { name: 'On Hold' }).isDisabled());
  // tambah kandidat sebelum prioritas/PIC → ditolak
  await page.getByRole('button', { name: '+ Tambah Kandidat' }).click();
  await page.fill('input[name=nama]', 'Bambang');
  await page.selectOption('select[name=sumber]', 'Job Portal');
  await page.selectOption('select[name=status]', 'Joined');
  await page.fill('input[name=tanggalJoin]', '2026-11-19');
  await page.getByRole('button', { name: 'Simpan Kandidat' }).click();
  await page.waitForTimeout(800);
  log('kandidat tanpa PIC:', await err(page));
  await page.getByRole('button', { name: 'Batal' }).first().click();
  // isi data proses
  await page.selectOption('#prioritas', 'High');
  await page.selectOption('#recruiterPic', 'Adnan');
  await page.selectOption('#tahapDetail', 'Interview User');
  await page.fill('#progressNote', 'Interview user dijadwalkan minggu depan.');
  await page.fill('#note', 'Kandidat dari job portal lebih banyak.');
  await page.getByRole('button', { name: 'Simpan Data Proses' }).click();
  await page.waitForSelector('text=Data proses tersimpan.');
  // kandidat
  for (const [nama, sumber, status, tgl] of [['Bambang', 'Job Portal', 'Joined', '2026-11-19'], ['Cahyo', 'Internal Referral', 'Offer Accepted', '']]) {
    await page.getByRole('button', { name: '+ Tambah Kandidat' }).click();
    await page.fill('input[name=nama]', nama);
    await page.selectOption('select[name=sumber]', sumber);
    await page.selectOption('select[name=status]', status);
    if (tgl) await page.fill('input[name=tanggalJoin]', tgl);
    await page.getByRole('button', { name: 'Simpan Kandidat' }).click();
    await page.waitForSelector(`li:has-text("${nama}")`);
  }
  log('realisasi:', await page.locator('text=Realisasi').first().innerText());
  await ctx.close();

  // 2. Pemohon Rudi: dashboard user (HP) + ajukan Hold dengan memo
  ({ ctx, page } = await as('Rudi Hartono', { viewport: { width: 390, height: 844 } }));
  await page.goto(B + '/pr?tab=open');
  const card = page.locator('article').filter({ hasText: '001/SDM/PR/XI/2026' });
  log('kartu user:', (await card.innerText()).replace(/\s+/g, ' '));
  await card.getByRole('button').click();
  log('timeline popup:', (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ').slice(0, 120));
  await page.screenshot({ path: SHOTS + '/11-user-timeline-hp.png' });
  await page.getByRole('button', { name: 'Tutup' }).click();
  await page.screenshot({ path: SHOTS + '/12-dashboard-user-hp.png', fullPage: true });
  await page.goto(prUrl);
  log('Rudi melihat Note internal?', (await page.content()).includes('Kandidat dari job portal'));
  await page.getByRole('button', { name: 'Ajukan Hold' }).click();
  await page.fill('#req-alasan', 'Proyek tower ditunda klien 1 bulan.');
  await page.fill('#req-estimasi', '2026-12-31');
  await page.setInputFiles('#req-memo', DIR + '/memo.pdf');
  await page.getByRole('button', { name: 'Kirim Ajukan Hold' }).click();
  await page.waitForSelector('text=sedang menunggu diproses rekruter');
  log('pengajuan Hold terkirim');
  await ctx.close();

  // 3. Adnan mengeksekusi Hold, lalu Unhold (uji file palsu), lalu Filled
  ({ ctx, page } = await as('Adnan'));
  log('badge nav rekruter:', await page.getByRole('link', { name: /Dashboard Rekruter/ }).innerText());
  await page.goto(prUrl);
  await page.getByRole('button', { name: 'Eksekusi On Hold' }).click();
  log('prefill alasan:', await page.inputValue('#alasan'), '| estimasi:', await page.inputValue('#estimasi'));
  await page.getByRole('button', { name: 'Konfirmasi On Hold' }).click();
  await page.waitForSelector('.badge:has-text("On Hold")');
  log('status setelah hold:', await page.locator('h1 + div .badge').allInnerTexts());
  await page.getByRole('button', { name: 'Unhold (Open kembali)' }).click();
  await page.setInputFiles('#memo', DIR + '/palsu.pdf');
  await page.getByRole('button', { name: /Konfirmasi Unhold/ }).click();
  await page.waitForTimeout(1000);
  log('memo palsu:', await err(page));
  await page.setInputFiles('#memo', DIR + '/memo.pdf');
  await page.getByRole('button', { name: /Konfirmasi Unhold/ }).click();
  await page.waitForSelector('h1 + div .badge:has-text("Open")');
  // Cahyo → Joined
  await page.locator('li:has-text("Cahyo")').getByRole('button', { name: 'Ubah' }).click();
  await page.selectOption('select[name=status]', 'Joined');
  await page.fill('input[name=tanggalJoin]', '2026-12-07');
  await page.getByRole('button', { name: 'Simpan Kandidat' }).click();
  await page.waitForSelector('text=Disarankan mengubah status');
  log('saran Filled muncul');
  await page.getByRole('button', { name: 'Filled', exact: true }).click();
  await page.getByRole('button', { name: 'Konfirmasi Filled' }).click();
  await page.waitForSelector('h1 + div .badge:has-text("Filled")');
  log('progres:', (await page.locator('section:has(h2:text("Progres Rekrutmen"))').innerText()).replace(/\s+/g, ' '));
  await page.screenshot({ path: SHOTS + '/13-detail-rekruter-filled.png', fullPage: true });
  // Export
  const resp = await page.request.get(B + '/api/export?status=FILLED');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await resp.body());
  const ws = wb.worksheets[0];
  const hdr = ws.getRow(1).values.slice(1);
  const row = Object.fromEntries(hdr.map((h, i) => [h, ws.getRow(2).getCell(i + 1).value]));
  log('export:', resp.status(), 'baris:', ws.rowCount - 1, 'kolom:', hdr.length, '|', row['PR NO'], row['Realisasi'], row['Fulfillment Date'], row['Placement Time (Days)'], row['Approval 2 Name']);
  const memoLink = await page.locator('a:has-text("Lihat memo")').first().getAttribute('href');
  await ctx.close();

  // 4. Hak akses: Rudi (pemohon) vs Maya (divisi lain)
  ({ ctx, page } = await as('Rudi Hartono'));
  let r = await page.request.get(B + memoLink);
  log('memo oleh Rudi:', r.status(), r.headers()['content-type']);
  log('export oleh Rudi:', (await page.request.get(B + '/api/export')).status());
  log('/rekrutmen oleh Rudi →', (await page.goto(B + '/rekrutmen'), page.url()));
  await page.goto(B + '/notifikasi');
  log('notifikasi Rudi:', (await page.locator('article h2').allInnerTexts()).slice(0, 4));
  await ctx.close();
  ({ ctx, page } = await as('Maya Putri'));
  log('memo oleh Maya (ENG):', (await page.request.get(B + memoLink)).status());
  await ctx.close();
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
