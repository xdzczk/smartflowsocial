import { useLocation, useNavigate } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { clearPersistedState } from "~/features/auth/lifecycle-manager.client";
import { postJson } from "~/features/auth/login-api.client";
import {
  getResumeDelayMs,
  normalizeError,
} from "~/features/auth/login-flow.client";
import { useNip07Login } from "~/features/auth/nip07-login.client";
import { useNip46Login } from "~/features/auth/nip46-login.client";
import {
  canonicalLoginMessage,
  createNip46NostrConnectUri,
  getNostrConnectAppMetadata,
} from "~/features/auth/nostr-signer.client";
import { parseRelayList } from "~/features/auth/parse-relay-list";
import {
  cacheNip46SignerFromLogin,
  clearActiveSignerConfig,
  getActiveSignerConfig,
} from "~/features/auth/signer";
import type { NostrEvent } from "~/features/nostr/types";
import {
  clearStoredReferralContext,
  getStoredReferralContext,
  setStoredReferralContext,
} from "~/features/referral/referral-context.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

import { appendPrimalCallback } from "../reconnect-uri.client";
import { useLoginPanelState } from "../useLoginPanelState.client";
import { useRelayCheck } from "../useRelayCheck.client";

import { LoginAwaitingProfileSelection } from "./LoginAwaitingProfileSelection";
import { LoginFailed } from "./LoginFailed";
import { LoginGenericLoading } from "./LoginGenericLoading";
import { LoginNip07Initializing } from "./LoginNip07Initializing";
import { LoginNip46Form } from "./LoginNip46Form";
import { LoginRequestingSignature } from "./LoginRequestingSignature";
import { LoginSignerSelection } from "./LoginSignerSelection";

const LOGIN_EVENT_KIND = 27235;

