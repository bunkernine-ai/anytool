import { defineDriver, ok, type Driver } from "./define.js";

export function osDriver(policySnapshot: unknown): Driver {
  return defineDriver({
    kind: "os",
    id: "os",
    async execute(ast) {
      if (ast.action === "METRICS") {
        return ok({ cpuUsagePercent: 0, memoryFreeBytes: 0, diskSpaceAvailableBytes: 0 });
      }
      return ok({ policy: policySnapshot });
    },
  });
}
