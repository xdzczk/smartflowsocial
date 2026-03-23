import type { Prisma } from "~/features/contest/data/contest-prisma-types.server";

interface ContestActivityEvent {
  at: string;
  type: string;
  payload?: Record<string, unknown>;
}

export function appendContestActivityLog(
  current: unknown,
  type: string,
  payload?: Record<string, unknown>
): Prisma.InputJsonValue {
  const base: ContestActivityEvent[] = Array.isArray(current)
    ? (current.filter(
        (entry) => entry && typeof entry === "object"
      ) as ContestActivityEvent[])
    : [];

  return [
    ...base,
    {
      at: new Date().toISOString(),
      type,
      ...(payload ? { payload } : {}),
    },
  ] as unknown as Prisma.InputJsonValue;
}
