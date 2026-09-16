# Community drivers (RFC-0004)

Implement `defineDriver({ kind, execute })` for an existing core kind. Do not invent policy keys or a new AST.

- Object storage → `kind: "fs"` (same `WRITE`/`READ` AST as local disk)
- Stripe or Lemon Squeezy → `kind: "payment"` (same `CHARGE` AST)
- Postgres / SQLite / Mongo → `kind: "db"` (command DSL: find/insert/update/remove; never agent SQL)

Policy evaluation is in `createCapability` (RFC-0001) on each `<sdk>.execute(command)`. Hosts call `anytool.run({ code, input })` only. The VM never sees vendor clients. Run `test/kinds.test.ts` as a compliance check: handmade AST as an execute command must fail RFC-0002.
