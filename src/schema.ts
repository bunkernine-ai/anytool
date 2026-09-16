import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020";
import * as addFormatsMod from "ajv-formats";
import { BootError, PolicyDenied } from "./errors";
import type { CommandAst, PolicyDocument, StrongIntent } from "./kinds";

const addFormats = (addFormatsMod as unknown as { default: (ajv: Ajv2020) => void }).default;

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), "..", "rfc", "schemas");

function loadSchema(name: string): object {
  return JSON.parse(readFileSync(join(schemaDir, name), "utf8")) as object;
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
});
addFormats(ajv);

const policyValidate = ajv.compile(loadSchema("policy.schema.json"));
const intentValidate = ajv.compile(loadSchema("intent.schema.json"));
const astValidate = ajv.compile(loadSchema("ast.schema.json"));

function formatErrors(errors: { instancePath: string; message?: string }[] | null | undefined): string {
  return (errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ");
}

export function parsePolicyDocument(raw: unknown): PolicyDocument {
  if (!policyValidate(raw)) {
    throw new BootError(`RFC-0001 schema rejected: ${formatErrors(policyValidate.errors)}`);
  }
  return raw as PolicyDocument;
}

export function assertStrongIntent(raw: unknown): StrongIntent {
  if (!intentValidate(raw)) {
    throw new PolicyDenied(`RFC-0002 intent rejected: ${formatErrors(intentValidate.errors)}`);
  }
  return raw as StrongIntent;
}

export function assertCommandAst(raw: unknown): CommandAst {
  if (!astValidate(raw)) {
    throw new PolicyDenied(`RFC-0003 AST rejected: ${formatErrors(astValidate.errors)}`);
  }
  return raw as CommandAst;
}
