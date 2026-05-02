import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prisma v7 ではここに DB URL を渡す必要があり、環境変数が必須なので `!` で型を絞る
    url: process.env.DATABASE_URL!,
  },
});