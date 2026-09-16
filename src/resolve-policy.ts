import type { CoreKind, PolicyDocument } from "./kinds.js";
import { defaultPolicy } from "./default-policy.js";
import { parsePolicyDocument } from "./schema.js";

const FALLBACK_KINDS = ["fs", "db"] as const;

/**
 * Host policy wins. If `policy` is omitted, use the built-in sandbox document.
 * If the host document omits `fs` or `db` while those drivers are bound, fill those slices from the default.
 * Other kinds have no fallback (fail closed).
 */
export function resolvePolicy(raw: unknown | undefined, boundKinds: Iterable<CoreKind>): PolicyDocument {
  const fallback = defaultPolicy();
  const bound = [...boundKinds];
  if (raw === undefined) {
    return parsePolicyDocument(fallback);
  }
  const user = parsePolicyDocument(raw);
  const kinds: PolicyDocument["kinds"] = { ...user.kinds };
  for (const kind of FALLBACK_KINDS) {
    if (bound.includes(kind) && !kinds[kind]) {
      kinds[kind] = fallback.kinds[kind];
    }
  }
  return parsePolicyDocument({ ...user, kinds });
}
