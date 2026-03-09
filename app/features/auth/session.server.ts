import { createCookieSessionStorage, redirect } from "@remix-run/node";
import invariant from "tiny-invariant";

import { getUserById } from "~/features/user";
import type { User } from "~/features/user";
import { env } from "~/lib/env.server";

import {
  createSession as createSessionRow,
  findSessionByIdForPubkey,
  findSessionByIdForUserId,
  findSessionByIdFull,
  revokeSessionById,
} from "./repositories/session-data.server";

invariant(env.SESSION_SECRET, "SESSION_SECRET must be set");

interface CookieSessionData {
  sessionId?: string;
  userId?: string;
}

export const sessionStorage = createCookieSessionStorage<CookieSessionData>({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [env.SESSION_SECRET],
    secure: env.NODE_ENV === "production",
  },
});

const SESSION_ID_KEY: keyof CookieSessionData = "sessionId";
const LEGACY_USER_SESSION_KEY: keyof CookieSessionData = "userId";

export async function getSession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}

export async function getSessionId(
  request: Request
): Promise<string | undefined> {
  const session = await getSession(request);
  const sessionId = session.get(SESSION_ID_KEY);
  return typeof sessionId === "string" && sessionId.length > 0
    ? sessionId
    : undefined;
}

export async function getSessionPubkey(
  request: Request
): Promise<string | undefined> {
  const session = await getSession(request);
  const sessionId = session.get(SESSION_ID_KEY);

  if (typeof sessionId === "string" && sessionId.length > 0) {
    const dbSession = await findSessionByIdForPubkey(sessionId);

    if (!dbSession) return undefined;
    if (dbSession.revokedAt) return undefined;
    if (dbSession.expiresAt.getTime() <= Date.now()) return undefined;
    return dbSession.pubkey;
  }

  // Legacy compatibility: derive pubkey from the legacy userId session cookie
  const legacyUserId = session.get(LEGACY_USER_SESSION_KEY);
  if (typeof legacyUserId === "string" && legacyUserId.length > 0) {
    const user = await getUserById(legacyUserId);
    return user?.npub;
  }

  return undefined;
}

export async function getUserId(
  request: Request
): Promise<User["id"] | undefined> {
  const session = await getSession(request);
  const sessionId = session.get(SESSION_ID_KEY);

  if (typeof sessionId === "string" && sessionId.length > 0) {
    const dbSession = await findSessionByIdForUserId(sessionId);

    if (!dbSession) return undefined;
    if (dbSession.revokedAt) return undefined;
    if (dbSession.expiresAt.getTime() <= Date.now()) return undefined;
    return dbSession.userId;
  }

  // Legacy compatibility
  const legacyUserId = session.get(LEGACY_USER_SESSION_KEY);
  return typeof legacyUserId === "string" && legacyUserId.length > 0
    ? legacyUserId
    : undefined;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (userId === undefined) return null;

  const user = await getUserById(userId);
  if (user) return user;

  throw await logout(request);
}

export async function requireSession(
  request: Request
): Promise<{ userId: User["id"]; pubkey: string; sessionId: string }> {
  const session = await getSession(request);
  const sessionId = session.get(SESSION_ID_KEY);

  if (typeof sessionId === "string" && sessionId.length > 0) {
    const dbSession = await findSessionByIdFull(sessionId);

    if (
      !dbSession ||
      dbSession.revokedAt ||
      dbSession.expiresAt.getTime() <= Date.now()
    ) {
      throw redirect("/login");
    }

    return {
      userId: dbSession.userId,
      pubkey: dbSession.pubkey,
      sessionId: dbSession.id,
    };
  }

  // Legacy compatibility: allow old cookie sessions during rollout
  const legacyUserId = session.get(LEGACY_USER_SESSION_KEY);
  if (typeof legacyUserId === "string" && legacyUserId.length > 0) {
    const user = await getUserById(legacyUserId);
    if (!user) throw await logout(request);
    return { userId: legacyUserId, pubkey: user.npub, sessionId: "legacy" };
  }

  throw redirect("/login");
}

export async function requireUserId(request: Request) {
  const { userId } = await requireSession(request);
  return userId;
}

export async function requireUser(request: Request) {
  const userId = await requireUserId(request);

  const user = await getUserById(userId);
  if (user) return user;

  throw await logout(request);
}

export async function createUserSession({
  request,
  userId,
  remember,
  redirectTo,
}: {
  request: Request;
  userId: string;
  remember: boolean;
  redirectTo: string;
}) {
  const session = await getSession(request);

  const user = await getUserById(userId);
  if (!user) {
    throw await logout(request);
  }

  // DB-backed session bound to pubkey
  const expiresAt = new Date(
    Date.now() + (remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
  );
  const dbSession = await createSessionRow({
    userId,
    pubkey: user.npub,
    expiresAt,
  });

  session.set(SESSION_ID_KEY, dbSession.id);
  // Explicitly clear legacy key (defense-in-depth)
  session.unset(LEGACY_USER_SESSION_KEY);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session, {
        maxAge: remember
          ? 60 * 60 * 24 * 7 // 7 days
          : undefined,
      }),
    },
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);

  const sessionId = session.get(SESSION_ID_KEY);
  if (typeof sessionId === "string" && sessionId.length > 0) {
    await revokeSessionById(sessionId);
  }

  // Explicitly clear legacy session key (defense-in-depth)
  session.unset(LEGACY_USER_SESSION_KEY);
  session.unset(SESSION_ID_KEY);

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
