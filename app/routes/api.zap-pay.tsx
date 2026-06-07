import { NWCClient } from "@getalby/sdk";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { getUserId } from "~/features/auth";
import { getDecryptedUserNWC, touchUserNwcLastUsed } from "~/features/user";
import { logError } from "~/lib/error-logger.server";

const ZAP_PAY_NWC_TIMEOUT_MS = 55_000;

function isLikelyBolt11(s: string): boolean {
  const t = s.trim().toLowerCase();
  return (
    t.length >= 50 &&
    (t.startsWith("lnbc") || t.startsWith("lntb") || t.startsWith("lnbs"))
  );
}

async function payInvoiceWithNwcTimeout(
  nwcClient: NWCClient,
  invoice: string
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Wallet payment timed out")),
      ZAP_PAY_NWC_TIMEOUT_MS
    );
  });
  try {
    await Promise.race([nwcClient.payInvoice({ invoice }), timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * POST /api/zap-pay  -  pay a BOLT11 invoice via the signed-in user's NWC (if configured).
 * Used by the client zap flow before falling back to WebLN.
 */
export async function loader(_args: LoaderFunctionArgs) {
  return json({ error: "Use POST" }, { status: 405 });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const userId = await getUserId(request);
  if (!userId) {
    return json({ code: "UNAUTHENTICATED" as const }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const invoice =
    typeof body === "object" &&
    body !== null &&
    "invoice" in body &&
    typeof body.invoice === "string"
      ? (body as { invoice: string }).invoice.trim()
      : "";

  if (!isLikelyBolt11(invoice)) {
    return json({ error: "Invalid Lightning invoice" }, { status: 400 });
  }

  const decryptedNwc = await getDecryptedUserNWC(userId);
  if (!decryptedNwc) {
    return json({ code: "NO_NWC" as const }, { status: 400 });
  }

  const nwcClient = new NWCClient({
    nostrWalletConnectUrl: decryptedNwc,
  });
  try {
    await payInvoiceWithNwcTimeout(nwcClient, invoice);
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      message: "Zap NWC payInvoice failed",
      userId,
    });
    const message = err instanceof Error ? err.message : "NWC payment failed";
    return json({ error: message }, { status: 502 });
  } finally {
    try {
      nwcClient.close();
    } catch {
      /* ignore */
    }
  }

  await touchUserNwcLastUsed(userId);
  return json({ ok: true as const });
}
