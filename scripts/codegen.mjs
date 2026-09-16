import { compileFromFile } from "json-schema-to-typescript";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "generated");
mkdirSync(outDir, { recursive: true });

const banner = "/* eslint-disable */\n/** GENERATED from rfc/schemas — do not edit by hand. RFC-0001/0002/0003 are normative. */\n\n";

async function one(name, file) {
  const ts = await compileFromFile(join(root, "rfc", "schemas", file), {
    additionalProperties: false,
    bannerComment: "",
    cwd: join(root, "rfc", "schemas"),
  });
  writeFileSync(join(outDir, name), banner + ts);
}

await one("policy.ts", "policy.schema.json");
await one("intent.ts", "intent.schema.json");
await one("ast.ts", "ast.schema.json");
console.log("codegen ok");
