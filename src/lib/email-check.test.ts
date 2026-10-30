import { describe, expect, it } from "vitest";
import { checkEmail, emailProblem } from "./email-check";

describe("emailProblem", () => {
  it("accepts ordinary addresses", () => {
    for (const e of ["asha@gmail.com", "Yagnesh@Tilicho.in", "a.b+c@sub.company.co.uk"]) expect(emailProblem(e)).toBeNull();
  });
  it("catches a broken shape", () => {
    for (const e of ["asha", "asha@", "asha@gmail", "a b@gmail.com", "@gmail.com"]) expect(emailProblem(e)?.reason).toBe("shape");
  });
  it("suggests the right domain for a typo", () => {
    expect(emailProblem("asha@gmial.com")).toMatchObject({ reason: "typo", suggestion: "asha@gmail.com" });
    expect(emailProblem("asha@gmail.con")?.suggestion).toBe("asha@gmail.com");
  });
  it("refuses throwaway and reserved domains", () => {
    expect(emailProblem("x@mailinator.com")?.reason).toBe("disposable");
    expect(emailProblem("x@example.com")?.reason).toBe("reserved");
    expect(emailProblem("x@shop.test")?.reason).toBe("reserved");
  });
});

describe("checkEmail", () => {
  it("refuses a domain with no mail servers", async () => {
    expect((await checkEmail("asha@nomailhere.xyz", async () => 0))?.reason).toBe("no-mail");
  });
  it("lets it through when DNS can't be asked", async () => {
    expect(await checkEmail("asha@company.in", async () => null)).toBeNull();
    expect(
      await checkEmail("asha@company.in", async () => {
        throw new Error("dns down");
      }),
    ).toBeNull();
  });
});
