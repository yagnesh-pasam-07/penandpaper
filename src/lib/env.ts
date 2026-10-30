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
  /** Sign in with Apple: the Services ID, and the .p8 key with its ids (the client secret is made from them). */
  APPLE_CLIENT_ID: optional,
  APPLE_TEAM_ID: optional,
  APPLE_KEY_ID: optional,
  APPLE_PRIVATE_KEY: optional,
  /** Sign in with Microsoft (personal, work and school accounts). */
  MICROSOFT_CLIENT_ID: optional,
  MICROSOFT_CLIENT_SECRET: optional,
  RESEND_API_KEY: optional,
  /** Brevo (free: 300 emails a day, sends to anyone after you confirm one sender address; no domain needed). */
  BREVO_API_KEY: optional,
  /** e.g. "Pen & Paper <hello@yourdomain.com>"; the domain must be verified in Resend. */
  EMAIL_FROM: optional,
  /** The second lock on /studio (the first is the admin role). Unset, Studio is switched off. */
  STUDIO_PASSCODE: optional,
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

/** Which service sends email: Brevo when its key is set, else Resend, else none. EMAIL_FROM is the sender either way. */
export const emailProvider: "brevo" | "resend" | null = env.EMAIL_FROM ? (env.BREVO_API_KEY ? "brevo" : env.RESEND_API_KEY ? "resend" : null) : null;
export const emailEnabled = emailProvider !== null;
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const appleEnabled = Boolean(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
export const microsoftEnabled = Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
