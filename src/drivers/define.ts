import type { CommandAst, CoreKind } from "../kinds.js";

export type DriverResult = {
  ok: true;
  data: unknown;
};

export type Driver = {
  kind: CoreKind;
  id: string;
  execute: (ast: CommandAst) => Promise<DriverResult>;
};

export function defineDriver<K extends CoreKind>(spec: {
  kind: K;
  id?: string;
  execute: (ast: CommandAst) => Promise<DriverResult>;
}): Driver {
  return {
    kind: spec.kind,
    id: spec.id ?? spec.kind,
    execute: spec.execute,
  };
}

export function ok(data: unknown): DriverResult {
  return { ok: true, data };
}
