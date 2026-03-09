import { useMemo, useState } from "react";

import type {
  ActiveSignerFlow,
  LoginError,
  LoginState,
  RelayStatus,
} from "./login-flow.client";
import type { Nip46LoginError } from "./nip46-login.client";
import type { NostrSigner } from "./nostr-signer.client";
import { DEFAULT_RELAYS } from "./reconnect-dialog-utils.client";

export interface UseLoginPanelStateParams {
  expectedPubkey: string | null;
}

export interface LoginPanelState {
  state: LoginState;
  setState: React.Dispatch<React.SetStateAction<LoginState>>;
  activeSignerFlow: ActiveSignerFlow;
  setActiveSignerFlow: React.Dispatch<React.SetStateAction<ActiveSignerFlow>>;
  error: { code: LoginError; message: string; details?: string } | null;
  setError: React.Dispatch<
    React.SetStateAction<{
      code: LoginError;
      message: string;
      details?: string;
    } | null>
  >;
  signer: NostrSigner | null;
  setSigner: React.Dispatch<React.SetStateAction<NostrSigner | null>>;
  pubkey: string | null;
  setPubkey: React.Dispatch<React.SetStateAction<string | null>>;
  signingInDisplayName: string | null;
  setSigningInDisplayName: React.Dispatch<React.SetStateAction<string | null>>;
  nip46Tab: "bunker" | "nostrconnect";
  setNip46Tab: (tab: "bunker" | "nostrconnect") => void;
  nip46Input: string;
  setNip46Input: (value: string) => void;
  relayList: string;
  setRelayList: (value: string) => void;
  copyOk: boolean;
  setCopyOk: (value: boolean) => void;
  nip46AttemptCount: number;
  setNip46AttemptCount: React.Dispatch<React.SetStateAction<number>>;
  relayStatuses: Record<string, RelayStatus>;
  setRelayStatuses: React.Dispatch<
    React.SetStateAction<Record<string, RelayStatus>>
  >;
  lastFailureOrigin: "nip07_init" | "nip46_init" | "verify" | null;
  setLastFailureOrigin: React.Dispatch<
    React.SetStateAction<"nip07_init" | "nip46_init" | "verify" | null>
  >;
  connectionStartTime: number | null;
  setConnectionStartTime: React.Dispatch<React.SetStateAction<number | null>>;
  connectionTimeout: number | null;
  setConnectionTimeout: React.Dispatch<React.SetStateAction<number | null>>;
  timeRemaining: number | null;
  setTimeRemaining: React.Dispatch<React.SetStateAction<number | null>>;
  wasHiddenDuringConnection: boolean;
  setWasHiddenDuringConnection: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface Nip07Callbacks {
  onSuccess: (signer: NostrSigner, pubkey: string) => void;
  onFailure: (error: Nip46LoginError) => void;
}

export interface Nip46Callbacks {
  onSuccess: (signer: NostrSigner, pubkey: string) => void;
  onFailure: (error: Nip46LoginError) => void;
  onConnectionStart: (timeoutMs: number) => void;
  onConnectionEnd: () => void;
}

export function useLoginPanelState(
  _params: UseLoginPanelStateParams
): LoginPanelState & {
  nip07Callbacks: Nip07Callbacks;
  nip46Callbacks: Nip46Callbacks;
} {
  const [state, setState] = useState<LoginState>("signer_selection");
  const [activeSignerFlow, setActiveSignerFlow] =
    useState<ActiveSignerFlow>(null);
  const [error, setError] = useState<{
    code: LoginError;
    message: string;
    details?: string;
  } | null>(null);
  const [signer, setSigner] = useState<NostrSigner | null>(null);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [signingInDisplayName, setSigningInDisplayName] = useState<
    string | null
  >(null);
  const [nip46Tab, setNip46Tab] = useState<"bunker" | "nostrconnect">("bunker");
  const [nip46Input, setNip46Input] = useState("");
  const [relayList, setRelayList] = useState(DEFAULT_RELAYS);
  const [copyOk, setCopyOk] = useState(false);
  const [nip46AttemptCount, setNip46AttemptCount] = useState(0);
  const [relayStatuses, setRelayStatuses] = useState<
    Record<string, RelayStatus>
  >({});
  const [lastFailureOrigin, setLastFailureOrigin] = useState<
    "nip07_init" | "nip46_init" | "verify" | null
  >(null);
  const [connectionStartTime, setConnectionStartTime] = useState<number | null>(
    null
  );
  const [connectionTimeout, setConnectionTimeout] = useState<number | null>(
    null
  );
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [wasHiddenDuringConnection, setWasHiddenDuringConnection] =
    useState(false);

  const nip07Callbacks: Nip07Callbacks = useMemo(
    () => ({
      onSuccess: (s, pk) => {
        setSigner(s);
        setPubkey(pk);
        setActiveSignerFlow("nip07");
        setState("requesting_signature");
      },
      onFailure: (e) => {
        setError(e);
        setLastFailureOrigin("nip07_init");
        setState("failed");
      },
    }),
    []
  );

  const nip46Callbacks: Nip46Callbacks = useMemo(
    () => ({
      onSuccess: (s, pk) => {
        setSigner(s);
        setPubkey(pk);
        setState("requesting_signature");
      },
      onFailure: (e) => {
        setError(e);
        setLastFailureOrigin("nip46_init");
        setState("failed");
      },
      onConnectionStart: (timeoutMs) => {
        setConnectionStartTime(Date.now());
        setConnectionTimeout(timeoutMs);
      },
      onConnectionEnd: () => {
        setConnectionStartTime(null);
        setConnectionTimeout(null);
      },
    }),
    []
  );

  return {
    state,
    setState,
    activeSignerFlow,
    setActiveSignerFlow,
    error,
    setError,
    signer,
    setSigner,
    pubkey,
    setPubkey,
    signingInDisplayName,
    setSigningInDisplayName,
    nip46Tab,
    setNip46Tab,
    nip46Input,
    setNip46Input,
    relayList,
    setRelayList,
    copyOk,
    setCopyOk,
    nip46AttemptCount,
    setNip46AttemptCount,
    relayStatuses,
    setRelayStatuses,
    lastFailureOrigin,
    setLastFailureOrigin,
    connectionStartTime,
    setConnectionStartTime,
    connectionTimeout,
    setConnectionTimeout,
    timeRemaining,
    setTimeRemaining,
    wasHiddenDuringConnection,
    setWasHiddenDuringConnection,
    nip07Callbacks,
    nip46Callbacks,
  };
}
