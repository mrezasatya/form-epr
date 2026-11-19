import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Di Vercel + Neon, POSTGRES_PRISMA_URL = koneksi lewat pooler (pgbouncer=true) yang cocok untuk serverless.
// Di server internal / Docker cukup DATABASE_URL.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(process.env.POSTGRES_PRISMA_URL ? { datasourceUrl: process.env.POSTGRES_PRISMA_URL } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
