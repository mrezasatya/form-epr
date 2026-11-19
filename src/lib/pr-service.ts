import "server-only";
import { Prisma, type PrRequest } from "@prisma/client";
import { prisma, type Tx } from "./db";
import type { CurrentUser } from "./auth/session";
import { addBusinessDays, parseIsoDate, todayWib, toIsoDate } from "./dates";
import { APPROVER_ROLES, DEFAULT_LEAD_BUSINESS_DAYS, ROLES, SEMUA_JURUSAN } from "./constants";
import { approverLabel, parseApprovers, planSteps, selectRule, type ResolvedApprover } from "./approval";
import { nextPrNo } from "./prno";
import { validatePrForm, type FieldErrors, type PrFormInput } from "./pr-schema";
import { notify } from "./notify";

type User = NonNullable<CurrentUser>;

export class BusinessError extends Error {}

// ---------------------------------------------------------------------------
// Hari libur & hari kerja
// ---------------------------------------------------------------------------

export async function holidaySet(): Promise<Set<string>> {
  const rows = await prisma.holiday.findMany({ select: { tanggal: true } });
  return new Set(rows.map((r) => toIsoDate(r.tanggal)));
}

export async function defaultExpectedDate(from = todayWib()): Promise<Date> {
  return addBusinessDays(from, DEFAULT_LEAD_BUSINESS_DAYS, await holidaySet());
}

// ---------------------------------------------------------------------------
// Hak akses
// ---------------------------------------------------------------------------

/** Departemen yang boleh dipilih pemohon (Spec 5.1 no. 1a). */
export async function allowedDepartments(user: User): Promise<string[]> {
  if (user.isKadiv || user.isDireksi) {
    const depts = await prisma.department.findMany({
      where: { divisiKode: user.divisiKode },
      orderBy: { kode: "asc" },
    });
    return depts.map((d) => d.kode);
  }
  return Array.from(new Set([user.departemenKode, ...user.extraDepartments]));
}

/** Pemohon, Kadiv divisi, approver di PR tsb, rekruter, Admin HR. */
export async function canViewPr(user: User, pr: PrRequest): Promise<boolean> {
  if (pr.requesterNik === user.nik) return true;
  if (pr.statusPersetujuan === "DRAFT") return false;
  if (user.isRecruiter || user.isAdminHr) return true;
  if (user.isKadiv && user.divisiKode === pr.divisiKode) return true;
  const asApprover = await prisma.prApproval.count({ where: { prId: pr.id, approverNik: user.nik } });
  return asApprover > 0;
}

// ---------------------------------------------------------------------------
// Simpan draft / submit
// ---------------------------------------------------------------------------

function normList(xs: string[]) {
  return Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)));
}

function toData(input: PrFormInput, expected: Date) {
  const sertWajib = input.sertifikasiWajib === "Ya";
  let jurusan = normList(input.jurusan);
  if (jurusan.includes(SEMUA_JURUSAN)) jurusan = [SEMUA_JURUSAN];
  return {
    departemenKode: input.departemenKode,
    jobTitle: input.jobTitle.trim(),
    jobLevel: input.jobLevel,
    jobResponsibilities: input.jobResponsibilities.trim(),
    lokasiKerja: input.lokasiKerja,
    levelPendidikan: input.levelPendidikan,
    jurusan,
    pengalaman: input.pengalaman,
    hardSkills: normList(input.hardSkills),
    softSkills: normList(input.softSkills),
    sertifikasiWajib: sertWajib,
    sertifikasi: sertWajib ? normList(input.sertifikasi) : [],
    statusEmployment: input.statusEmployment,
    durationContract: input.durationContract,
    durationOthers: input.durationContract === "Others" ? input.durationOthers.trim() : null,
    kebutuhan: Math.min(99, Math.max(1, Number(input.kebutuhan) || 1)),
    jenisKebutuhan: input.jenisKebutuhan,
    expectedDate: expected,
    remarks: input.remarks.trim() || null,
  };
}

export type SaveResult =
  | { ok: true; id: string; prNo?: string | null }
  | { ok: false; errors?: FieldErrors; message?: string };

