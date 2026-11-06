import { z } from "zod";
import { MAX_INDENT } from "@/modules/drop/logic";

/** A written line's place in a to-do list: the list (its first line's id, or null to leave it), where in it, and how far in. */
export const listBody = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]{6,40}$/)
    .nullable(),
  pos: z.number().min(-1e9).max(1e9).nullable(),
  indent: z.number().int().min(0).max(MAX_INDENT),
});
