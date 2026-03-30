import { Prisma } from "@prisma/client";

/** True when Prisma reports a unique violation on any of the given field names. */
export function isPrismaUniqueViolationOnFields(
  error: unknown,
  fieldNames: readonly string[]
): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.["target"];
  if (Array.isArray(target)) {
    return fieldNames.some((name) =>
      target.some((t) => t === name || String(t).includes(name))
    );
  }
  // Driver adapters sometimes omit `target`; fall back to the error text.
  const msg = error.message.toLowerCase();
  return fieldNames.some((name) => msg.includes(name.toLowerCase()));
}
