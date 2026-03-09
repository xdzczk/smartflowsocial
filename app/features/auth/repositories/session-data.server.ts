/**
 * Session data access. Prisma is confined to feature repositories/ per architecture.
 */

import { prisma } from "~/lib/prisma.server";

export interface SessionPubkeyRow {
  pubkey: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

export interface SessionUserIdRow {
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

export interface SessionFullRow {
  id: string;
  userId: string;
  pubkey: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

export async function findSessionByIdForPubkey(
  sessionId: string
): Promise<SessionPubkeyRow | null> {
  return prisma.session.findUnique({
    where: { id: sessionId },
    select: { pubkey: true, revokedAt: true, expiresAt: true },
  });
}

export async function findSessionByIdForUserId(
  sessionId: string
): Promise<SessionUserIdRow | null> {
  return prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true, revokedAt: true, expiresAt: true },
  });
}

export async function findSessionByIdFull(
  sessionId: string
): Promise<SessionFullRow | null> {
  return prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      pubkey: true,
      revokedAt: true,
      expiresAt: true,
    },
  });
}

export async function createSession(data: {
  userId: string;
  pubkey: string;
  expiresAt: Date;
}): Promise<{ id: string }> {
  return await prisma.session.create({
    data,
    select: { id: true },
  });
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
