# AnyTool

Give an AI agent room to work. Keep the blast radius you signed off on.

AnyTool is an **installable runtime** for agents you already run (Vercel AI SDK, LangChain JS, or any tool loop). The agent writes the capability. You define **which systems it may touch**. Policy decides **before** anything hits disk, a database, or a payment rail.

You do not ship another agent framework. You add one tool.

```bash
npm i anytool
```

---

## Why teams adopt it

Production agents are stuck between two bad options:

| | Unrestricted code / Bash | A pile of `getOrderById()` tools |
|---|---|---|
| Can the agent solve a new task? | Yes, until it deletes the wrong tree or runs `DROP TABLE` | Only if you already wrote that function |
| Can security sign off? | Usually no | Yes, until the catalog explodes |
| Who owns the blast radius? | “The model, we hope” | The last engineer who added a tool |

AnyTool is the middle: **open-ended work inside a closed world**.

- **Business:** ship agents that file reports, query customers, and charge invoices without handing them the production shell.
- **Risk:** a compromised prompt cannot become SQL, Stripe, or `rm -rf`. Intent is checked; then a command is issued; then a driver runs. If policy fails, **nothing executes**.
- **Cost:** you stop inventing one tool per use case. The agent authors the function. You maintain policy and drivers.
- **Audit:** every allow and deny is logged (channel, action, hashed arguments, policy id). When something goes wrong, you can say what was attempted.

The blast radius is exactly the drivers you bind. Unbound payment is not “maybe Stripe.” It does not exist.

---

## Why developers use it

You keep your agent. You add AnyTool. Policy is optional for a sandbox **fs** + **db** start; everything else is explicit.

```ts
import { createAnyTool, memoryFs, sqlite } from "anytool";

const anytool = createAnyTool({
  drivers: {
    fs: memoryFs("/workspace"),
    db: sqlite(),
  },
});

// Drop into the agent you already have
anytool.asAiSdkTool();
anytool.asLangChainTool();
```

The model must pass a **strong intent** (structured, not a paragraph) plus code. Code may only realize that intent:

```ts
await anytool.run({
  intent: {
    channel: "db",
    action: "find",
    table: "customers",
    where: { country: "BD" },
    limit: 100,
  },
  code: `async function run(ctx) {
    return ctx.db.find({
      table: "customers",
      where: { country: "BD" },
      limit: 100,
    });
  }`,
});
```

That is **what** to do. Postgres, SQLite, or Mongo decide **how**. The agent never writes SQL.

```text
AnyTool
   │
   ├── generated executable code
   └── Context → DB capability → Command DSL
                                      find | insert | update | remove
                                              ▼
                                         DB Driver
                                    ┌─────┼─────┐
                                 Postgres SQLite MongoDB
```

Same pattern for files, payments, mail, secrets: `ctx.fs.write`, `ctx.payment.charge`, never `fs`, `pg`, or the Stripe SDK on the host.

If intent is missing, the channel does not match the code, the path leaves the jail, a delete has no `where`, or a charge exceeds the cap → `PolicyDenied`. No command. No side effect.

Omit `policy` and you get a built-in sandbox for **fs** and **db** only. Bind Stripe or shell only with your own policy document. Empty allowlists mean deny, not allow.

```ts
import { postgres } from "anytool";

createAnyTool({
  policy: yourRfc0001Document,
  drivers: {
    db: postgres(async (command) => {
      // you translate { action, table, where, limit } → parameterized SQL
    }),
  },
});
```

Community backends reuse **kinds**, not new protocols: S3 is still `fs`, Stripe is still `payment`.

---

## Why it stays fast enough for a tool loop

Agents are latency-sensitive. AnyTool is built so **denies are cheap** and **allows do one thing**.

| Concern | What AnyTool does |
|---|---|
| Failed policy | Evaluated on the intent **before** isolate. A bad path or over-cap charge never starts a VM. |
| Isolate | One run, one intent, hard timeout (`timeoutMs`, default 5s). No leftover `.py` / `.sh` on disk. |
| Hot path | Policy lives in the engine, not in every driver. SQLite, Postgres, and Mongo share the same command object. |
| DB | Field-map `where` (`{ country: "BD" }`), not a SQL parser on the agent path. The driver emits bound queries once. |
| Payload | Extra intent keys fail closed. Logger redacts configured keys before emit. Audit stores a hash of arguments, not a second copy of the row. |
| Boot | Invalid policy JSON, unknown spec version, or a bound driver with no kind slice **refuses to start**. You do not discover an open default in production. |

You still pay for real I/O (disk, Postgres, Stripe). AnyTool’s job is not to hide that cost. It is to **not add a second interpreter, a script workspace, or a policy engine per vendor**.

Node 20+. Core dependencies are `acorn` + `ajv` (parse + schema). AI SDK and LangChain are optional peers.

---

## What you can bind

`fs` · `db` · `net` · `payment` · `os` · `shell` · `wasm` · `event` · `auth` · `crypto` · `secret` · `logger` · `email` · `sms`

Policy is a versioned document ([RFC-0001](rfc/0001-driver-policy.md)), not a TypeScript interface. Intent: [RFC-0002](rfc/0002-strong-intent.md). Command AST: [RFC-0003](rfc/0003-command-ast.md). Driver kinds: [RFC-0004](rfc/0004-driver-kind.md).

```bash
npm test
```
