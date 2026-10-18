import "server-only";
import { z } from "zod";

const optional = z.string().trim().min(1).optional().catch(undefined);

const schema = z.object({
  DATABASE_URL: z.url({ message: "DATABASE_URL must be a Postgres connection string. See .env.example." }),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters. See .env.example."),
  /** The address the app is served from. Vercel previews may leave it unset. */
  BETTER_AUTH_URL: z.url().optional().catch(undefined),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  RESEND_API_KEY: optional,
  /** e.g. "Pen & Paper <hello@yourdomain.com>"; the domain must be verified in Resend. */
  EMAIL_FROM: optional,
  /** Shown on the privacy page when set. */
  SUPPORT_EMAIL: optional,
  VERCEL_URL: optional,
  VERCEL_BRANCH_URL: optional,
  VERCEL_PROJECT_PRODUCTION_URL: optional,
});

export const env = schema.parse(process.env);

/** Where links in emails point. */
export const appUrl =
  env.BETTER_AUTH_URL ??
  (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ??
  (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:3000");

export const emailEnabled = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