export async function savePr(
  user: User,
  input: PrFormInput,
  mode: "draft" | "submit",
  draftId?: string,
): Promise<SaveResult> {
  if (!user.canRequest) return { ok: false, message: "Anda tidak memiliki hak mengajukan PR." };

  const depts = await allowedDepartments(user);
  if (input.departemenKode && !depts.includes(input.departemenKode))
    return { ok: false, errors: { departemenKode: "Departemen tidak diizinkan" } };

  const today = todayWib();
  // Expected Date default dihitung ulang dari tanggal submit, kecuali diubah manual oleh pemohon.
  const autoExpected = await defaultExpectedDate(today);
  const manualExpected = input.expectedDateManual ? parseIsoDate(input.expectedDate) : null;
  const expected = manualExpected ?? autoExpected;
  const normalized: PrFormInput = { ...input, expectedDate: toIsoDate(expected) };

  if (mode === "submit") {
    const errors = validatePrForm(normalized, toIsoDate(today));
    if (Object.keys(errors).length) return { ok: false, errors, message: "Periksa kembali isian form." };
  }

  if (draftId) {
    const existing = await prisma.prRequest.findUnique({ where: { id: draftId } });
    if (!existing || existing.requesterNik !== user.nik || existing.statusPersetujuan !== "DRAFT")
      return { ok: false, message: "Draft tidak ditemukan atau sudah diajukan." };
  }

  const data = toData(normalized, expected);
  const replaced = normalized.jenisKebutuhan === "Replacement" ? normalized.replaced : [];

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const base = {
          ...data,
          departemenKode: data.departemenKode || user.departemenKode,
          requesterNik: user.nik,
          requesterNama: user.nama,
          divisiKode: user.divisiKode,
        };
        const pr = draftId
          ? await tx.prRequest.update({ where: { id: draftId }, data: base })
          : await tx.prRequest.create({ data: { ...base, duplicatedFromId: null } });

        await tx.prReplacedEmployee.deleteMany({ where: { prId: pr.id } });
        if (replaced.length)
          await tx.prReplacedEmployee.createMany({
            data: replaced.map((r) => ({ prId: pr.id, nik: r.nik, nama: r.nama.trim() })),
          });

        if (mode === "draft") return { id: pr.id, prNo: null };
        return submitInTx(tx, user, pr.id, today);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof BusinessError) return { ok: false, message: e.message };
    throw e;
  }
}

async function resolveApprover(
  tx: Tx,
  ref: ReturnType<typeof parseApprovers>[number],
  level: number,
  divisiKode: string,
): Promise<ResolvedApprover> {
  let nik: string | null | undefined = null;
  if (ref.type === "PERSON") nik = ref.value;
  else if (ref.value === "KADIV_PEMOHON")
    nik = (await tx.division.findUnique({ where: { kode: divisiKode } }))?.kadivNik;
  else if (ref.value === "DIREKTUR_PEMBINA")
    nik = (await tx.division.findUnique({ where: { kode: divisiKode } }))?.direkturPembinaNik;
  else if (ref.value === "KEPALA_HRD")
    nik = (await tx.employee.findFirst({ where: { roles: { has: ROLES.KEPALA_HRD }, aktif: true } }))?.nik;
  else if (ref.value === "DIREKTUR_UTAMA")
    nik = (await tx.employee.findFirst({ where: { roles: { has: ROLES.DIREKTUR_UTAMA }, aktif: true } }))?.nik;

  const peran = approverLabel(ref);
  const emp = nik ? await tx.employee.findUnique({ where: { nik } }) : null;
  if (!emp || !emp.aktif)
    throw new BusinessError(
      `Matriks approval belum lengkap: "${peran}" untuk divisi ${divisiKode} belum diatur. Hubungi Admin HR.`,
    );
  return { level, nik: emp.nik, nama: emp.nama, peran: ref.type === "PERSON" ? emp.jabatan : peran };
}

