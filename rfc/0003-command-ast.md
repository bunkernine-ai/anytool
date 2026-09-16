# RFC-0003: AnyTool Command AST

Status: Proposed Standard  
Protocol: `anytool-v1`  
The keywords MUST, MUST NOT, SHOULD, MAY are as in RFC 2119 and RFC 8174.

## 1. Abstract

The engine MUST emit a Command AST only after RFC-0001 policy accepts a RFC-0002 intent. Drivers MUST accept this AST in `execute` and MUST NOT accept agent SQL, vendor payloads, or raw code. JSON Schema: `rfc/schemas/ast.schema.json`.

## 2. Node

```json
{
  "protocol": "anytool-v1",
  "module": "<kind>",
  "action": "<VERB_UPPER>",
  "target": "<string>",
  "arguments": {},
  "constraints": { "timeoutMs": 5000 },
  "policyId": "<policyId>",
  "policyVersion": "1"
}
```

- `protocol` MUST be `anytool-v1`.
- `module` MUST equal intent `channel`.
- `action` MUST be the intent action in uppercase (`CHARGE`, `FIND`, `WRITE`, …).
- `target` MUST be the primary resource (path, table, host, invoiceId, moduleId, key, …).
- `arguments` MUST be a JSON object with no extra keys beyond the intent fields (minus channel/action).
- Drivers MUST ignore unknown fields (fail closed on required missing fields).
- Handmade AST from agent code MUST NOT reach `execute`. Agent code MUST NOT obtain `execute`.

## 3. Audit

Every allow MUST append an audit record: `policyId`, `module`, `action`, SHA-256 of canonical JSON arguments, timestamp. Deny SHOULD be audited with reason.
