# RFC-0002: AnyTool Strong Intent

Status: Proposed Standard  
The keywords MUST, MUST NOT, SHOULD, MAY are as in RFC 2119 and RFC 8174.

## 1. Abstract

Every driver invocation MUST include a Strong Intent object. Natural language is not an intent. Missing, partial, or extra fields MUST deny. JSON Schema: `rfc/schemas/intent.schema.json`.

## 2. Envelope

| Field | Requirement |
|---|---|
| `channel` | MUST be a core kind registered in RFC-0004 |
| `action` | MUST be a closed verb for that channel |
| remaining fields | MUST match the action schema; additional properties MUST deny |

One invocation, one primary intent. Code executed after policy MUST NOT escalate this intent.

## 3. Closed verbs

- fs: `read`, `write`, `list`, `remove` — `path` required; `body` required for write
- net: `request` — `host`, `path`, `method` required; `body` optional
- db: `find`, `insert`, `update`, `remove` — Command DSL. `table` required. `where` is a field map (`{ country: "BD" }` means equality), not SQL. `where` required for update/remove when policy `requireWhere` is true. `columns` optional; `limit` optional; `row` required for insert.
- payment: `charge`, `refund` — `amountCents`, `currency`, `purpose` required; `invoiceId` required for charge; `refundId` or `invoiceId` for refund
- os: `metrics`, `constraints`
- shell: `run` — `argv` array, first element binary name
- wasm: `invoke` — `moduleId`, `export`, `args` array
- event: `emit`, `wait` — `key` required
- auth: `whoami`, `assert` — `role` required for assert
- crypto: `hash`, `hmac`, `sign`, `verify`, `random` — `algorithm` except random; `data` as string
- secret: `use` — `name`, `purpose`
- logger: `debug`, `info`, `warn`, `error` — `event` string, `data` object
- email, sms: `send` — `to`, `templateId`, `vars` object

## 4. Escalation

After isolate, each `ctx` call MUST compile to the same `channel` and `action`. Arguments MUST NOT exceed the declared intent (no higher `amountCents`, no different `path`, no extra table). Mismatch MUST deny and MUST NOT produce AST.