async function submitInTx(tx: Tx, user: User, prId: string, today: Date) {
  const pr = await tx.prRequest.findUniqueOrThrow({ where: { id: prId } });
  const rules = await tx.approvalRule.findMany({ where: { aktif: true } });
  const rule = selectRule(rules, pr);
  if (!rule) throw new BusinessError(`Belum ada aturan approval untuk Job Level "${pr.jobLevel}". Hubungi Admin HR.`);
  const refs = parseApprovers(rule.approvers);
  if (!refs.length) throw new BusinessError(`Aturan approval "${rule.nama}" belum memiliki approver.`);

  const resolved: ResolvedApprover[] = [];
  for (const [i, ref] of refs.entries()) resolved.push(await resolveApprover(tx, ref, i + 1, pr.divisiKode));
  const { steps, firstPendingLevel } = planSteps(resolved, user.nik);

  const prNo = await nextPrNo(tx, today);
  const now = new Date();
  await tx.prApproval.deleteMany({ where: { prId } });
  await tx.prApproval.createMany({
    data: steps.map((s) => ({
      prId,
      level: s.level,
      approverNik: s.nik,
      approverNama: s.nama,
      approverPeran: s.peran,
      status: s.status,
      catatan: s.catatan,
      tanggal: s.status === "DILEWATI" ? now : null,
    })),
  });

  await tx.prRequest.update({
    where: { id: prId },
    data: {
      prNo,
      tanggalPengajuan: today,
      statusPersetujuan: "MENUNGGU_APPROVAL",
      currentLevel: firstPendingLevel,
      approvalRuleId: rule.id,
    },
  });
  await tx.prStatusHistory.create({
    data: { prId, aksi: "SUBMIT", dari: "Draft", ke: "Menunggu Approval", olehNik: user.nik, olehNama: user.nama },
  });
  for (const s of steps.filter((x) => x.status === "DILEWATI"))
    await tx.prStatusHistory.create({
      data: { prId, aksi: "SKIP", ke: `Approval ${s.level}`, olehNama: "Sistem", alasan: s.catatan },
    });

  if (firstPendingLevel === null) {
    await finalizeApproved(tx, prId, today);
  } else {
    const step = steps.find((s) => s.level === firstPendingLevel)!;
    await notifyApprover(tx, prId, prNo, step.nik!, step.level);
  }
  return { id: prId, prNo };
}

// ---------------------------------------------------------------------------
// Keputusan approver
// ---------------------------------------------------------------------------

