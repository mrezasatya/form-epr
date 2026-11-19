import { getCurrentUser } from "@/lib/auth/session";
import { buildTemplate } from "@/lib/employee-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdminHr) return new Response("Forbidden", { status: 403 });
  return new Response(new Uint8Array(await buildTemplate()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template_master_karyawan.xlsx"',
    },
  });
}
