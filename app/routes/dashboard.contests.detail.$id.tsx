import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  ContestDetailView,
  buildContestEntriesCsv,
  cancelContest,
  completeContest,
  freezeContestAtDeadline,
  getContestDetailPageData,
  launchContest,
  lockContest,
  setContestWinnerPayoutStatus,
} from "~/features/contest";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import { featureFlags } from "~/lib/feature-flags.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");
  const id = params["id"];
  if (!id) throw new Response("Not found", { status: 404 });

  const data = await getContestDetailPageData(userId, id);
  if (!data) throw new Response("Not found", { status: 404 });
  return json(data);
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");
  const id = params["id"];
  if (!id) return json({ error: "Not found" }, { status: 404 });
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "exportCsv") {
    const data = await getContestDetailPageData(userId, id);
    if (!data) return json({ error: "Not found" }, { status: 404 });
    const csv = buildContestEntriesCsv(data);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contest-${id}-entries.csv"`,
      },
    });
  }

  if (intent === "launch") {
    const result = await launchContest(userId, id);
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect(`/dashboard/contests/detail/${id}`);
  }
  if (intent === "freeze") {
    const result = await freezeContestAtDeadline(userId, id);
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect(`/dashboard/contests/detail/${id}`);
  }
  if (intent === "lock") {
    const result = await lockContest(userId, id, {
      lockConfigHash: String(formData.get("lockConfigHash") ?? ""),
    });
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect(`/dashboard/contests/detail/${id}`);
  }
  if (intent === "payout") {
    const winnerPubkey = String(formData.get("winnerPubkey") ?? "");
    const payoutStatus = String(formData.get("payoutStatus") ?? "pending") as
      | "pending"
      | "sent"
      | "failed"
      | "marked_paid";
    const result = await setContestWinnerPayoutStatus(
      userId,
      id,
      winnerPubkey,
      payoutStatus
    );
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect(`/dashboard/contests/detail/${id}`);
  }
  if (intent === "complete") {
    const result = await completeContest(userId, id, {
      completeOverrideReason: String(
        formData.get("completeOverrideReason") ?? ""
      ),
    });
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect(`/dashboard/contests/detail/${id}`);
  }
  if (intent === "cancel") {
    const result = await cancelContest(
      userId,
      id,
      String(formData.get("reason") ?? "")
    );
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect("/dashboard/contests");
  }
  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function ContestDetailRoute() {
  const data = useLoaderData<typeof loader>();
  return <ContestDetailView data={data} />;
}
