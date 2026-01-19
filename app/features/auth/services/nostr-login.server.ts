import {
  consumeChallengeAndCreateSession,
  createLoginChallenge,
  findLoginChallengeForVerify,
} from "~/models/login-challenge.server";

export async function issueLoginChallenge(input: {
  nonce: string;
  purpose: string;
  expiresAt: Date;
}) {
  return await createLoginChallenge(input);
}

export async function getLoginChallengeForVerify(input: { id: string }) {
  return await findLoginChallengeForVerify(input);
}

export async function consumeLoginChallengeAndCreateSession(input: {
  challengeId: string;
  pubkey: string;
  profileJson: string;
  sessionTtlMs: number;
  profileRefreshTtlMs: number;
}): Promise<string> {
  return await consumeChallengeAndCreateSession(input);
}
