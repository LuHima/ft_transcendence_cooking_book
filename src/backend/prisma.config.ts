import "dotenv/config";
<<<<<<< HEAD
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
//    seed: "tsx prisma/seed.ts",
  },
/*   datasource: {
    url: process.env.DATABASE_URL,
  }, */
=======
import { defineConfig, env } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
>>>>>>> c671b6e7bd3ec97acbb6bb6039e1b4a9a9b2b1a9
});