// Prints a fresh VAPID key pair for web push (Thought of the Day notifications).
// Put them in Vercel → Settings → Environment Variables (Production), then redeploy:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (the public one; browsers see it)
//   VAPID_PRIVATE_KEY             (keep it secret; mark it Sensitive)
// Changing the pair later means every device has to turn notifications on again.
import { createECDH } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString("base64url")}`);
