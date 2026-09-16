import { lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PolicyDenied } from "../errors.js";
import { isPathInsideRoot } from "../evaluate.js";
import { defineDriver, ok, type Driver } from "./define.js";

function jail(target: string, root: string): string {
  const resolved = path.resolve(target);
  if (!isPathInsideRoot(resolved, [root])) throw new PolicyDenied("fs execute path jail");
  return resolved;
}

function rejectSymlink(p: string): void {
  try {
    if (lstatSync(p).isSymbolicLink()) throw new PolicyDenied("fs symlink denied");
  } catch (err) {
    if (err instanceof PolicyDenied) throw err;
  }
}

export function memoryFs(root = "/workspace"): Driver {
  const files = new Map<string, string>();
  const rootResolved = path.resolve(root);
  return defineDriver({
    kind: "fs",
    id: "memory-fs",
    async execute(ast) {
      const p = jail(String(ast.arguments.path ?? ast.target), rootResolved);
      if (ast.action === "WRITE") {
        const body = typeof ast.arguments.body === "string" ? ast.arguments.body : JSON.stringify(ast.arguments.body ?? "");
        files.set(p, body);
        return ok({ bytesWritten: Buffer.byteLength(body) });
      }
      if (ast.action === "READ") {
        const v = files.get(p);
        if (v === undefined) throw new PolicyDenied("fs not found");
        return ok(v);
      }
      if (ast.action === "LIST") {
        const names = [...files.keys()]
          .filter((k) => k === p || k.startsWith(p + path.sep))
          .map((k) => path.relative(rootResolved, k) || ".");
        return ok(names);
      }
      if (ast.action === "REMOVE") {
        let n = 0;
        for (const k of [...files.keys()]) {
          if (k === p || k.startsWith(p + path.sep)) {
            files.delete(k);
            n += 1;
          }
        }
        return ok({ removed: n });
      }
      throw new PolicyDenied("fs unknown action");
    },
  });
}

export function localFs(root: string): Driver {
  const rootResolved = path.resolve(root);
  return defineDriver({
    kind: "fs",
    id: "local-fs",
    async execute(ast) {
      const p = jail(String(ast.arguments.path ?? ast.target), rootResolved);
      if (ast.action === "WRITE") {
        rejectSymlink(path.dirname(p));
        mkdirSync(path.dirname(p), { recursive: true });
        const body = typeof ast.arguments.body === "string" ? ast.arguments.body : JSON.stringify(ast.arguments.body ?? "");
        writeFileSync(p, body);
        return ok({ bytesWritten: Buffer.byteLength(body) });
      }
      if (ast.action === "READ") {
        rejectSymlink(p);
        return ok(readFileSync(p, "utf8"));
      }
      if (ast.action === "LIST") {
        rejectSymlink(p);
        const st = lstatSync(p);
        if (!st.isDirectory()) return ok([path.relative(rootResolved, p) || path.basename(p)]);
        return ok(readdirSync(p));
      }
      if (ast.action === "REMOVE") {
        rejectSymlink(p);
        rmSync(p, { force: true, recursive: true });
        return ok({ removed: true });
      }
      throw new PolicyDenied("fs unknown action");
    },
  });
}

/** Community binding: same fs AST, object-store map (S3 analog). */
export function s3ShapedFs(bucket = "bucket"): Driver {
  const inner = memoryFs(`/${bucket}`);
  return defineDriver({
    kind: "fs",
    id: "s3",
    execute: (ast) => inner.execute(ast),
  });
}