export default function NostrLoginPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const expectedPubkey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("expectedPubkey");
    if (!raw) return null;
    return nostrAdapter.decodeNpub(raw) ?? raw;
  }, [location.search]);

  const panelState = useLoginPanelState({ expectedPubkey });
  const {
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
  } = panelState;

  const errorRegionRef = useRef<HTMLDivElement | null>(null);
  const signerTransferredToManagerRef = useRef(false);

  const { startRelayChecks, closeRelaySockets } =
    useRelayCheck(setRelayStatuses);

  const nip07 = useNip07Login({
    expectedPubkey,
    ...nip07Callbacks,
  });

  const nip46 = useNip46Login({
    expectedPubkey,
    ...nip46Callbacks,
  });
  const nip46Ref = useRef(nip46);
  useEffect(() => {
    nip46Ref.current = nip46;
  }, [nip46]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref")?.trim();
    if (!ref) return;
    const hex = nostrAdapter.decodeNpub(ref);
    if (hex?.length !== 64) return;
    const npub = nostrAdapter.encodeNpub(hex);
    if (npub) {
      setStoredReferralContext({
        referrer_npub: npub,
        created_at: new Date().toISOString(),
      });
    }
  }, [location.search]);

  const relayUrls = useMemo(() => parseRelayList(relayList), [relayList]);

  const cleanup = useCallback(async () => {
    nip46Ref.current.cancelRef.current?.cancel();
    if (signer?.type === "nip46" && !signerTransferredToManagerRef.current) {
      await signer.close?.();
    }
  }, [signer]);

  const resetToSelection = useCallback(async () => {
    closeRelaySockets();
    setRelayStatuses({});
    try {
      await cleanup();
    } catch {
      // ignore
    }
    signerTransferredToManagerRef.current = false;
    clearActiveSignerConfig();
    setSigner(null);
    setPubkey(null);
    nip46.setNostrConnectUri(null);
    nip46.clearPendingNostrConnectStorage();
    setCopyOk(false);
    setError(null);
    setLastFailureOrigin(null);
    setActiveSignerFlow(null);
    setState("signer_selection");
  }, [
    cleanup,
    closeRelaySockets,
    nip46,
    setActiveSignerFlow,
    setCopyOk,
    setError,
    setLastFailureOrigin,
    setPubkey,
    setRelayStatuses,
    setSigner,
    setState,
  ]);

  const copyNostrConnectUri = useCallback(async () => {
    if (!nip46.nostrConnectUri) return;
    try {
      await navigator.clipboard.writeText(nip46.nostrConnectUri);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1500);
    } catch {
      // ignore
    }
  }, [nip46.nostrConnectUri, setCopyOk]);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    // Only perform relay health checks when configuring relays (signer_initializing).
    // Skip when awaiting approval so we don't open extra WebSockets alongside the
    // NIP-46 pool and hit browser "Insufficient resources" limits.
    if (typeof window === "undefined") return;
    const shouldCheck =
      nip46Tab === "nostrconnect" && state === "signer_initializing";
    if (!shouldCheck) {
      closeRelaySockets();
      // Keep relay statuses when awaiting approval or on failed screen so the UI shows last known status.
      if (state !== "awaiting_profile_selection" && state !== "failed") {
        queueMicrotask(() => setRelayStatuses({}));
      }
      return;
    }

    if (relayUrls.length === 0) {
      closeRelaySockets();
      queueMicrotask(() => setRelayStatuses({}));
      return;
    }

    // Debounce while user edits the relay list.
    const t = window.setTimeout(() => {
      startRelayChecks(relayUrls);
    }, 300);

    return () => {
      window.clearTimeout(t);
    };
  }, [
    closeRelaySockets,
    nip46Tab,
    relayUrls,
    setRelayStatuses,
    startRelayChecks,
    state,
  ]);

  useEffect(() => {
    if (state === "failed" && errorRegionRef.current) {
      errorRegionRef.current.focus();
    }
  }, [state]);

  // Fetch display name for "Signing in as username" when awaiting signature
  useEffect(() => {
    const isSigning =
      state === "requesting_signature" || state === "verifying_signature";
    if (!pubkey || !isSigning) {
      queueMicrotask(() => setSigningInDisplayName(null));
      return;
    }
    let cancelled = false;
    const q = new URLSearchParams({ pubkey });
    void (async () => {
      try {
        const res = await fetch(`/api/profile-display-name?${q}`);
        const data = (await res.json()) as { displayName?: string | null };
        const name =
          typeof data.displayName === "string" && data.displayName.trim()
            ? data.displayName.trim()
            : null;
        // Only update when we have a display name and effect wasn't cancelled
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- name is string | null; cancelled can be true after cleanup
        if (!cancelled && name) {
          setSigningInDisplayName(name);
        }
      } catch {
        // Keep display name null on error; we fall back to npub
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pubkey, setSigningInDisplayName, state]);

  // Timeout progress indicator
  useEffect(() => {
    if (
      !connectionStartTime ||
      !connectionTimeout ||
      state !== "awaiting_profile_selection"
    ) {
      queueMicrotask(() => setTimeRemaining(null));
      return;
    }

    const updateProgress = () => {
      const elapsed = Date.now() - connectionStartTime;
      const remaining = Math.max(0, connectionTimeout - elapsed);
      setTimeRemaining(remaining);
    };

    updateProgress(); // Initial update
    const interval = setInterval(updateProgress, 1000); // Update every second
    return () => clearInterval(interval);
  }, [connectionStartTime, connectionTimeout, setTimeRemaining, state]);

  // Store initNip46 in a ref so we can use it in the visibility change handler
  const connectNip46Ref = useRef<(() => void) | null>(null);
  useEffect(() => {
    connectNip46Ref.current = () => {
      setNip46AttemptCount((c) => c + 1);
      setActiveSignerFlow("nip46");
      setState("awaiting_profile_selection");
      void nip46.connect({
        relayList,
        nip46Tab,
        nip46Input,
        retryCount: 0,
        currentUri: nip46.nostrConnectUri,
        currentState: state,
      });
    };
    return () => {
      connectNip46Ref.current = null;
    };
  }, [
    nip46,
    relayList,
    nip46Tab,
    nip46Input,
    state,
    setActiveSignerFlow,
    setNip46AttemptCount,
    setState,
  ]);

  const handleLoginWithPrimal = useCallback(() => {
    if (nip46.nostrConnectUri) {
      window.location.href = appendPrimalCallback(nip46.nostrConnectUri);
      return;
    }
    const relays = parseRelayList(relayList);
    if (relays.length === 0) return;
    const created = createNip46NostrConnectUri({
      relays,
      appName: "SmartFlowSocial",
      ...getNostrConnectAppMetadata(),
    });
    const uriWithCallback = appendPrimalCallback(created.uri);
    nip46.setPendingUri(
      uriWithCallback,
      created.clientSecretKey,
      created.relays
    );
    try {
      created.pool.close(created.relays);
    } catch {
      // ignore
    }
    setNip46Tab("nostrconnect");
    setState("awaiting_profile_selection");
    setConnectionStartTime(Date.now());
    setConnectionTimeout(120_000);
    window.location.href = uriWithCallback;
  }, [
    nip46,
    relayList,
    setConnectionStartTime,
    setConnectionTimeout,
    setNip46Tab,
    setState,
  ]);

  // Detect app switching on mobile during connection
  useEffect(() => {
    if (
      state !== "awaiting_profile_selection" &&
      state !== "failed" &&
      state !== "signer_initializing"
    ) {
      queueMicrotask(() => setWasHiddenDuringConnection(false));
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWasHiddenDuringConnection(true);
        if (state === "awaiting_profile_selection") {
          nip46.cancelRef.current?.cancel();
        }
      } else if (wasHiddenDuringConnection) {
        setWasHiddenDuringConnection(false);
        if (
          nip46.nostrConnectUri &&
          (state === "awaiting_profile_selection" || state === "failed")
        ) {
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            setError({
              code: "UNKNOWN",
              message: "You're offline. Check your connection and try again.",
            });
            setState("failed");
            return;
          }
          if (state === "failed") {
            setError(null);
            setState("awaiting_profile_selection");
          }
          setTimeout(() => {
            if (nip46.getPendingNostrConnect()) {
              void nip46.resume();
            } else {
              const config = getActiveSignerConfig();
              if (
                config?.type === "nip46" &&
                config.method === "nostrconnect_uri"
              ) {
                connectNip46Ref.current?.();
              }
            }
          }, getResumeDelayMs());
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    nip46,
    state,
    wasHiddenDuringConnection,
    setError,
    setState,
    setWasHiddenDuringConnection,
  ]);

  // After full page load (e.g. redirect back from Primal), restore pending NIP-46 and resume connection.
  // Run once on mount only; use ref so we don't depend on nip46 (new ref every render would reset the timeout).
  useEffect(() => {
    const pending = nip46Ref.current.getPendingNostrConnect();
    if (!pending) return;
    const t = setTimeout(() => {
      void nip46Ref.current.resume();
    }, getResumeDelayMs());
    return () => clearTimeout(t);
  }, []);

  const performLogin = useCallback(async () => {
    if (!signer || !pubkey) return;
    setError(null);
    setLastFailureOrigin(null);
    setState("requesting_signature");

    try {
      const challenge = await postJson<{
        challengeId: string;
        nonce: string;
        purpose: string;
        expiresAt: string;
      }>("/auth/nostr/challenge");

      const content = canonicalLoginMessage({
        nonce: challenge.nonce,
        expiresAtIso: challenge.expiresAt,
      });

      const event: NostrEvent = {
        kind: LOGIN_EVENT_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content,
      };

      // Add timeout for signature request to prevent UI freeze
      // Some extensions (like Keychat on iOS) may hang or be slow to respond
      const SIGNATURE_TIMEOUT_MS = 60_000; // 60 seconds
      const signaturePromise = signer.signEvent(event);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Signature request timed out. Please try again or check your extension."
              )
            ),
          SIGNATURE_TIMEOUT_MS
        )
      );

      const signedEvent = await Promise.race([
        signaturePromise,
        timeoutPromise,
      ]);

      setState("verifying_signature");
      const verifyBody: {
        challengeId: string;
        pubkey: string;
        signedEvent: unknown;
        referral_context?: string;
      } = {
        challengeId: challenge.challengeId,
        pubkey,
        signedEvent,
      };
      const referralContext = getStoredReferralContext();
      if (referralContext) {
        verifyBody.referral_context = JSON.stringify(referralContext);
      }
      const verify = await postJson<{
        success: true;
        redirectTo: string;
        sessionId: string;
        pubkey: string;
      }>("/auth/nostr/verify", verifyBody);

      setState("authenticated");
      if (referralContext) {
        clearStoredReferralContext();
      }
      // Transfer NIP-46 signer to the manager so publish/schedule can use it without opening a second connection
      if (signer.type === "nip46") {
        cacheNip46SignerFromLogin(signer);
        signerTransferredToManagerRef.current = true;
      }
      // Use client-side navigation so the in-memory NIP-46 signer cache is preserved (full reload would lose it)
      queryClient.clear();
      clearPersistedState();
      navigate(verify.redirectTo, { replace: true });
    } catch (e) {
      const n = normalizeError(e);
      // Map a few known server messages to typed errors
      if (n.message.toLowerCase().includes("challenge expired")) {
        setError({
          code: "CHALLENGE_EXPIRED",
          message: "Login challenge expired",
          details: n.details,
        });
      } else if (n.message.toLowerCase().includes("invalid signature")) {
        setError({
          code: "SIGNATURE_INVALID",
          message: "Signature invalid",
          details: n.details,
        });
      } else if (
        n.message.toLowerCase().includes("timeout") ||
        n.message.toLowerCase().includes("timed out")
      ) {
        setError({
          code: "SIGNER_TIMEOUT",
          message:
            "Signature request timed out. The extension may be slow to respond. Please try again or check your extension settings.",
          details: n.details,
        });
      } else {
        setError(n);
      }
      setLastFailureOrigin("verify");
      setState("failed");
    }
  }, [
    pubkey,
    signer,
    queryClient,
    navigate,
    setError,
    setLastFailureOrigin,
    setState,
  ]);

  // When we land on "requesting_signature" (after extension or remote signer is ready),
  // trigger the actual signature request. The UI shows "Waiting for signature..." but we
  // must call performLogin() to ask the extension/signer to sign — we were not doing this
  // before, so the user was stuck with no prompt from the extension.
  const hasTriggeredLoginRef = useRef(false);
  useEffect(() => {
    if (state !== "requesting_signature" || !signer || !pubkey) {
      if (state !== "requesting_signature") {
        hasTriggeredLoginRef.current = false;
      }
      return;
    }
    if (hasTriggeredLoginRef.current) return;
    hasTriggeredLoginRef.current = true;
    queueMicrotask(() => void performLogin());
  }, [state, signer, pubkey, performLogin]);

  const handleTryAgain = useCallback(() => {
    if (lastFailureOrigin === "nip46_init") {
      if (nip46.getPendingNostrConnect()) {
        void nip46.resume();
      } else {
        connectNip46Ref.current?.();
      }
      return;
    }
    if (lastFailureOrigin === "nip07_init") {
      setActiveSignerFlow("nip07");
      setState("signer_initializing");
      void nip07.connect();
      return;
    }
    if (lastFailureOrigin === "verify") {
      void performLogin();
      return;
    }
    void resetToSelection();
  }, [
    lastFailureOrigin,
    nip46,
    nip07,
    performLogin,
    resetToSelection,
    setActiveSignerFlow,
    setState,
  ]);

  const isConnectionInProgress =
    !!nip46.nostrConnectUri &&
    (state === "awaiting_profile_selection" ||
      state === "requesting_signature" ||
      state === "verifying_signature");

  const connectNip46 = useCallback(() => {
    setNip46AttemptCount((c) => c + 1);
    setActiveSignerFlow("nip46");
    setState("awaiting_profile_selection");
    // Free relay-check WebSockets before NIP-46 pool connects to avoid hitting
    // browser connection limits (Insufficient resources).
    closeRelaySockets();
    void nip46.connect({
      relayList,
      nip46Tab,
      nip46Input,
      retryCount: 0,
      currentUri: nip46.nostrConnectUri,
      currentState: state,
    });
  }, [
    nip46,
    relayList,
    nip46Tab,
    nip46Input,
    state,
    setActiveSignerFlow,
    setNip46AttemptCount,
    setState,
    closeRelaySockets,
  ]);

  return (
    <div className="space-y-4">
      {state === "signer_selection" ? (
        <LoginSignerSelection
          onNip07={() => {
            setActiveSignerFlow("nip07");
            setState("signer_initializing");
            void nip07.connect();
          }}
          onNip46={() => {
            setActiveSignerFlow("nip46");
            setState("signer_initializing");
          }}
          onPrimal={handleLoginWithPrimal}
          nip07Available={nip07.available}
        />
      ) : null}

      {state === "signer_initializing" &&
      !signer &&
      activeSignerFlow === "nip07" ? (
        <LoginNip07Initializing />
      ) : null}

      {state === "signer_initializing" &&
      !signer &&
      activeSignerFlow == null ? (
        <LoginGenericLoading message="Preparing sign in…" />
      ) : null}

      {state === "signer_initializing" &&
      !signer &&
      activeSignerFlow === "nip46" ? (
        <LoginNip46Form
          nip46Tab={nip46Tab}
          setNip46Tab={setNip46Tab}
          nip46Input={nip46Input}
          setNip46Input={setNip46Input}
          relayList={relayList}
          setRelayList={setRelayList}
          onConnect={connectNip46}
          onCancel={() => void resetToSelection()}
          relayStatuses={relayStatuses}
          relayUrls={relayUrls}
          isConnectionInProgress={isConnectionInProgress}
          nostrConnectUri={nip46.nostrConnectUri}
        />
      ) : null}

      {state === "awaiting_profile_selection" ? (
        <LoginAwaitingProfileSelection
          wasHiddenDuringConnection={wasHiddenDuringConnection}
          timeRemaining={timeRemaining}
          connectionTimeout={connectionTimeout}
          relayUrls={relayUrls}
          relayStatuses={relayStatuses}
          nostrConnectUri={nip46.nostrConnectUri}
          onCopyUri={() => void copyNostrConnectUri()}
          copyOk={copyOk}
          onLoginWithPrimal={handleLoginWithPrimal}
          onCancel={() => void resetToSelection()}
        />
      ) : null}

      {pubkey &&
      (state === "requesting_signature" || state === "verifying_signature") ? (
        <LoginRequestingSignature
          signingInDisplayName={signingInDisplayName}
          pubkey={pubkey}
          isVerifying={state === "verifying_signature"}
          onCancel={() => void resetToSelection()}
        />
      ) : null}

      {!pubkey &&
      (state === "requesting_signature" || state === "verifying_signature") ? (
        <LoginGenericLoading message="Finalizing sign in…" />
      ) : null}

      {state === "failed" && error ? (
        <LoginFailed
          ref={errorRegionRef}
          error={error}
          relayStatuses={relayStatuses}
          relayUrls={relayUrls}
          lastFailureOrigin={lastFailureOrigin}
          nip46AttemptCount={nip46AttemptCount}
          onTryAgain={handleTryAgain}
          onBack={() => void resetToSelection()}
        />
      ) : null}
    </div>
  );
}
