import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth's own endpoints: sign-in links, Google's callback, sign-out.
export const { GET, POST } = toNextJsHandler(auth);
