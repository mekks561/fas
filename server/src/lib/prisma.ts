import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma || new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[Database] MySQL connection established successfully');
  } catch (error) {
    console.error('[Database] MySQL connection failed:', error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('[Database] MySQL connection closed');
  } catch (error) {
    console.error('[Database] Error closing MySQL connection:', error);
  }
}
