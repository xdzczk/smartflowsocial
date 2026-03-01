export type PrimarySignerProfile =
  | {
      type: "nip46";
      method: "bunker_input";
      bunkerInput: string;
      label: string | null;
      expectedPubkey: string | null;
      updatedAt: string;
    }
  | {
      type: "nip46";
      method: "nostrconnect_uri";
      uri: string;
      relays: string[];
      label: string | null;
      expectedPubkey: string | null;
      updatedAt: string;
    };

function isIsoDateLike(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function isPrimarySignerProfile(
  value: unknown
): value is PrimarySignerProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  if (obj["type"] !== "nip46") {
    return false;
  }

  const labelOk = obj["label"] === null || typeof obj["label"] === "string";
  const expectedPubkeyOk =
    obj["expectedPubkey"] === null || typeof obj["expectedPubkey"] === "string";
  const updatedAtOk =
    typeof obj["updatedAt"] === "string" && isIsoDateLike(obj["updatedAt"]);

  if (!labelOk || !expectedPubkeyOk || !updatedAtOk) {
    return false;
  }

  if (obj["method"] === "bunker_input") {
    return typeof obj["bunkerInput"] === "string" && obj["bunkerInput"] !== "";
  }

  if (obj["method"] === "nostrconnect_uri") {
    return (
      typeof obj["uri"] === "string" &&
      obj["uri"] !== "" &&
      Array.isArray(obj["relays"]) &&
      obj["relays"].every((relay) => typeof relay === "string")
    );
  }

  return false;
}
