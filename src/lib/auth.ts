import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { httpDb } from "@/db";
import * as schema from "@/db/schema";
import { appleClientSecret } from "@/lib/apple-secret";
import { APIError } from "better-auth/api";
import { checkEmail } from "@/lib/email-check";
import { mailServers } from "@/lib/email-dns";
import { appleEnabled, emailEnabled, env, googleEnabled, microsoftEnabled } from "@/lib/env";
import { nameFromEmail } from "@/lib/mutations";
import { sendMail } from "@/server/email";

const vercelOrigins = [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL, "penandpaper-app.vercel.app", "penandpaper-three.vercel.app"]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);

const appleSecret = appleEnabled
  ? await appleClientSecret({ clientId: env.APPLE_CLIENT_ID!, teamId: env.APPLE_TEAM_ID!, keyId: env.APPLE_KEY_ID!, privateKey: env.APPLE_PRIVATE_KEY! })
  : null;

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL ?? vercelOrigins[0],
  // Apple answers with a form POST from its own site, which must be allowed back in.
  trustedOrigins: [...vercelOrigins, ...(appleEnabled ? ["https://appleid.apple.com"] : [])],
  database: drizzleAdapter(httpDb, { provider: "pg", usePlural: true, schema }),
  // Email + password works with no email service. Nothing checks the address
  // yet, so a password account counts as unverified (see accountLinking).
  // With an email service, a new password account must click a link before it
  // can sign in. Without one, no link could arrive, so that waits until
  // RESEND_API_KEY and EMAIL_FROM are set; the address checks below always run.
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: !emailEnabled, requireEmailVerification: emailEnabled },
  emailVerification: {
    sendOnSignUp: emailEnabled,
    sendOnSignIn: emailEnabled,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Confirm your email for Pen & Paper",
        heading: "One tap to confirm it's you",
        lines: ["Confirm this address and your paper is ready. The link works for 24 hours.", "If you didn't sign up, ignore this email."],
        cta: { label: "Confirm my email", url },
      });
    },
  },
  // Google, Apple or Microsoft may join an existing account with the same
  // address only when that address was verified (an email link). Never a
  // password account whose email nobody checked: it could belong to whoever
  // typed someone else's address.
  account: { accountLinking: { enabled: true, trustedProviders: ["google", "apple", "microsoft"], requireLocalEmailVerified: true } },
  socialProviders: {
    ...(googleEnabled ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } } : {}),
    ...(appleEnabled ? { apple: { clientId: env.APPLE_CLIENT_ID!, clientSecret: appleSecret! } } : {}),
    // "common": personal Outlook/Hotmail accounts and work or school accounts alike.
    ...(microsoftEnabled ? { microsoft: { clientId: env.MICROSOFT_CLIENT_ID!, clientSecret: env.MICROSOFT_CLIENT_SECRET!, tenantId: "common", prompt: "select_account" as const } } : {}),
  },
  // The role rides on the session so pages can check it, but nobody can set it
  // from the browser (input: false): only `npm run set-role` changes it.
  user: { additionalFields: { role: { type: "string", required: false, defaultValue: "user", input: false } } },
  databaseHooks: {
    user: {
      create: {
        // Every new account, however it signs up: refuse addresses that can't
        // receive mail (typos, throwaway inboxes, domains with no mail server).
        // Email-link sign-ups arrive without a name.
        before: async (user) => {
          const problem = await checkEmail(user.email, mailServers);
          if (problem) throw new APIError("BAD_REQUEST", { message: problem.message, code: "EMAIL_UNDELIVERABLE" });
          return { data: { ...user, name: user.name?.trim() || nameFromEmail(user.email) } };
        },
      },
    },
  },
  // In the database, because an in-memory count is per serverless function.
  rateLimit: { storage: "database" },
  advanced: { database: { generateId: "uuid" } },
  session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        const sent = await sendMail({
          to: email,
          subject: "Your Pen & Paper sign-in link",
          heading: "Here's your sign-in link",
          lines: ["Tap the button to sign in. The link works once and expires in 15 minutes.", "If you didn't ask for it, ignore this email."],
          cta: { label: "Sign in to Pen & Paper", url },
        });
        if (!sent) throw new Error("Couldn't send the sign-in email. Use another way to sign in, or try again in a minute.");
      },
    }),
    // Must stay last: lets server code set the session cookie.
    nextCookies(),
  ],
});
