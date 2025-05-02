import { PrismaClient } from "@prisma/client";

declare global {
    // para evitar múltiples instancias en hot-reload de Next.js
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

export const prisma =
    global.__prisma ??
    new PrismaClient({
        log:["query", "info", "warn", "error"],
    });

if (process.env.NODE_ENV !== "production") {
    global.__prisma = prisma;
}