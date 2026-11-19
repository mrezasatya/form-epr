import "server-only";
import type { PrRequest } from "@prisma/client";
import { prisma, type Tx } from "./db";
import type { CurrentUser } from "./auth/session";
import { fmtDate, parseIsoDate, todayWib } from "./dates";
import {
  PRIORITAS,
  RECRUITER_PIC,
  ROLES,
  STATUS_KANDIDAT,
  SUMBER_KANDIDAT,
  TAHAP_DETAIL,
} from "./constants";
import {
  ACTION_LABEL,
  ACTION_TARGET,
  allowedActions,
  fulfillmentDateOf,
  realisasi,
  validateCandidate,
  type StatusAction,
} from "./recruitment";
import { notify } from "./notify";
import { saveMemo } from "./storage";
import { requestStatusLabel } from "./status-labels";

type User = NonNullable<CurrentUser>;
export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

class Fail extends Error {}
const fail = (m: string): never => {
  throw new Fail(m);
};

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, message: e.message };
    throw e;
  }
}

async function loadApprovedPr(tx: Tx, prId: string) {
  await tx.$executeRaw`SELECT 1 FROM "PrRequest" WHERE id = ${prId} FOR UPDATE`;
  const pr = await tx.prRequest.findUnique({ where: { id: prId }, include: { candidates: true } });
  if (!pr || pr.statusPersetujuan !== "DISETUJUI") fail("PR tidak ditemukan atau belum disetujui.");
  return pr!;
}

function requireRecruiter(user: User) {
  if (!user.isRecruiter) fail("Hanya rekruter yang dapat melakukan aksi ini.");
}

function requireAssigned(pr: PrRequest) {
  if (!pr.prioritas || !pr.recruiterPic)
    fail("Isi Prioritas dan Recruiter PIC terlebih dahulu (wajib).");
}

const opt = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// ---------------------------------------------------------------------------
// Data proses (prioritas, PIC, tahap, target, catatan)
// ---------------------------------------------------------------------------

const FIELD_LABEL: Record<string, string> = {
  prioritas: "Prioritas",
  recruiterPic: "Recruiter PIC",
  tahapDetail: "Tahap",
  targetStartDate: "Target Start Date",
  progressNote: "Progress Note",
  note: "Note",
};

export async function updateRecruitment(user: User, prId: string, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    requireRecruiter(user);
    const prioritas = opt(fd.get("prioritas"));
    const recruiterPic = opt(fd.get("recruiterPic"));
    const tahapDetail = opt(fd.get("tahapDetail")) || null;
    const targetRaw = opt(fd.get("targetStartDate"));
    const progressNote = opt(fd.get("progressNote")).slice(0, 1000) || null;
    const note = opt(fd.get("note")).slice(0, 1000) || null;

    if (!PRIORITAS.includes(prioritas as never)) fail("Prioritas wajib dipilih.");
    if (!RECRUITER_PIC.includes(recruiterPic as never)) fail("Recruiter PIC wajib dipilih.");
    if (tahapDetail && !TAHAP_DETAIL.includes(tahapDetail as never)) fail("Tahap tidak valid.");
    const targetStartDate = targetRaw ? parseIsoDate(targetRaw) : null;
    if (targetRaw && !targetStartDate) fail("Target Start Date tidak valid.");

    await prisma.$transaction(async (tx) => {
      const pr = await loadApprovedPr(tx, prId);
      const next = { prioritas, recruiterPic, tahapDetail, targetStartDate, progressNote, note };
      const fmt = (k: string, v: unknown) => (v instanceof Date ? fmtDate(v) : v == null || v === "" ? "—" : String(v));
      const changes = (Object.keys(next) as (keyof typeof next)[]).filter(
        (k) => fmt(k, pr[k]) !== fmt(k, next[k]),
      );
      if (!changes.length) return;
      if (tahapDetail === "Closed" && pr.statusPermintaan !== "FILLED" && pr.statusPermintaan !== "CANCELLED")
        fail('Tahap "Closed" diisi otomatis saat PR Filled atau Cancelled.');
      await tx.prRequest.update({ where: { id: prId }, data: next });
      for (const k of changes)
        await tx.prStatusHistory.create({
          data: {
            prId,
            aksi: "UPDATE",
            alasan: FIELD_LABEL[k],
            dari: k === "progressNote" || k === "note" ? null : fmt(k, pr[k]),
            ke: k === "progressNote" || k === "note" ? null : fmt(k, next[k]),
            olehNik: user.nik,
            olehNama: user.nama,
          },
        });
    });
  });
}

