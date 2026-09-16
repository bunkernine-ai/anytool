# RFC-0001: AnyTool Driver Policy Document

Status: Proposed Standard  
Spec: `anytool-policy`  
Spec version: `1`  
Media type: `application/vnd.anytool.policy+json`  
The keywords MUST, MUST NOT, SHOULD, MAY are as in RFC 2119 and RFC 8174.

## 1. Abstract

This document defines the language-neutral Driver Policy Document. Hosts MUST supply a document that validates against `rfc/schemas/policy.schema.json`. The AnyTool engine MUST evaluate intents against this document. Community drivers MUST NOT reimplement policy and MUST NOT add agent-visible policy keys that are not defined here.

TypeScript types SHALL be generated from the JSON Schema. The schema is normative; code is not.

## 2. Envelope

A policy document is RFC 8259 JSON with:

| Field | Type | Requirement |
|---|---|---|
| `spec` | string | MUST be `"anytool-policy"` |
| `specVersion` | string | MUST be `"1"` for this RFC. Unknown versions MUST refuse to boot. |
| `policyId` | string | MUST be a non-empty identifier |
| `issuedAt` | string | MUST be RFC 3339 date-time |
| `environment` | string | MUST be `sandbox`, `staging`, or `production` |
| `kinds` | object | MUST contain a slice for every bound driver kind. Unknown keys MUST be rejected. |
| `timeoutMs` | number | SHOULD cap isolate run time. If omitted, engine MUST use a finite default (not unbounded). |
| `maxMemoryMb` | number | MAY be enforced by the isolate |

Empty allowlists mean deny all. Omitted optional deny-fields MUST default to deny, not open.

A bound driver whose kind is absent from `kinds` MUST NOT start.

## 3. Signatures

Hosts MAY attach a detached JWS (RFC 7515) over the UTF-8 policy bytes. When `environment` is `production`, the engine MUST reject unsigned policy unless the host sets `allowUnsignedPolicy: true`. Unsigned policy MAY be used in `sandbox` without that flag.

## 4. Kind slices

### 4.1 fs

- `allowedRoots` (string[]): resolved path of a target MUST stay inside one root. Relative vectors that start with `..` MUST deny.
- `blockedExtensions` (string[]): suffix match, case-insensitive. Empty list denies no extensions by suffix; roots still apply.
- `readOnlyPaths` (string[]): write and remove MUST deny if the resolved path is under a read-only path.
- `maxFileSizeBytes` (number): MUST be a finite non-negative integer. Writes larger MUST deny.

### 4.2 net

- `allowedHosts` (string[]): host of the request MUST match exactly (or a single leading `*.` wildcard DNS label). Empty list MUST deny all.
- `blockedPorts` (number[]): listed ports MUST deny.
- `maxPayloadSizeBytes` (number): request body larger MUST deny.

### 4.3 db

- `allowedTables` (string[]): table MUST be listed. Empty MUST deny all.
- `allowedActions` (string[]): subset of `find`, `insert`, `update`, `remove`. Empty MUST deny all.
- `mutationLimitRows` (number): `update`/`remove`/`insert` row impact MUST NOT exceed this.
- `requireWhere` (boolean): if true (MUST default true when omitted), `update` and `remove` without a non-empty `where` MUST deny.

### 4.4 payment

- `maxAmountCents` (number): MUST be finite. Charges strictly greater MUST deny. MUST NOT default to infinity.
- `allowedCurrencies` (string[]): empty MUST deny all.
- `allowedPurposes` (string[]): empty MUST deny all.
- `merchantId` (string): MUST be non-empty when payment is bound.

### 4.5 os

- `allowMetrics` (boolean): default false.
- `allowConstraints` (boolean): default false.

### 4.6 shell

- `allowedBinaries` (string[]): first argv element MUST be listed. Empty MUST deny all. The agent MUST NOT pass a shell string; argv only.
- `allowedCwds` (string[]): cwd MUST be under one entry.
- `timeoutMs` (number)

### 4.7 wasm

- `allowedModules` (string[]): `moduleId` MUST be listed. Empty MUST deny all.
- `maxFuel` (number), `maxMemoryPages` (number)

### 4.8 event

- `allowedKeys` (string[]): empty MUST deny all.

### 4.9 auth

- `allowWhoami` (boolean): default false
- `allowedAssertRoles` (string[]): empty MUST deny all asserts

### 4.10 crypto

- `allowedAlgorithms` (string[]): empty MUST deny all
- `allowRandom` (boolean): default false

### 4.11 secret

- `allowedNames` (string[]): empty MUST deny all
- `allowedPurposes` (string[]): empty MUST deny all

### 4.12 logger

- `allowedLevels` (string[]): subset of `debug`, `info`, `warn`, `error`. Empty MUST deny all.
- `maxPayloadBytes` (number)
- `redactKeys` (string[]): keys MUST be stripped before emit

### 4.13 email / sms

- `allowedRecipients` (string[]): exact address or `*@domain`. Empty MUST deny all.
- `allowedTemplateIds` (string[]): empty MUST deny all.
- `maxPerMinute` (number)

## 5. Evaluation

The engine MUST evaluate RFC-0002 Strong Intent against the matching kind slice BEFORE isolate. Drivers MUST NOT evaluate agent-visible policy. Extra keys on intent MUST deny. Ambiguous checks MUST deny.

## 6. Conformance

Implementations MUST load `rfc/examples/policy` golden files: `valid-*.json` MUST accept; `invalid-*.json` MUST reject at boot or evaluation as labeled.
