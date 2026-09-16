import type { PolicyDocument } from "./kinds.js";

/** Sandbox RFC-0001 document used when the host omits `policy`, and for missing `fs` / `db` kind slices. */
export function defaultPolicy(): PolicyDocument {
  return {
    spec: "anytool-policy",
    specVersion: "1",
    policyId: "anytool-default",
    issuedAt: "2026-09-16T00:00:00Z",
    environment: "sandbox",
    timeoutMs: 5000,
    kinds: {
      fs: {
        allowedRoots: ["/workspace"],
        blockedExtensions: [".env", ".pem", ".key", ".ssh"],
        readOnlyPaths: [],
        maxFileSizeBytes: 1_048_576,
      },
      db: {
        allowedTables: ["orders", "customers"],
        allowedActions: ["find", "insert", "update", "remove"],
        mutationLimitRows: 100,
        requireWhere: true,
      },
    },
  };
}
