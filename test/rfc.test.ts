import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BootError, parsePolicyDocument } from "../src/index.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "rfc", "examples", "policy");

function load(name: string): unknown {
  return JSON.parse(readFileSync(join(dir, name), "utf8"));
}

describe("RFC-0001 policy documents", () => {
  it("accepts valid-sandbox.json", () => {
    const doc = parsePolicyDocument(load("valid-sandbox.json"));
    expect(doc.spec).toBe("anytool-policy");
    expect(doc.kinds.payment?.maxAmountCents).toBe(5000);
  });

  it("rejects unknown specVersion", () => {
    expect(() => parsePolicyDocument(load("invalid-spec-version.json"))).toThrow(BootError);
  });

  it("rejects unknown kind keys", () => {
    expect(() => parsePolicyDocument(load("invalid-unknown-kind.json"))).toThrow(BootError);
  });

  it("rejects payment slice without maxAmountCents", () => {
    expect(() => parsePolicyDocument(load("invalid-payment-no-cap.json"))).toThrow(BootError);
  });
});
