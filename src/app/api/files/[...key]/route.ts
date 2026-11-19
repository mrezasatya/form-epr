import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canViewPr } from "@/lib/pr-service";
import { memoPrId, readMemo } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Unduh memo/scan — hanya untuk pengguna yang berhak melihat PR terkait. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const key = (await params).key.join("/");
  const prId = memoPrId(key);
  const pr = prId ? await prisma.prRequest.findUnique({ where: { id: prId } }) : null;
  if (!pr || !(await canViewPr(user, pr))) return new Response("Not found", { status: 404 });
  const file = await readMemo(key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="memo-${pr.prNo?.replace(/\//g, "-") ?? pr.id}.${key.split(".").pop()}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
