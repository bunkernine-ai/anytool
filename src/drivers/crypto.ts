import { createHash, createHmac, randomBytes } from "node:crypto";
import { PolicyDenied } from "../errors.js";
import { defineDriver, ok, type Driver } from "./define.js";

export function cryptoDriver(): Driver {
  return defineDriver({
    kind: "crypto",
    id: "crypto",
    async execute(ast) {
      const data = String(ast.arguments.data ?? "");
      const alg = String(ast.arguments.algorithm ?? "sha256");
      if (ast.action === "HASH") return ok(createHash(alg).update(data).digest("hex"));
      if (ast.action === "HMAC") return ok(createHmac(alg, "anytool-hmac").update(data).digest("hex"));
      if (ast.action === "RANDOM") return ok(randomBytes(Number(ast.arguments.bytes ?? 16)).toString("hex"));
      if (ast.action === "SIGN" || ast.action === "VERIFY") {
        return ok(createHmac("sha256", "anytool-hmac").update(data).digest("hex"));
      }
      throw new PolicyDenied("crypto unknown action");
    },
  });
}
