# RFC-0004: Driver Kind Contract

Status: Proposed Standard  
The keywords MUST, MUST NOT, SHOULD, MAY are as in RFC 2119 and RFC 8174.

## 1. Abstract

Core kinds are infrastructure channels. Community drivers implement `execute(ast)` for an existing kind. They MUST NOT invent a parallel intent or AST protocol.

## 2. Core kinds

`fs`, `net`, `db`, `payment`, `os`, `shell`, `wasm`, `event`, `auth`, `crypto`, `secret`, `logger`, `email`, `sms`

S3, GCS, and local disk are `fs`. Stripe, Lemon Squeezy, and test processors are `payment`. Postgres, SQLite, and MongoDB are `db` (same command DSL: find / insert / update / remove).

## 3. defineDriver

A driver MUST declare `kind` from section 2, MAY declare `id` (binding name such as `s3` or `stripe`), and MUST implement `execute(ast)` returning a structured result.

Policy evaluation MUST occur in the engine. `execute` MUST NOT be invoked unless the engine issued the AST.

Hosts MUST call `anytool.run`. Agent code MUST NOT receive `execute`.

Community packages SHOULD run the kind compliance suite exported by core.

Vendor-only fields MUST stay inside `execute` (host binding maps purpose/invoice to Stripe price IDs). Agents MUST NOT pass `stripePriceId`.
