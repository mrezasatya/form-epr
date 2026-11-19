"use client";

import { retryFailedEmailsAction, sendTestEmailAction } from "@/app/actions/admin";
import { AdminForm } from "./AdminForm";

export function TestEmailForm({ defaultTo }: { defaultTo: string }) {
  return (
    <AdminForm action={sendTestEmailAction} submitLabel="Kirim email uji" className="flex flex-wrap items-end gap-2" inline>
      <input name="to" type="email" defaultValue={defaultTo} className="input min-w-[16rem] flex-1" placeholder="alamat@perusahaan.co.id" required />
    </AdminForm>
  );
}

export function RetryFailedForm() {
  return <AdminForm action={retryFailedEmailsAction} submitLabel="Kirim ulang semua yang gagal" className="" inline>{null}</AdminForm>;
}
