import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = new URL(connectionString);
const localPrisma = ["localhost", "127.0.0.1"].includes(databaseUrl.hostname) && databaseUrl.port === "51214";

const adapter = new PrismaPg({
  connectionString,
  // Local Prisma Postgres is single-connection; queue parallel relation queries.
  max: localPrisma ? 1 : 10,
  idleTimeoutMillis: localPrisma ? 1000 : 10000,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

globalForPrisma.prisma = prisma;
