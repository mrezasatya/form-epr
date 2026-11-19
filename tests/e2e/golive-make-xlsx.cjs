const ExcelJS = require('/home/user/form-epr/node_modules/exceljs');
async function make(file, rows) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Karyawan');
  ws.addRow(['NIK', 'Nama', 'Jabatan', 'Job Level', 'Divisi', 'Departemen', 'Email', 'NIK Atasan', 'Aktif']);
  rows.forEach((r) => ws.addRow(r));
  await wb.xlsx.writeFile(file);
}
const good = [
  ['700001', 'Bambang Direktur', 'Direktur Operasional', 'Director', 'BOD/C', 'BOD/C', 'bambang@contoh.local', '', 'Ya'],
  ['710001', 'Citra Kadiv Produksi', 'Kepala Divisi Produksi', 'Division Head', 'PRO', 'PPIC', 'citra@contoh.local', '700001', 'Ya'],
  ['710002', 'Dodi Kadiv HRD', 'Kepala Divisi HRD', 'Division Head', 'HRD', 'HRD', 'dodi@contoh.local', '700001', 'Ya'],
  ['720001', 'Eka Dept Head WS B', 'Department Head Workshop B', 'department head', 'PRO', 'WS B', 'eka@contoh.local', '710001', ''],
  ['730001', 'Fani Recruiter', 'Recruiter', 'Office Staff', 'HRD', 'HRD', 'fani@contoh.local', '710002', 'Ya'],
  ['740001', 'Gilang Welder', 'Welder', 'Operator', 'PRO', 'WS B', '', '720001', 'Ya'],
];
(async () => {
  await make('karyawan_salah.xlsx', [...good,
    ['740002', 'Hadi', 'Fitter', 'Tukang', 'PRO', 'WS B', '', '', ''],
    ['720001', 'Duplikat', 'X', 'Operator', 'PRO', 'WS B', '', '', ''],
    ['740003', 'Indah', 'Admin', 'Office Staff', 'XYZ', 'ABC', 'bukan-email', '', ''],
  ]);
  await make('karyawan_benar.xlsx', good);
  console.log('ok');
})();
