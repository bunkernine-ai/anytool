import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BootError,
  createAnyTool,
  fakePayment,
  loggerDriver,
  sqlite,
  memoryFs,
  PolicyDenied,
  s3ShapedFs,
  stripeShapedPayment,
  type CommandAst,
  type Driver,
} from "../src/index.ts";

const policy = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "rfc", "examples", "policy", "valid-sandbox.json"), "utf8"),
);

function tool() {
  return createAnyTool({
    policy,
    drivers: [memoryFs("/workspace"), sqlite(), fakePayment("acct_demo"), loggerDriver()],
  });
}

describe("createAnyTool boot", () => {
  it("throws if a bound driver has no policy slice", () => {
    expect(() =>
      createAnyTool({
        policy,
        drivers: [
          memoryFs("/workspace"),
          {
            kind: "shell",
            id: "shell",
            execute: async () => ({ ok: true as const, data: null }),
          },
        ],
      }),
    ).toThrow(BootError);
  });

  it("rejects unsigned production policy", () => {
    expect(() =>
      createAnyTool({
        policy: { ...policy, environment: "production" },
        drivers: [memoryFs("/workspace")],
      }),
    ).toThrow(/unsigned policy/);
  });

  it("injects capability SDKs and command shapes", () => {
    const text = tool().instructions();
    expect(text).toContain("policyId: sandbox-demo");
    expect(text).toContain("Injected capability SDKs");
    expect(text).toContain("files.execute");
    expect(text).toContain("db.execute");
    expect(text).toContain("payment.execute");
    expect(text).toContain("host context owns the backend");
    expect(text).toContain("maxAmountCents");
    expect(text).not.toMatch(/sk_live|STRIPE_KEY/);
    expect(text).not.toContain("ctx.db.find");
  });
});

describe("run", () => {
  it("writes via files.execute without outer StrongIntent", async () => {
    const at = tool();
    const out = await at.run({
      code: `return files.execute({ action: "write", path: "/workspace/out.json", body: { a: 1 } });`,
    });
    expect(out.ok).toBe(true);
    expect(out.ast?.module).toBe("fs");
    expect(out.ast?.action).toBe("WRITE");
    expect(out.audit.allowed).toBe(true);
  });

  it("charges under cap", async () => {
    const out = await tool().run({
      code: `return payment.execute({ action: "charge", amountCents: 2000, currency: "usd", purpose: "invoice", invoiceId: "ord_1" });`,
    });
    expect(out.data).toMatchObject({ amountCents: 2000, merchantId: "acct_demo" });
  });

  it("finds rows without SQL", async () => {
    const out = await tool().run({
      code: `return db.execute({ action: "find", table: "orders", where: { id: "ord_1" }, limit: 1 });`,
    });
    expect(out.ast?.action).toBe("FIND");
    expect(out.data).toEqual([]);
  });

  it("same fs command works on s3-shaped community driver", async () => {
    const at = createAnyTool({
      policy,
      drivers: [s3ShapedFs("workspace"), sqlite(), fakePayment("acct_demo"), loggerDriver()],
    });
    const out = await at.run({
      code: `return files.execute({ action: "write", path: "/workspace/x.json", body: { ok: true } });`,
    });
    expect(out.ast?.module).toBe("fs");
  });

  it("stripe-shaped payment uses the same CHARGE AST", async () => {
    const at = createAnyTool({
      policy,
      drivers: [memoryFs("/workspace"), sqlite(), stripeShapedPayment("acct_demo"), loggerDriver()],
    });
    const out = await at.run({
      code: `return payment.execute({ action: "charge", amountCents: 100, currency: "usd", purpose: "invoice", invoiceId: "inv" });`,
    });
    expect(out.ast?.action).toBe("CHARGE");
  });

  it("adapters require code and describe SDKs", () => {
    const t = tool().asAiSdkTool();
    expect(t.inputSchema).toMatchObject({ required: ["code"] });
    expect(t.description).toContain("execute");
    expect(t.description).toContain("files");
    expect(t.description).not.toContain("StrongIntent");
    const lc = tool().asLangChainTool();
    expect(lc.name).toBe("anytool");
    expect(lc.schema).toEqual(t.inputSchema);
  });

  it("unknown action on a bound SDK denies with no driver call", async () => {
    const inner = sqlite();
    let driverCalls = 0;
    const spy: Driver = {
      kind: inner.kind,
      id: inner.id,
      async execute(ast: CommandAst) {
        driverCalls += 1;
        return inner.execute(ast);
      },
    };
    const at = createAnyTool({
      policy,
      drivers: [memoryFs("/workspace"), spy, fakePayment("acct_demo"), loggerDriver()],
    });
    await expect(
      at.run({
        code: `return db.execute({ action: "drop", table: "orders" });`,
      }),
    ).rejects.toBeInstanceOf(PolicyDenied);
    expect(driverCalls).toBe(0);
  });

  it("unbound SDK is not in the VM", async () => {
    const at = createAnyTool({
      drivers: [memoryFs("/workspace"), sqlite()],
    });
    const out = await at.run({
      code: `return { files: typeof files, db: typeof db, payment: typeof payment, http: typeof http };`,
    });
    expect(out.data).toEqual({ files: "object", db: "object", payment: "undefined", http: "undefined" });
  });

  it("one generated function may db.execute then files.execute", async () => {
    const at = tool();
    const out = await at.run({
      code: `
        const rows = await db.execute({ action: "find", table: "orders", where: { id: "ord_1" }, limit: 1 });
        await files.execute({ action: "write", path: "/workspace/out.json", body: rows });
        return rows;
      `,
    });
    expect(out.data).toEqual([]);
    expect(out.ast?.module).toBe("fs");
    expect(out.ast?.action).toBe("WRITE");
  });
});

describe("policy denials", () => {
  it("denies missing code", async () => {
    await expect(tool().run({ code: undefined as unknown as string })).rejects.toBeInstanceOf(PolicyDenied);
  });

  it("denies extra command keys", async () => {
    await expect(
      tool().run({
        code: `return files.execute({ action: "read", path: "/workspace/a", sql: "SELECT 1" });`,
      }),
    ).rejects.toBeInstanceOf(PolicyDenied);
  });
});
