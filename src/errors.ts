export class PolicyDenied extends Error {
  readonly code = "POLICY_DENIED" as const;
  readonly reason: string;
  readonly details?: Record<string, unknown>;

  constructor(reason: string, details?: Record<string, unknown>) {
    super(reason);
    this.name = "PolicyDenied";
    this.reason = reason;
    this.details = details;
  }
}

export class BootError extends Error {
  readonly code = "BOOT_FAILED" as const;
  constructor(message: string) {
    super(message);
    this.name = "BootError";
  }
}
