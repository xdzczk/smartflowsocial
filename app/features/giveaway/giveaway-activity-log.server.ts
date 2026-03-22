import type { Prisma } from "./data/giveaway-prisma-types.server";

export interface GiveawayActivityEntry {
  at: string;
  type: string;
  payload?: Record<string, unknown>;
}

export function appendGiveawayActivityLog(
  raw: unknown,
  type: string,
  payload?: Record<string, unknown>
): Prisma.InputJsonValue {
  const prev = Array.isArray(raw) ? (raw as GiveawayActivityEntry[]) : [];
  const next: GiveawayActivityEntry[] = [
    ...prev,
    { at: new Date().toISOString(), type, payload },
  ];
  return next as unknown as Prisma.InputJsonValue;
}