// ---------------------------------------------------------------------------
// Kandidat
// ---------------------------------------------------------------------------

export async function saveCandidate(user: User, prId: string, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    requireRecruiter(user);
    const id = opt(fd.get("id")) || null;
    const c = {
      nama: opt(fd.get("nama")).slice(0, 100),
      sumber: opt(fd.get("sumber")),
      status: opt(fd.get("status")),
      tanggalJoin: parseIsoDate(opt(fd.get("tanggalJoin"))),
    };
    if (!SUMBER_KANDIDAT.includes(c.sumber as never)) fail("Sumber kandidat wajib dipilih.");
    if (!STATUS_KANDIDAT.includes(c.status as never)) fail("Status kandidat wajib dipilih.");

    await prisma.$transaction(async (tx) => {
      const pr = await loadApprovedPr(tx, prId);
      requireAssigned(pr);
      if (pr.statusPermintaan === "FILLED" || pr.statusPermintaan === "CANCELLED")
        fail("PR sudah ditutup; kandidat tidak dapat diubah.");
      const others = pr.candidates.filter((x) => x.id !== id);
      const err = validateCandidate(c, {
        prReceivedDate: pr.prReceivedDate,
        kebutuhan: pr.kebutuhan,
        joinedOthers: realisasi(others),
      });
      if (err) fail(err);
      if (id) {
        const old = pr.candidates.find((x) => x.id === id) ?? fail("Kandidat tidak ditemukan.");
        await tx.prCandidate.update({ where: { id }, data: c });
        await tx.prStatusHistory.create({
          data: {
            prId,
            aksi: "KANDIDAT",
            alasan: `Ubah kandidat ${c.nama}`,
            dari: old!.status,
            ke: c.status,
            olehNik: user.nik,
            olehNama: user.nama,
          },
        });
      } else {
        await tx.prCandidate.create({ data: { ...c, prId } });
        await tx.prStatusHistory.create({
          data: { prId, aksi: "KANDIDAT", alasan: `Tambah kandidat ${c.nama}`, ke: c.status, olehNik: user.nik, olehNama: user.nama },
        });
      }
    });
  });
}

