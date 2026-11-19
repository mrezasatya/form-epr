// Gladi go-live: DB kosong + SEED_DUMMY=false, AUTH_MODE=local, MAIL_MODE=smtp ke smtp-sink.cjs (port 2527).
//   node tests/e2e/golive-flow.cjs <folder-xlsx-&-mails.json> <folder-screenshot> <password-sementara-admin>
const { chromium } = require('playwright');
const fs = require('fs');
const [DIR, SHOTS, ADMINPW] = process.argv.slice(2);
const B = 'http://localhost:3000';
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  async function login(nik, pw, ctxOpts = { viewport: { width: 1280, height: 900 } }) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => log('PAGEERROR', e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto(B + '/login');
    await page.fill('#nik', nik);
    await page.fill('#password', pw);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForLoadState('networkidle');
    return { ctx, page };
  }
  async function changePw(page, oldPw, newPw) {
    await page.fill('#current', oldPw); await page.fill('#new', newPw); await page.fill('#confirm', newPw);
    await page.getByRole('button', { name: 'Simpan Password' }).click();
    await page.waitForSelector('text=Password berhasil diganti.');
  }
  const status = (page) => page.locator('[role=status]').last().innerText();

  // 1. Admin login pertama → wajib ganti password
  let { ctx, page } = await login('900001', ADMINPW);
  log('admin login → ', page.url().replace(B, ''));
  await page.screenshot({ path: SHOTS + '/30-wajib-ganti-password.png' });
  await page.fill('#current', ADMINPW); await page.fill('#new', 'abcdefgh'); await page.fill('#confirm', 'abcdefgh');
  await page.getByRole('button', { name: 'Simpan Password' }).click();
  log('password lemah:', await page.locator('.field-error').innerText());
  await changePw(page, ADMINPW, 'AdminHR-2026');
  await page.getByRole('link', { name: 'Lanjut ke e-PR' }).click();
  await page.waitForURL(B + '/');
  log('banner prototype tampil?', await page.locator('text=PROTOTYPE').count());

  // 2. Impor karyawan
  await page.goto(B + '/admin/impor');
  await page.setInputFiles('#file', DIR + '/karyawan_salah.xlsx');
  await page.getByRole('button', { name: /Periksa File/ }).click();
  await page.waitForSelector('text=Pratinjau impor');
  log('impor salah — error:', (await page.locator('ul.text-red-700 li').allInnerTexts()).join(' | '));
  log('tombol proses nonaktif:', await page.getByRole('button', { name: '2. Proses Impor' }).isDisabled());
  await page.setInputFiles('#file', DIR + '/karyawan_benar.xlsx');
  await page.getByRole('button', { name: /Periksa File/ }).click();
  await page.waitForSelector('text=Pratinjau impor');
  log('impor benar — ringkasan:', (await page.locator('section .grid').innerText()).replace(/\s+/g, ' '));
  await page.getByRole('button', { name: '2. Proses Impor' }).click();
  await page.waitForSelector('text=Impor selesai');
  log('hasil:', await page.locator('.bg-emerald-50').last().innerText());
  await page.screenshot({ path: SHOTS + '/31-impor.png', fullPage: true });

  // 3. Peran & struktur
  for (const [nik, role] of [['710002', 'KEPALA_HRD'], ['730001', 'RECRUITER']]) {
    await page.goto(B + '/admin/karyawan/' + nik);
    await page.check(`input[name=roles][value=${role}]`);
    await page.getByRole('button', { name: 'Simpan' }).first().click();
    await page.waitForURL(/saved=/);
  }
  await page.goto(B + '/admin/divisi');
  for (const [div, kadiv, dir] of [['PRO', '710001', '700001'], ['HRD', '710002', '700001']]) {
    const f = page.locator('form').filter({ has: page.locator(`input[name=kode][value="${div}"]`) });
    await f.locator('select[name=kadivNik]').selectOption(kadiv);
    await f.locator('select[name=direkturPembinaNik]').selectOption(dir);
    await f.getByRole('button', { name: 'Simpan' }).click();
    await f.locator('[role=status]').waitFor();
  }
  log('divisi diatur');
  // Reset password untuk Eka (Dept Head) & Citra (Kadiv)
  const temps = {};
  for (const nik of ['720001', '710001', '710002']) {
    await page.goto(B + '/admin/karyawan/' + nik);
    await page.getByRole('button', { name: /password sementara|Reset password/i }).click();
    temps[nik] = (await page.locator('.select-all').innerText()).trim();
  }
  log('password sementara dibuat untuk', Object.keys(temps).join(', '));
  // Sistem
  await page.goto(B + '/admin/sistem');
  log('cek sistem:', (await page.locator('section').first().locator('li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' || '));
  await page.fill('input[name=to]', 'it.test@contoh.local');
  await page.getByRole('button', { name: 'Kirim email uji' }).click();
  await page.waitForTimeout(1500);
  log('email uji:', await status(page));
  await page.screenshot({ path: SHOTS + '/32-sistem.png', fullPage: true });
  await ctx.close();

  // 4. Password salah 5x → terkunci
  for (let i = 1; i <= 5; i++) {
    ({ ctx, page } = await login('710001', 'salah' + i));
    if (i === 5) log('percobaan ke-5:', await page.locator('p[role=alert]').innerText());
    await ctx.close();
  }
  ({ ctx, page } = await login('710001', temps['710001']));
  log('password benar saat terkunci:', await page.locator('p[role=alert]').innerText());
  await ctx.close();
  ({ ctx, page } = await login('999999', 'apaSaja123'));
  log('NIK tak terdaftar:', await page.locator('p[role=alert]').innerText());
  await ctx.close();

  // 5. Eka (Dept Head hasil impor) → ganti password → ajukan PR (HP)
  ({ ctx, page } = await login('720001', temps['720001'], { viewport: { width: 390, height: 844 } }));
  await changePw(page, temps['720001'], 'Workshop-B26');
  await page.goto(B + '/pr/baru');
  await page.fill('#jobTitle', 'Welder');
  await page.selectOption('#jobLevel', 'Operator');
  await page.selectOption('#lokasiKerja', 'Workshop');
  await page.fill('#jobResponsibilities', 'Pengelasan struktur baja.');
  await page.selectOption('#levelPendidikan', 'SMA/SMK');
  await page.selectOption('#pengalaman', '1-2 tahun');
  for (const [id, v] of [['jurusan', 'Teknik Pengelasan'], ['hardSkills', 'SMAW'], ['softSkills', 'Disiplin']]) { await page.fill('#' + id, v); await page.press('#' + id, 'Enter'); }
  await page.getByRole('button', { name: 'Tidak', exact: true }).click();
  await page.selectOption('#statusEmployment', 'Contract');
  await page.selectOption('#durationContract', '12 months');
  await page.selectOption('#jenisKebutuhan', 'Replacement');
  await page.fill('#replaced', 'Gilang Welder'); await page.press('#replaced', 'Enter');
  await page.getByRole('button', { name: 'Lanjut: Tinjau & Ajukan' }).click();
  await page.getByRole('button', { name: 'Ya, Ajukan PR' }).click();
  await page.waitForURL(/\?baru=1/);
  log('PR:', await page.locator('.bg-emerald-50').first().innerText());
  const prUrl = page.url().replace('?baru=1', '');
  await ctx.close();

  // 6. Email terkirim ke Kadiv (approver 1)
  let mails = [];
  for (let i = 0; i < 15; i++) { mails = JSON.parse(fs.readFileSync(DIR + '/mails.json')); if (mails.some((m) => /Perlu Approval 1/.test(m.subject))) break; await sleep(1000); }
  for (const m of mails) log('EMAIL →', m.to, '|', m.subject);
  const ap = mails.find((m) => /Perlu Approval 1/.test(m.subject));
  log('link di email:', ap && (ap.text.match(/http:\/\/localhost:3000\/pr\/\S+/) || [])[0] === prUrl);

  // 7. Sesi lama tidak berlaku setelah reset password
  ({ ctx, page } = await login('710002', temps['710002']));
  await changePw(page, temps['710002'], 'KepalaHRD-26');
  const oldCookies = await ctx.cookies();
  const c2 = await browser.newContext(); const p2 = await c2.newPage();
  await p2.goto(B + '/login'); await p2.fill('#nik', '900001'); await p2.fill('#password', 'AdminHR-2026'); await p2.getByRole('button', { name: 'Masuk' }).click(); await p2.waitForURL(B + '/');
  await p2.goto(B + '/admin/karyawan/710002'); await p2.getByRole('button', { name: /Reset password/ }).click(); await p2.locator('.select-all').waitFor();
  await c2.close();
  await page.goto(B + '/approval');
  log('sesi Dodi setelah direset admin →', page.url().replace(B, ''));
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
