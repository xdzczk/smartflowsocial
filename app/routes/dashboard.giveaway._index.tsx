import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  GiveawayPage,
  type GiveawayPageProps,
  type GiveawayWinnerEntry,
} from "~/features/giveaway";
import {
  deleteGiveaway,
  duplicateGiveaway,
  listGiveawaysByUser,
} from "~/features/giveaway/giveaway-actions.server";
import {
  formatScopeSummaryLabel,
  formatStatusLabel,
  getQueueNamesByIds,
} from "~/features/giveaway/giveaway-display.server";
import {
  budgetSatsFromGiveawayRow,
  countPayoutCompleted,
  normalizePayoutState,
} from "~/features/giveaway/giveaway-payout.server";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";

const STATUS_OPTIONS = [
  "DRAFT",
  "PREVIEWED",
  "LOCKED",
  "PAID_OUT",
  "CANCELLED",
] as const;

/** List page loader: giveaways with KPIs, filters, rich rows. */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    await requireAnySubscription(userId);
    await requireFeatureAccess(userId, "giveaways");

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const statusFilter = url.searchParams.get("status") ?? "";
    const scopeFilter = url.searchParams.get("scope") ?? "";
    const sort = url.searchParams.get("sort") ?? "newest";
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");

    const giveaways = await listGiveawaysByUser(userId);
    const queueIds = giveaways
      .map((g) => (g.scopeReference as Record<string, unknown>)["queueId"])
      .filter((id): id is string => typeof id === "string");
    const uniqueQueueIds = [...new Set(queueIds)];
    const queueNameById = await getQueueNamesByIds(userId, uniqueQueueIds);

    const kpis = {
      total: giveaways.length,
      pendingPayout: giveaways.filter((g) => g.status === "LOCKED").length,
      completed: giveaways.filter((g) => g.status === "PAID_OUT").length,
      totalSatsPaid: giveaways
        .filter((g) => g.status === "PAID_OUT")
        .reduce((acc, g) => acc + budgetSatsFromGiveawayRow(g), 0),
      totalWinnersSelected: giveaways.reduce((acc, g) => {
        const snap = g.winnerSnapshot as GiveawayWinnerEntry[] | null;
        if (snap?.length) return acc + snap.length;
        return acc + g.winnerCount;
      }, 0),
    };

    let rows = giveaways.map((g) => {
      const ref = g.scopeReference as Record<string, unknown>;
      const queueId =
        typeof ref["queueId"] === "string" ? ref["queueId"] : null;
      const queueName = queueId ? (queueNameById[queueId] ?? null) : null;
      const snapshot =
        (g.winnerSnapshot as GiveawayWinnerEntry[] | null) ?? null;
      const engagementTypes = Array.isArray(g.engagementTypes)
        ? (g.engagementTypes as string[])
        : [];
      const budgetSats = budgetSatsFromGiveawayRow(g);
      const snapshotCount = snapshot?.length ?? 0;
      let payoutSettled = 0;
      let payoutTotal = 0;
      if (
        snapshot &&
        snapshot.length > 0 &&
        (g.status === "LOCKED" || g.status === "PAID_OUT")
      ) {
        const state = normalizePayoutState(g.payoutState, snapshot);
        payoutSettled = countPayoutCompleted(
          state,
          snapshot.map((w) => w.pubkey)
        );
        payoutTotal = snapshot.length;
      }

      return {
        id: g.id,
        name: g.name ?? null,
        status: g.status,
        statusLabel: formatStatusLabel(g.status),
        scopeType: g.scopeType,
        scopeSummaryLabel: formatScopeSummaryLabel(g.scopeType, ref, queueName),
        winnerCount: g.winnerCount,
        snapshotWinnerCount: snapshotCount,
        engagementTypes,
        budgetSats,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
        payoutSettled,
        payoutTotal,
        canDelete:
          g.status === "DRAFT" ||
          g.status === "PREVIEWED" ||
          g.status === "CANCELLED",
      };
    });

    if (q) {
      rows = rows.filter((r) => {
        const name = (r.name ?? "").toLowerCase();
        return name.includes(q) || r.id.toLowerCase().includes(q);
      });
    }
    if (
      statusFilter &&
      STATUS_OPTIONS.includes(statusFilter as (typeof STATUS_OPTIONS)[number])
    ) {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (scopeFilter) {
      rows = rows.filter((r) => r.scopeType === scopeFilter);
    }
    if (fromStr) {
      const from = new Date(fromStr);
      rows = rows.filter((r) => new Date(r.createdAt) >= from);
    }
    if (toStr) {
      const to = new Date(toStr);
      to.setHours(23, 59, 59, 999);
      rows = rows.filter((r) => new Date(r.createdAt) <= to);
    }

    switch (sort) {
      case "payout_pending": {
        rows = [...rows].sort((a, b) => {
          const pri = (s: string) => (s === "LOCKED" ? 0 : 1);
          const d = pri(a.status) - pri(b.status);
          if (d !== 0) return d;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
        break;
      }
      case "completed": {
        rows = [...rows].sort((a, b) => {
          const pri = (s: string) => (s === "PAID_OUT" ? 0 : 1);
          const d = pri(a.status) - pri(b.status);
          if (d !== 0) return d;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
        break;
      }
      default: {
        rows = [...rows].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    }

    return json({
      giveaways: rows,
      kpis,
      filters: {
        q,
        status: statusFilter,
        scope: scopeFilter,
        sort,
        from: fromStr ?? "",
        to: toStr ?? "",
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    await requireAnySubscription(userId);
    await requireFeatureAccess(userId, "giveaways");

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "duplicate") {
      const id = formData.get("giveawayId");
      if (typeof id !== "string" || !id.trim()) {
        return json({ error: "Missing giveaway" }, { status: 400 });
      }
      const result = await duplicateGiveaway(userId, id.trim());
      if (result.error || !result.id) {
        return json(
          { error: result.error ?? "Could not duplicate giveaway" },
          { status: 400 }
        );
      }
      return redirect(`/dashboard/giveaway/detail/${result.id}`);
    }

    if (intent === "delete") {
      const id = formData.get("giveawayId");
      if (typeof id !== "string" || !id.trim()) {
        return json({ error: "Missing giveaway" }, { status: 400 });
      }
      const result = await deleteGiveaway(userId, id.trim());
      if (!result.success) {
        return json(
          { error: result.error ?? "Delete failed" },
          { status: 400 }
        );
      }
      return redirect("/dashboard/giveaway");
    }

    return json({ error: "Unknown intent" }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

export default function DashboardGiveawayIndexRoute() {
  const data = useLoaderData<GiveawayPageProps>();
  return <GiveawayPage {...data} />;
}
