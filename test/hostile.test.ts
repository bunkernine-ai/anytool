import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createAnyTool, fakePayment, loggerDriver, sqlite, memoryFs, PolicyDenied } from "../src/index.ts";

const policy = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "rfc", "examples", "policy", "valid-sandbox.json"), "utf8"),
);

function tool() {
  return createAnyTool({
    policy,
    drivers: [memoryFs("/workspace"), sqlite(), fakePayment("acct_demo"), loggerDriver()],
  });
}

describe("hostile suite", () => {
  it("denies path traversal", async () => {
    await expect(
      tool().run({
        code: `return files.execute({ action: "read", path: "/etc/passwd" });`,
      }),
    ).rejects.toMatchObject({ reason: expect.stringMatching(/outside allowedRoots/) });
  });

  it("denies SQL strings in code", async () => {
    await expect(
      tool().run({
        code: `const q = "DROP TABLE users"; return db.execute({ action: "find", table: "orders", where: { id: "1" }, limit: 1 });`,
      }),
    ).rejects.toBeInstanceOf(PolicyDenied);
  });

  it("denies charge over cap with no driver side effect", async () => {
    const at = tool();
    await expect(
      at.run({
        code: `return payment.execute({ action: "charge", amountCents: 5001, currency: "usd", purpose: "invoice", invoiceId: "x" });`,
      }),
    ).rejects.toBeInstanceOf(PolicyDenied);
    expect(at.auditLog.at(-1)?.allowed).toBe(false);
  });

  it("denies calling an unbound SDK name", async () => {
    const at = createAnyTool({
      drivers: [memoryFs("/workspace"), sqlite()],
    });
    await expect(
      at.run({
        code: `return payment.execute({ action: "charge", amountCents: 1, currency: "usd", purpose: "invoice", invoiceId: "x" });`,
      }),
    ).rejects.toBeInstanceOf(PolicyDenied);
  });

  it("denies amount over policy cap", async () => {
    await expect(
      tool().run({
        code: `return payment.execute({ action: "charge", amountCents: 4000, currency: "usd", purpose: "invoice", invoiceId: "x" });`,
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      tool().run({
        code: `return payment.execute({ action: "charge", amountCents: 5001, currency: "usd", purpose: "invoice", invoiceId: "x" });`,
      }),
    ).rejects.toMatchObject({ reason: expect.stringMatching(/cap/) });
  });

  it("denies process and eval", async () => {
    await expect(
      tool().run({
        code: `return process.env;`,
      }),
    ).rejects.toBeInstanceOf(PolicyDenied);
    await expect(
      tool().run({
        code: `return eval("1");`,
      }),
    ).rejects.toBeInstanceOf(PolicyDenied);
  });

  it("does not inject ctx or a host execute global", async () => {
    const out = await tool().run({
      code: `return { ctx: typeof ctx, execute: typeof execute, files: typeof files.execute };`,
    });
    expect(out.data).toEqual({ ctx: "undefined", execute: "undefined", files: "function" });
  });
});
