import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BootError,
  createAnyTool,
  defaultPolicy,
  fakePayment,
  localFs,
  memoryFs,
  postgres,
  PolicyDenied,
  sqlite,
  type DbCommand,
} from "../src/index.ts";

describe("policy fallback", () => {
  it("uses defaultPolicy when the host omits policy", async () => {
    const at = createAnyTool({
      drivers: [memoryFs("/workspace"), sqlite()],
    });
    expect(at.policy.policyId).toBe(defaultPolicy().policyId);
    const out = await at.run({
      code: `return files.execute({ action: "write", path: "/workspace/a.json", body: { n: 1 } });`,
    });
    expect(out.ok).toBe(true);
  });

  it("fills missing fs/db slices from default when user policy omits them", async () => {
    const at = createAnyTool({
      policy: {
        spec: "anytool-policy",
        specVersion: "1",
        policyId: "user-partial",
        issuedAt: "2026-09-16T12:00:00Z",
        environment: "sandbox",
        kinds: {
          logger: { allowedLevels: ["info"], maxPayloadBytes: 100, redactKeys: [] },
        },
      },
      drivers: [memoryFs("/workspace"), sqlite()],
    });
    expect(at.policy.kinds.fs?.allowedRoots).toEqual(["/workspace"]);
    expect(at.policy.kinds.db?.allowedTables).toEqual(["orders", "customers"]);
  });

  it("does not invent payment policy if the host omitted it", () => {
    expect(() =>
      createAnyTool({
        drivers: [memoryFs("/workspace"), fakePayment("acct")],
      }),
    ).toThrow(BootError);
  });
});

describe("fs driver", () => {
  it("round-trips write, list, read, remove in memory", async () => {
    const at = createAnyTool({ drivers: [memoryFs("/workspace")] });
    await at.run({
      code: `return files.execute({ action: "write", path: "/workspace/dir/a.json", body: { a: 1 } });`,
    });
    const listed = await at.run({
      code: `return files.execute({ action: "list", path: "/workspace" });`,
    });
    expect(listed.data).toEqual(expect.arrayContaining([expect.stringMatching(/a\.json/)]));
    const read = await at.run({
      code: `return files.execute({ action: "read", path: "/workspace/dir/a.json" });`,
    });
    expect(read.data).toBe(JSON.stringify({ a: 1 }));
    const removed = await at.run({
      code: `return files.execute({ action: "remove", path: "/workspace/dir" });`,
    });
    expect(removed.data).toMatchObject({ removed: 1 });
  });

  it("lists a real directory via localFs", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "anytool-fs-"));
    writeFileSync(path.join(dir, "x.txt"), "hi");
    const at = createAnyTool({
      policy: {
        ...defaultPolicy(),
        kinds: {
          ...defaultPolicy().kinds,
          fs: { allowedRoots: [dir], blockedExtensions: [], readOnlyPaths: [], maxFileSizeBytes: 1024 },
        },
      },
      drivers: [localFs(dir)],
    });
    const listed = await at.run({
      code: `return files.execute({ action: "list", path: input.dir });`,
      input: { dir },
    });
    expect(listed.data).toEqual(expect.arrayContaining(["x.txt"]));
  });

  it("jails paths to the driver root", async () => {
    const at = createAnyTool({ drivers: [memoryFs("/workspace")] });
    await expect(
      at.run({
        code: `return files.execute({ action: "read", path: "/etc/passwd" });`,
      }),
    ).rejects.toBeInstanceOf(PolicyDenied);
  });
});

describe("db command DSL", () => {
  it("describes find/insert/update/remove without SQL", async () => {
    const at = createAnyTool({ drivers: [sqlite()] });
    await at.run({
      code: `return db.execute({ action: "insert", table: "orders", row: { id: "1", country: "BD", total: 10 } });`,
    });
    const found = await at.run({
      code: `return db.execute({ action: "find", table: "orders", where: { country: "BD" }, columns: ["id", "total"], limit: 100 });`,
    });
    expect(found.data).toEqual([{ id: "1", total: 10 }]);
    const updated = await at.run({
      code: `return db.execute({ action: "update", table: "orders", where: { id: "1" }, row: { total: 20 }, limit: 1 });`,
    });
    expect(updated.data).toEqual({ updated: 1 });
    const removed = await at.run({
      code: `return db.execute({ action: "remove", table: "orders", where: { id: "1" }, limit: 1 });`,
    });
    expect(removed.data).toEqual({ removed: 1 });
  });

  it("passes the same command to a postgres binding", async () => {
    const seen: DbCommand[] = [];
    const at = createAnyTool({
      policy: {
        ...defaultPolicy(),
        kinds: {
          ...defaultPolicy().kinds,
          db: {
            allowedTables: ["customers"],
            allowedActions: ["find"],
            mutationLimitRows: 100,
            requireWhere: true,
          },
        },
      },
      drivers: [
        postgres(async (command) => {
          seen.push(command);
          return [];
        }),
      ],
    });
    await at.run({
      code: `return db.execute({ action: "find", table: "customers", where: { country: "BD" }, limit: 100 });`,
    });
    expect(seen[0]).toEqual({
      action: "find",
      table: "customers",
      where: { country: "BD" },
      columns: undefined,
      limit: 100,
      row: undefined,
    });
  });

  it("refuses unscoped remove", async () => {
    const at = createAnyTool({ drivers: [sqlite()] });
    await expect(
      at.run({
        code: `return db.execute({ action: "remove", table: "orders" });`,
      }),
    ).rejects.toBeInstanceOf(PolicyDenied);
  });
});
