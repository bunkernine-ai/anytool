import { defineDriver, ok, type Driver } from "./define.js";

export function fakePayment(merchantId: string): Driver {
  const charges: unknown[] = [];
  return defineDriver({
    kind: "payment",
    id: "fake-payment",
    async execute(ast) {
      const rec = { merchantId, action: ast.action, ...ast.arguments };
      charges.push(rec);
      return ok({ id: `pay_${charges.length}`, merchantId, ...ast.arguments });
    },
  });
}

/** Community binding: same CHARGE AST (Stripe analog). */
export function stripeShapedPayment(merchantId: string): Driver {
  const inner = fakePayment(merchantId);
  return defineDriver({
    kind: "payment",
    id: "stripe",
    execute: (ast) => inner.execute(ast),
  });
}