export async function deleteCandidate(user: User, prId: string, candidateId: string): Promise<ActionResult> {
  return guard(async () => {
    requireRecruiter(user);
    await prisma.$transaction(async (tx) => {
      const pr = await loadApprovedPr(tx, prId);
      if (pr.statusPermintaan === "FILLED" || pr.statusPermintaan === "CANCELLED")
        fail("PR sudah ditutup; kandidat tidak dapat diubah.");
      const c = pr.candidates.find((x) => x.id === candidateId) ?? fail("Kandidat tidak ditemukan.");
      await tx.prCandidate.delete({ where: { id: candidateId } });
      await tx.prStatusHistory.create({
        data: { prId, aksi: "KANDIDAT", alasan: `Hapus kandidat ${c!.nama}`, olehNik: user.nik, olehNama: user.nama },
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Status permintaan: Hold / Unhold / Cancel / Filled (Spec 10.3) — hanya rekruter
// ---------------------------------------------------------------------------

export async function changeStatus(user: User, prId: string, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    requireRecruiter(user);
    const aksi = opt(fd.get("aksi")) as StatusAction;
    const alasan = opt(fd.get("alasan")).slice(0, 500);
    const estimasi = parseIsoDate(opt(fd.get("estimasi")));
    const actionRequestId = opt(fd.get("actionRequestId")) || null;
    const today = todayWib();

    if (!ACTION_TARGET[aksi]) fail("Aksi tidak valid.");
    if (aksi === "HOLD") {
      if (!alasan) fail("Alasan Hold wajib diisi.");
      if (!estimasi) fail("Estimasi Selesai Hold wajib diisi.");
      if (estimasi! < today) fail("Estimasi Selesai Hold tidak boleh sebelum hari ini.");
    }
    if (aksi === "CANCEL" && !alasan) fail("Alasan Cancel wajib diisi.");

    // Upload memo di luar transaksi DB (I/O disk); bila transaksi gagal file yatim tidak berbahaya.
    const memo = await saveMemo(prId, (fd.get("memo") as File | null) ?? null);
    if (memo && !memo.ok) fail(memo.message);

    await prisma.$transaction(async (tx) => {
      const pr = await loadApprovedPr(tx, prId);
      requireAssigned(pr);
      if (!allowedActions(pr.statusPermintaan).includes(aksi))
        fail(`Tidak bisa ${ACTION_LABEL[aksi]} dari status ${requestStatusLabel(pr.statusPermintaan)}.`);

      const data: Partial<PrRequest> = { statusPermintaan: ACTION_TARGET[aksi] };
      if (aksi === "HOLD") Object.assign(data, { alasanHold: alasan, estimasiSelesaiHold: estimasi });
      if (aksi === "UNHOLD") Object.assign(data, { alasanHold: null, estimasiSelesaiHold: null });
      if (aksi === "CANCEL") Object.assign(data, { tahapDetail: "Closed" });
      if (aksi === "FILLED") {
        const real = realisasi(pr.candidates);
        if (real < 1) fail("Belum ada kandidat berstatus Joined.");
        if (real < pr.kebutuhan && !alasan)
          fail(`Realisasi (${real}) belum memenuhi Kebutuhan (${pr.kebutuhan}). Isi alasan bila tetap ditutup sebagai Filled.`);
        Object.assign(data, { fulfillmentDate: fulfillmentDateOf(pr.candidates), tahapDetail: "Closed" });
      }
      await tx.prRequest.update({ where: { id: prId }, data });
      await tx.prStatusHistory.create({
        data: {
          prId,
          aksi,
          dari: requestStatusLabel(pr.statusPermintaan),
          ke: requestStatusLabel(ACTION_TARGET[aksi]),
          olehNik: user.nik,
          olehNama: user.nama,
          alasan: aksi === "HOLD" ? `${alasan} (estimasi selesai ${fmtDate(estimasi)})` : alasan || null,
          fileMemo: memo?.ok ? memo.key : null,
        },
      });

      if (actionRequestId) {
        const req = await tx.prActionRequest.findFirst({ where: { id: actionRequestId, prId, status: "MENUNGGU" } });
        if (req)
          await tx.prActionRequest.update({
            where: { id: req.id },
            data: { status: "DIPROSES", diprosesOleh: user.nama, diprosesPada: new Date() },
          });
      }

      await notifyStatusChange(tx, pr, aksi, alasan);
    });
  });
}

async function notifyStatusChange(tx: Tx, pr: PrRequest, aksi: StatusAction, alasan: string) {
  const division = await tx.division.findUnique({ where: { kode: pr.divisiKode } });
  const niks = Array.from(new Set([pr.requesterNik, division?.kadivNik].filter(Boolean) as string[]));
  const recipients = await tx.employee.findMany({ where: { nik: { in: niks } } });
  const label = requestStatusLabel(ACTION_TARGET[aksi]);
  for (const to of recipients)
    await notify(tx, {
      prId: pr.id,
      to,
      jenis: `STATUS_${aksi}`,
      subjek: `PR ${pr.prNo} – status ${label}`,
      isi: `Status permintaan PR ${pr.prNo} (${pr.jobTitle}) berubah menjadi ${label}.${alasan ? `\nKeterangan: ${alasan}` : ""}`,
      path: `/pr/${pr.id}`,
    });
}

// ---------------------------------------------------------------------------
// Pengajuan Hold/Unhold/Cancel oleh pemohon → dieksekusi rekruter
// ---------------------------------------------------------------------------

export function canRequestAction(user: User, pr: PrRequest) {
  return pr.requesterNik === user.nik || (user.isKadiv && user.divisiKode === pr.divisiKode);
}

export async function createActionRequest(user: User, prId: string, fd: FormData): Promise<ActionResult> {
  return guard(async () => {
    const jenis = opt(fd.get("jenis"));
    const alasan = opt(fd.get("alasan")).slice(0, 500);
    const estimasi = parseIsoDate(opt(fd.get("estimasi")));
    if (!["HOLD", "UNHOLD", "CANCEL"].includes(jenis)) fail("Jenis pengajuan tidak valid.");
    if (!alasan) fail("Alasan wajib diisi.");
    if (jenis === "HOLD" && !estimasi) fail("Estimasi Selesai Hold wajib diisi.");

    const memo = await saveMemo(prId, (fd.get("memo") as File | null) ?? null);
    if (memo && !memo.ok) fail(memo.message);

    await prisma.$transaction(async (tx) => {
      const pr = await loadApprovedPr(tx, prId);
      if (!canRequestAction(user, pr)) fail("Anda tidak berhak mengajukan perubahan status PR ini.");
      if (!allowedActions(pr.statusPermintaan).includes(jenis as StatusAction))
        fail(`Pengajuan ${jenis} tidak sesuai status PR saat ini (${requestStatusLabel(pr.statusPermintaan)}).`);
      const open = await tx.prActionRequest.count({ where: { prId, status: "MENUNGGU" } });
      if (open) fail("Masih ada pengajuan yang menunggu diproses rekruter.");
      await tx.prActionRequest.create({
        data: {
          prId,
          jenis,
          alasan,
          estimasiSelesai: jenis === "HOLD" ? estimasi : null,
          fileMemo: memo?.ok ? memo.key : null,
          olehNik: user.nik,
          olehNama: user.nama,
        },
      });
      await tx.prStatusHistory.create({
        data: {
          prId,
          aksi: "PENGAJUAN",
          ke: `Pengajuan ${jenis}`,
          alasan,
          olehNik: user.nik,
          olehNama: user.nama,
          fileMemo: memo?.ok ? memo.key : null,
        },
      });
      const pic = pr.recruiterPic
        ? await tx.employee.findFirst({ where: { nama: pr.recruiterPic, roles: { has: ROLES.RECRUITER } } })
        : null;
      const recipients = pic ? [pic] : await tx.employee.findMany({ where: { roles: { has: ROLES.RECRUITER }, aktif: true } });
      for (const to of recipients)
        await notify(tx, {
          prId,
          to,
          jenis: "PENGAJUAN_STATUS",
          subjek: `[Perlu tindakan] Pengajuan ${jenis} untuk PR ${pr.prNo}`,
          isi: `${user.nama} mengajukan ${jenis} untuk PR ${pr.prNo} (${pr.jobTitle}).\nAlasan: ${alasan}`,
          path: `/pr/${prId}`,
        });
    });
  });
}

export async function rejectActionRequest(user: User, requestId: string, catatan: string): Promise<ActionResult> {
  return guard(async () => {
    requireRecruiter(user);
    catatan = catatan.trim().slice(0, 500);
    if (!catatan) fail("Alasan penolakan pengajuan wajib diisi.");
    await prisma.$transaction(async (tx) => {
      const req = await tx.prActionRequest.findUnique({ where: { id: requestId }, include: { pr: true } });
      if (!req || req.status !== "MENUNGGU") fail("Pengajuan tidak ditemukan atau sudah diproses.");
      await tx.prActionRequest.update({
        where: { id: requestId },
        data: { status: "DITOLAK", diprosesOleh: user.nama, diprosesPada: new Date(), catatanProses: catatan },
      });
      await tx.prStatusHistory.create({
        data: {
          prId: req!.prId,
          aksi: "PENGAJUAN_DITOLAK",
          ke: `Pengajuan ${req!.jenis} ditolak`,
          alasan: catatan,
          olehNik: user.nik,
          olehNama: user.nama,
        },
      });
      const to = await tx.employee.findUnique({ where: { nik: req!.olehNik } });
      await notify(tx, {
        prId: req!.prId,
        to,
        jenis: "PENGAJUAN_DITOLAK",
        subjek: `Pengajuan ${req!.jenis} PR ${req!.pr.prNo} tidak diproses`,
        isi: `Pengajuan ${req!.jenis} Anda untuk PR ${req!.pr.prNo} tidak diproses oleh rekruter.\nAlasan: ${catatan}`,
        path: `/pr/${req!.prId}`,
      });
    });
  });
}