export async function decide(
  user: User,
  prId: string,
  decision: "APPROVE" | "REJECT",
  catatan: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  catatan = catatan.trim().slice(0, 500);
  if (decision === "REJECT" && !catatan) return { ok: false, message: "Alasan penolakan wajib diisi." };

  try {
    await prisma.$transaction(async (tx) => {
      // Kunci baris PR agar dua keputusan bersamaan tidak saling menimpa.
      await tx.$executeRaw`SELECT 1 FROM "PrRequest" WHERE id = ${prId} FOR UPDATE`;
      const pr = await tx.prRequest.findUnique({ where: { id: prId } });
      if (!pr || pr.statusPersetujuan !== "MENUNGGU_APPROVAL" || pr.currentLevel === null)
        throw new BusinessError("PR ini tidak sedang menunggu persetujuan.");
      const step = await tx.prApproval.findUnique({ where: { prId_level: { prId, level: pr.currentLevel } } });
      if (!step || step.status !== "PENDING" || step.approverNik !== user.nik)
        throw new BusinessError("Anda bukan approver untuk tahap ini.");

      const now = new Date();
      const today = todayWib();
      await tx.prApproval.update({
        where: { id: step.id },
        data: { status: decision === "APPROVE" ? "DISETUJUI" : "DITOLAK", tanggal: now, catatan: catatan || null },
      });

      if (decision === "REJECT") {
        await tx.prApproval.updateMany({
          where: { prId, level: { gt: step.level }, status: "MENUNGGU" },
          data: { status: "DIBATALKAN" },
        });
        await tx.prRequest.update({
          where: { id: prId },
          data: { statusPersetujuan: "DITOLAK", currentLevel: null },
        });
        await tx.prStatusHistory.create({
          data: {
            prId,
            aksi: "REJECT",
            dari: `Menunggu Approval ${step.level}`,
            ke: "Ditolak",
            olehNik: user.nik,
            olehNama: user.nama,
            alasan: catatan,
          },
        });
        const requester = await tx.employee.findUnique({ where: { nik: pr.requesterNik } });
        await notify(tx, {
          prId,
          to: requester,
          jenis: "PR_DITOLAK",
          subjek: `PR ${pr.prNo} ditolak`,
          isi: `PR ${pr.prNo} (${pr.jobTitle}) ditolak oleh ${user.nama} (Approval ${step.level}).\nAlasan: ${catatan}\n\nAnda dapat membuat PR baru dengan tombol "Duplikat PR".`,
          path: `/pr/${prId}`,
        });
        return;
      }

      await tx.prStatusHistory.create({
        data: {
          prId,
          aksi: "APPROVE",
          dari: `Menunggu Approval ${step.level}`,
          olehNik: user.nik,
          olehNama: user.nama,
          alasan: catatan || null,
        },
      });
      const next = await tx.prApproval.findFirst({
        where: { prId, level: { gt: step.level }, status: "MENUNGGU" },
        orderBy: { level: "asc" },
      });
      if (next) {
        await tx.prApproval.update({ where: { id: next.id }, data: { status: "PENDING" } });
        await tx.prRequest.update({ where: { id: prId }, data: { currentLevel: next.level } });
        await notifyApprover(tx, prId, pr.prNo!, next.approverNik!, next.level);
      } else {
        await finalizeApproved(tx, prId, today);
      }
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof BusinessError) return { ok: false, message: e.message };
    throw e;
  }
}

async function notifyApprover(tx: Tx, prId: string, prNo: string, nik: string, level: number) {
  const [approver, pr] = await Promise.all([
    tx.employee.findUnique({ where: { nik } }),
    tx.prRequest.findUniqueOrThrow({ where: { id: prId } }),
  ]);
  await notify(tx, {
    prId,
    to: approver,
    jenis: "MENUNGGU_APPROVAL",
    subjek: `[Perlu Approval ${level}] PR ${prNo} – ${pr.jobTitle}`,
    isi: `Yth. ${approver?.nama},\n\nPR ${prNo} dari ${pr.requesterNama} (${pr.divisiKode} / ${pr.departemenKode}) menunggu persetujuan Anda.\nJob Title: ${pr.jobTitle} (${pr.jobLevel}), Kebutuhan: ${pr.kebutuhan} orang, Jenis: ${pr.jenisKebutuhan}.\n\nSilakan buka link berikut untuk menyetujui atau menolak.`,
    path: `/pr/${prId}`,
  });
}

/** Approval terakhir disetujui → PR Received, status Open, Target Start Date default. Spec 7.2 & 9. */
async function finalizeApproved(tx: Tx, prId: string, today: Date) {
  const holidays = new Set(
    (await tx.holiday.findMany({ select: { tanggal: true } })).map((h) => toIsoDate(h.tanggal)),
  );
  const pr = await tx.prRequest.update({
    where: { id: prId },
    data: {
      statusPersetujuan: "DISETUJUI",
      currentLevel: null,
      prReceivedDate: today,
      statusPermintaan: "OPEN",
      targetStartDate: addBusinessDays(today, DEFAULT_LEAD_BUSINESS_DAYS, holidays),
    },
  });
  await tx.prStatusHistory.create({
    data: { prId, aksi: "APPROVED", dari: "Menunggu Approval", ke: "Disetujui (Open)", olehNama: "Sistem" },
  });

  const [requester, recruiters, division] = await Promise.all([
    tx.employee.findUnique({ where: { nik: pr.requesterNik } }),
    tx.employee.findMany({ where: { roles: { has: ROLES.RECRUITER }, aktif: true } }),
    tx.division.findUnique({ where: { kode: pr.divisiKode } }),
  ]);
  const kadiv = division?.kadivNik ? await tx.employee.findUnique({ where: { nik: division.kadivNik } }) : null;
  const recipients = [requester, ...recruiters, kadiv].filter(
    (e, i, arr) => e && arr.findIndex((x) => x?.nik === e.nik) === i,
  );
  for (const to of recipients)
    await notify(tx, {
      prId,
      to,
      jenis: "PR_DISETUJUI",
      subjek: `PR ${pr.prNo} disetujui – ${pr.jobTitle}`,
      isi: `PR ${pr.prNo} (${pr.jobTitle}, ${pr.kebutuhan} orang) dari ${pr.requesterNama} telah disetujui penuh dan diterima tim rekrutmen.`,
      path: `/pr/${prId}`,
    });
}

/** Isi form dari PR lain (fitur "Duplikat PR"). */
export function prToForm(
  pr: PrRequest & { replacedEmployees: { nik: string | null; nama: string }[] },
): PrFormInput {
  return {
    departemenKode: pr.departemenKode,
    jobTitle: pr.jobTitle,
    jobLevel: pr.jobLevel,
    jobResponsibilities: pr.jobResponsibilities,
    lokasiKerja: pr.lokasiKerja,
    levelPendidikan: pr.levelPendidikan,
    jurusan: pr.jurusan,
    pengalaman: pr.pengalaman,
    hardSkills: pr.hardSkills,
    softSkills: pr.softSkills,
    sertifikasiWajib: pr.sertifikasiWajib ? "Ya" : pr.statusPersetujuan === "DRAFT" && !pr.sertifikasi.length ? "" : "Tidak",
    sertifikasi: pr.sertifikasi,
    statusEmployment: pr.statusEmployment,
    durationContract: pr.durationContract,
    durationOthers: pr.durationOthers ?? "",
    kebutuhan: String(pr.kebutuhan),
    jenisKebutuhan: pr.jenisKebutuhan,
    replaced: pr.replacedEmployees.map((r) => ({ nik: r.nik, nama: r.nama })),
    expectedDate: toIsoDate(pr.expectedDate),
    expectedDateManual: false,
    remarks: pr.remarks ?? "",
  };
}

export const approverRoleOptions = APPROVER_ROLES;
