/**
 * Subscribe to kind 1018 votes for a NIP-88 poll and aggregate tallies (client-side).
 */

import type { Event, Filter } from "nostr-tools";
import { SimplePool } from "nostr-tools";
import { useEffect, useMemo, useRef, useState } from "react";

import { aggregatePollVotes, KIND_VOTE, type VoteEventLike } from "./nip88";
import type { PollDefinition, PollTallyResult } from "./nip88.types";

function eventToVoteLike(ev: Event): VoteEventLike {
  return {
    id: ev.id,
    pubkey: ev.pubkey,
    created_at: ev.created_at,
    kind: ev.kind,
    tags: ev.tags,
  };
}

export function usePollTally(
  poll: PollDefinition | null,
  enabled: boolean
): {
  tally: PollTallyResult | null;
  loading: boolean;
} {
  const [events, setEvents] = useState<VoteEventLike[]>([]);
  const [loading, setLoading] = useState(false);
  const genRef = useRef(0);

  useEffect(() => {
    /* Reset when poll/relays change; sync setState primes UI before relay callbacks fire. */
    /* eslint-disable react-hooks/set-state-in-effect -- reset tally state when poll subscription input changes */
    if (!poll || !enabled || poll.relayUrls.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const gen = ++genRef.current;
    setEvents([]);
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    const pool = new SimplePool();
    const relays = poll.relayUrls;

    const filter: Filter = {
      kinds: [KIND_VOTE],
      "#e": [poll.id],
      ...(poll.endsAt !== undefined ? { until: poll.endsAt } : {}),
    };

    pool.subscribeMany(relays, filter, {
      onevent: (ev: Event) => {
        if (gen !== genRef.current) return;
        if (ev.kind !== KIND_VOTE) return;
        setEvents((prev) => {
          if (prev.some((x) => x.id === ev.id)) return prev;
          return [...prev, eventToVoteLike(ev)];
        });
      },
      oneose: () => {
        if (gen === genRef.current) setLoading(false);
      },
    });

    const t = window.setTimeout(() => {
      if (gen === genRef.current) setLoading(false);
    }, 12_000);

    return () => {
      window.clearTimeout(t);
      try {
        pool.close(relays);
      } catch {
        /* ignore */
      }
    };
  }, [poll, enabled]);

  const tally = useMemo(() => {
    if (!poll) return null;
    return aggregatePollVotes(events, poll);
  }, [events, poll]);

  return { tally, loading };
}
