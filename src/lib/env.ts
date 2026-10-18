import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url({ message: "DATABASE_URL must be a Postgres connection string. See .env.example." }),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
});
