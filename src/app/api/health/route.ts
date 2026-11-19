import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Endpoint pemeriksaan kesehatan untuk monitoring IT / Docker healthcheck. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_error" }, { status: 503 });
  }
}
