/* eslint-disable */
/** GENERATED from rfc/schemas — do not edit by hand. RFC-0001/0002/0003 are normative. */

export type AnyToolStrongIntent =
  | {
      channel: "fs";
      action: "read" | "list";
      path: string;
    }
  | {
      channel: "fs";
      action: "write";
      path: string;
      body: unknown;
    }
  | {
      channel: "fs";
      action: "remove";
      path: string;
    }
  | {
      channel: "net";
      action: "request";
      host: string;
      path: string;
      method: "GET" | "POST" | "PUT" | "DELETE";
      port?: number;
      body?: unknown;
    }
  | {
      channel: "db";
      action: "find" | "update" | "remove";
      table: string;
      where?: {};
      columns?: string[];
      limit?: number;
      row?: {};
    }
  | {
      channel: "db";
      action: "insert";
      table: string;
      row: {};
    }
  | {
      channel: "payment";
      action: "charge";
      amountCents: number;
      currency: string;
      purpose: string;
      invoiceId: string;
    }
  | {
      channel: "payment";
      action: "refund";
      amountCents: number;
      currency: string;
      purpose: string;
      invoiceId?: string;
      refundId?: string;
    }
  | {
      channel: "os";
      action: "metrics" | "constraints";
    }
  | {
      channel: "shell";
      action: "run";
      /**
       * @minItems 1
       */
      argv: [string, ...string[]];
      cwd?: string;
    }
  | {
      channel: "wasm";
      action: "invoke";
      moduleId: string;
      export: string;
      args?: unknown[];
    }
  | {
      channel: "event";
      action: "emit" | "wait";
      key: string;
      data?: unknown;
    }
  | {
      channel: "auth";
      action: "whoami";
    }
  | {
      channel: "auth";
      action: "assert";
      role: string;
    }
  | {
      channel: "crypto";
      action: "hash" | "hmac" | "sign" | "verify";
      algorithm: string;
      data: string;
    }
  | {
      channel: "crypto";
      action: "random";
      bytes?: number;
    }
  | {
      channel: "secret";
      action: "use";
      name: string;
      purpose: string;
    }
  | {
      channel: "logger";
      action: "debug" | "info" | "warn" | "error";
      event: string;
      data?: {};
    }
  | {
      channel: "email" | "sms";
      action: "send";
      to: string;
      templateId: string;
      vars?: {};
    };
