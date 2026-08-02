import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrate: {
    async adapter() {
      const url = new URL(process.env.DATABASE_URL!);
      return new PrismaMariaDb({
        host: url.hostname,
        port: Number(url.port || 3306),
        user: url.username,
        password: url.password,
        database: url.pathname.replace('/', ''),
        connectionLimit: 5,
      });
    },
  },
});
