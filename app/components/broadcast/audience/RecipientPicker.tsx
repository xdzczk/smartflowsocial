import { UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { formatNpubShort } from "~/lib/nostr-conversion";
import { cn } from "~/lib/utils";

export type PickerPoolTab = "followers" | "mutuals" | "saved";

export interface RecipientProfile {
  pubkey: string;
  name: string;
  picture: string | null;
  nip05: string | null;
}

interface PoolResponse {
  pubkeys: string[];
  fetchFailed: boolean;
  truncatedNote: string | null;
}

interface ProfilesResponse {
  profiles: RecipientProfile[];
}

interface ExpandResponse {
  pubkeys: string[];
  fetchFailed: boolean;
}

export interface RecipientPickerProps {
  savedAudiences: Array<{
    id: string;
    name: string;
    audienceType: string;
    lastResolvedSize: number | null;
    updatedAt: string;
  }>;
  selectedPubkeys: string[];
  onChangeSelected: (pubkeys: string[]) => void;
  /** Live counts for summary rail */
  onSelectionStats?: (s: {
    selected: number;
    suppressed: number;
    sendable: number;
  }) => void;
  disabled?: boolean;
}

const MAX_BROWSER_ROWS = 400;
const PROFILE_BATCH = 120;
const CHIP_THRESHOLD = 24;
const CACHE_TTL_MS = 2 * 60 * 1000;

const POOL_SEGMENT_OPTIONS = [
  { value: "followers", label: "Followers" },
  { value: "mutuals", label: "Mutuals" },
  { value: "saved", label: "Saved audiences" },
] as const;

interface CachedPoolData {
  pubkeys: string[];
  fetchFailed: boolean;
  truncatedNote: string | null;
  fetchedAt: number;
}

interface CachedSavedExpandData {
  pubkeys: string[];
  fetchFailed: boolean;
  fetchedAt: number;
}

function initials(name: string, pubkey: string): string {
  const t = name.trim();
  if (t.length >= 2) return t.slice(0, 2).toUpperCase();
  return pubkey.slice(0, 2).toUpperCase();
}

async function postProfiles(pubkeys: string[]): Promise<RecipientProfile[]> {
  if (pubkeys.length === 0) return [];
  const res = await fetch("/api/broadcast-recipient-profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ pubkeys }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as ProfilesResponse;
  const list = data.profiles;
  return Array.isArray(list) ? list : [];
}

async function postSuppressionMap(
  pubkeys: string[]
): Promise<Record<string, boolean>> {
  if (pubkeys.length === 0) return {};
  const res = await fetch("/api/broadcast-check-suppression", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ pubkeys }),
  });
  if (!res.ok) return {};
  const data = (await res.json()) as { suppressed: unknown };
  const m = data.suppressed;
  if (m !== null && typeof m === "object" && !Array.isArray(m)) {
    return m as Record<string, boolean>;
  }
  return {};
}

/* eslint-disable sonarjs/cognitive-complexity -- picker coordinates pools, saved expand, tray */
export function RecipientPicker({
  savedAudiences,
  selectedPubkeys,
  onChangeSelected,
  onSelectionStats,
  disabled,
}: RecipientPickerProps) {
  const [poolTab, setPoolTab] = useState<PickerPoolTab>("followers");
  const [search, setSearch] = useState("");
  const [profileMap, setProfileMap] = useState<
    Record<string, RecipientProfile>
  >({});
  const [checkedBrowser, setCheckedBrowser] = useState<Set<string>>(
    () => new Set()
  );
  const [expandingSavedId, setExpandingSavedId] = useState<string | null>(null);
  const [expandingLoadingId, setExpandingLoadingId] = useState<string | null>(
    null
  );
  const [expandedMembers, setExpandedMembers] = useState<string[]>([]);
  const [expandedFailed, setExpandedFailed] = useState(false);
  const [poolLoadingTab, setPoolLoadingTab] = useState<
    "followers" | "mutuals" | null
  >(null);
  const [poolCache, setPoolCache] = useState<
    Partial<Record<"followers" | "mutuals", CachedPoolData>>
  >({});
  const [savedExpandCache, setSavedExpandCache] = useState<
    Record<string, CachedSavedExpandData>
  >({});

  const selectedSet = useMemo(
    () => new Set(selectedPubkeys.map((p) => p.toLowerCase())),
    [selectedPubkeys]
  );

  const profileMapRef = useRef(profileMap);
  profileMapRef.current = profileMap;

  const loadProfilesFor = useCallback(async (pubkeys: string[]) => {
    const need = [
      ...new Set(
        pubkeys
          .map((p) => p.toLowerCase())
          .filter((p) => /^[0-9a-f]{64}$/i.test(p))
      ),
    ];
    const missing = need.filter((p) => !profileMapRef.current[p]);
    if (missing.length === 0) return;
    for (let i = 0; i < missing.length; i += PROFILE_BATCH) {
      const batch = missing.slice(i, i + PROFILE_BATCH);
      const prof = await postProfiles(batch);
      setProfileMap((prev) => {
        const next = { ...prev };
        for (const p of prof) {
          next[p.pubkey.toLowerCase()] = p;
        }
        return next;
      });
    }
  }, []);

  useEffect(() => {
    void loadProfilesFor(selectedPubkeys);
  }, [loadProfilesFor, selectedPubkeys]);

  const loadPoolForTab = useCallback(
    async (tab: "followers" | "mutuals") => {
      const cached = poolCache[tab];
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return;
      }
      setPoolLoadingTab(tab);
      try {
        const res = await fetch(`/api/broadcast-eligible-pool?pool=${tab}`);
        if (!res.ok) {
          setPoolCache((prev) => ({
            ...prev,
            [tab]: {
              pubkeys: [],
              fetchFailed: true,
              truncatedNote: null,
              fetchedAt: Date.now(),
            },
          }));
          return;
        }
        const data = (await res.json()) as PoolResponse;
        setPoolCache((prev) => ({
          ...prev,
          [tab]: {
            pubkeys: data.pubkeys,
            fetchFailed: data.fetchFailed,
            truncatedNote: data.truncatedNote,
            fetchedAt: Date.now(),
          },
        }));
      } catch {
        setPoolCache((prev) => ({
          ...prev,
          [tab]: {
            pubkeys: [],
            fetchFailed: true,
            truncatedNote: null,
            fetchedAt: Date.now(),
          },
        }));
      } finally {
        setPoolLoadingTab((prev) => (prev === tab ? null : prev));
      }
    },
    [poolCache]
  );

  useEffect(() => {
    if (poolTab !== "followers" && poolTab !== "mutuals") return;
    void loadPoolForTab(poolTab);
  }, [poolTab, loadPoolForTab]);

  useEffect(() => {
    if (poolTab !== "followers") return;
    void loadPoolForTab("mutuals");
  }, [poolTab, loadPoolForTab]);

  useEffect(() => {
    if (poolTab !== "followers" && poolTab !== "mutuals") return;
    const keys = poolCache[poolTab]?.pubkeys;
    if (!keys?.length) return;
    void loadProfilesFor(keys);
  }, [poolCache, poolTab, loadProfilesFor]);

  const fetchSavedAudienceMembers = useCallback(
    async (id: string): Promise<CachedSavedExpandData | null> => {
      const cached = savedExpandCache[id];
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached;
      }
      try {
        const res = await fetch(
          `/api/broadcast-expand-saved-audience?savedAudienceId=${encodeURIComponent(id)}`
        );
        if (!res.ok) return null;
        const data = (await res.json()) as ExpandResponse;
        const entry: CachedSavedExpandData = {
          pubkeys: data.pubkeys,
          fetchFailed: data.fetchFailed,
          fetchedAt: Date.now(),
        };
        setSavedExpandCache((prev) => ({ ...prev, [id]: entry }));
        return entry;
      } catch {
        return null;
      }
    },
    [savedExpandCache]
  );

  const openExpandSaved = useCallback(
    (id: string) => {
      setExpandingSavedId(id);
      setExpandedMembers([]);
      setExpandedFailed(false);
      setExpandingLoadingId(id);
      void (async () => {
        const entry = await fetchSavedAudienceMembers(id);
        setExpandingLoadingId((prev) => (prev === id ? null : prev));
        if (!entry) {
          setExpandedFailed(true);
          return;
        }
        setExpandedMembers(entry.pubkeys);
        setExpandedFailed(entry.fetchFailed);
        void loadProfilesFor(entry.pubkeys);
      })();
    },
    [fetchSavedAudienceMembers, loadProfilesFor]
  );

  const relationshipLabel =
    poolTab === "followers"
      ? "Follower"
      : poolTab === "mutuals"
        ? "Mutual"
        : "Saved";
  const mutualSet = useMemo(
    () =>
      new Set(
        (poolCache["mutuals"]?.pubkeys ?? []).map((p) => p.toLowerCase())
      ),
    [poolCache]
  );

  const filteredPoolRows = useMemo(() => {
    const poolPubkeys =
      poolTab === "followers" || poolTab === "mutuals"
        ? (poolCache[poolTab]?.pubkeys ?? [])
        : [];
    const q = search.trim().toLowerCase();
    const list = poolPubkeys.map((pk) => pk.toLowerCase());
    if (!q) return list;
    return list.filter((pk) => {
      const pr = profileMap[pk];
      const npubShort = formatNpubShort(pk).toLowerCase();
      const name = (pr?.name ?? "").toLowerCase();
      const nip = (pr?.nip05 ?? "").toLowerCase();
      return (
        pk.includes(q) ||
        npubShort.includes(q) ||
        name.includes(q) ||
        nip.includes(q)
      );
    });
  }, [poolCache, poolTab, profileMap, search]);

  const displayRows = useMemo(
    () => filteredPoolRows.slice(0, MAX_BROWSER_ROWS),
    [filteredPoolRows]
  );

  const addPubkeys = useCallback(
    (pubkeys: string[]) => {
      const next = new Set(selectedPubkeys.map((p) => p.toLowerCase()));
      for (const p of pubkeys) {
        const pl = p.toLowerCase();
        if (/^[0-9a-f]{64}$/i.test(pl)) next.add(pl);
      }
      onChangeSelected([...next]);
    },
    [onChangeSelected, selectedPubkeys]
  );

  const removePubkey = (pk: string) => {
    const pl = pk.toLowerCase();
    onChangeSelected(selectedPubkeys.filter((p) => p.toLowerCase() !== pl));
  };

  const toggleCheck = (pk: string) => {
    setCheckedBrowser((prev) => {
      const n = new Set(prev);
      if (n.has(pk)) n.delete(pk);
      else n.add(pk);
      return n;
    });
  };

  const addChecked = () => {
    if (checkedBrowser.size === 0) return;
    addPubkeys([...checkedBrowser]);
    setCheckedBrowser(new Set());
  };

  const [suppressedMap, setSuppressedMap] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        const m = await postSuppressionMap(selectedPubkeys);
        setSuppressedMap(m);
      })();
    }, 280);
    return () => {
      window.clearTimeout(t);
    };
  }, [selectedPubkeys]);

  const suppressedCount = useMemo(
    () => selectedPubkeys.filter((p) => suppressedMap[p.toLowerCase()]).length,
    [selectedPubkeys, suppressedMap]
  );
  const sendableCount = selectedPubkeys.length - suppressedCount;

  useEffect(() => {
    onSelectionStats?.({
      selected: selectedPubkeys.length,
      suppressed: suppressedCount,
      sendable: sendableCount,
    });
  }, [
    onSelectionStats,
    selectedPubkeys.length,
    suppressedCount,
    sendableCount,
  ]);

  const poolState =
    poolTab === "followers" || poolTab === "mutuals"
      ? (poolCache[poolTab] ?? null)
      : null;
  const poolFailed = poolState?.fetchFailed ?? false;
  const poolNote = poolState?.truncatedNote ?? null;

  return (
    <div className="border-border space-y-4 rounded-xl border p-4">
      <p className="text-text-secondary text-xs">
        Only eligible recipients are included at send time. Search filters the
        list below.
      </p>

      <div className="flex flex-wrap gap-1 rounded-lg border p-1">
        <SegmentedControl
          aria-label="Recipient pool"
          value={poolTab}
          onChange={(next) => {
            setPoolTab(next as PickerPoolTab);
            setSearch("");
            setCheckedBrowser(new Set());
            setExpandingSavedId(null);
            setExpandedMembers([]);
          }}
          options={POOL_SEGMENT_OPTIONS}
          size="default"
          inactiveSurface={false}
          disabled={disabled ?? false}
          className="min-w-0 flex-1 sm:flex-none [&_button]:text-xs"
        />
        <button
          type="button"
          disabled
          className="text-text-secondary cursor-not-allowed rounded-md px-3 py-1.5 text-xs font-medium opacity-60"
          title="Coming soon"
        >
          Prior contacts
        </button>
      </div>

      <div>
        <label
          htmlFor="recipient-picker-search"
          className="text-text-secondary mb-1 block text-xs font-medium"
        >
          Search eligible recipients
        </label>
        <Input
          id="recipient-picker-search"
          value={search}
          disabled={(disabled ?? false) || poolTab === "saved"}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          placeholder="Name, npub, or public key"
          className="font-mono text-sm"
        />
      </div>

      {poolTab === "saved" ? (
        <div className="space-y-3">
          {savedAudiences.length === 0 ? (
            <p className="text-text-secondary text-sm">
              No saved audiences. Save recipient groups you reuse often to speed
              up future broadcasts.
            </p>
          ) : (
            savedAudiences.map((s) => (
              <div
                key={s.id}
                className="border-border stack-tight rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-text-secondary text-xs">
                    {s.audienceType}
                    {s.lastResolvedSize != null
                      ? ` · last size ${String(s.lastResolvedSize)}`
                      : ""}{" "}
                    · updated {new Date(s.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={disabled}
                    onClick={() => {
                      void (async () => {
                        const entry = await fetchSavedAudienceMembers(s.id);
                        if (!entry) return;
                        addPubkeys(entry.pubkeys);
                        void loadProfilesFor(entry.pubkeys);
                      })();
                    }}
                  >
                    Add all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => {
                      openExpandSaved(s.id);
                    }}
                  >
                    {expandingSavedId === s.id && expandingLoadingId === s.id
                      ? "Loading…"
                      : "View"}
                  </Button>
                </div>
              </div>
            ))
          )}
          {expandingSavedId && expandedMembers.length > 0 ? (
            <div className="border-border max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {expandedFailed ? (
                <p className="text-danger text-xs">
                  Could not load members. Try again.
                </p>
              ) : null}
              {expandedMembers.slice(0, MAX_BROWSER_ROWS).map((pk) => {
                const pl = pk.toLowerCase();
                const pr = profileMap[pl] ?? {
                  pubkey: pl,
                  name: `${pl.slice(0, 8)}…`,
                  picture: null,
                  nip05: null,
                };
                const inSel = selectedSet.has(pl);
                return (
                  <div
                    key={pl}
                    className="hover:bg-surface-hover/50 flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={pr.picture ?? undefined} alt="" />
                        <AvatarFallback className="text-[10px]">
                          {initials(pr.name, pl)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {pr.name}
                        </p>
                        <p className="text-text-secondary truncate font-mono text-[11px]">
                          {formatNpubShort(pl)}
                        </p>
                      </div>
                      <span className="bg-surface-hover shrink-0 rounded-xs px-1.5 py-0.5 text-[10px]">
                        Saved
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={inSel ? "secondary" : "default"}
                      disabled={disabled}
                      onClick={() => {
                        if (inSel) removePubkey(pl);
                        else addPubkeys([pl]);
                      }}
                    >
                      {inSel ? "Remove" : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {poolLoadingTab === poolTab ? (
            <p className="text-text-secondary text-sm">Loading pool…</p>
          ) : poolFailed ? (
            <p className="text-danger text-sm">
              Could not load this list. Try another source or try again shortly.
            </p>
          ) : null}
          {poolNote ? (
            <p className="text-text-secondary text-xs">{poolNote}</p>
          ) : null}
          {checkedBrowser.size > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={addChecked}
            >
              Add selected ({String(checkedBrowser.size)})
            </Button>
          ) : null}
          <div className="border-border max-h-80 space-y-0 overflow-y-auto rounded-md border">
            {displayRows.length === 0 && poolLoadingTab !== poolTab ? (
              <p className="text-text-secondary p-4 text-sm">
                {search.trim()
                  ? "No matches. Try another search."
                  : "No recipients in this pool."}
              </p>
            ) : (
              displayRows.map((pk) => {
                const pr = profileMap[pk] ?? {
                  pubkey: pk,
                  name: `${pk.slice(0, 8)}…`,
                  picture: null,
                  nip05: null,
                };
                const inSel = selectedSet.has(pk);
                const rowRelationshipLabel =
                  poolTab === "followers" && mutualSet.has(pk)
                    ? "Mutual"
                    : relationshipLabel;
                return (
                  <label
                    key={pk}
                    className={cn(
                      "border-border/60 hover:bg-surface-hover/40 flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-0",
                      inSel && "bg-surface-hover/20"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="border-border rounded-xs"
                      checked={checkedBrowser.has(pk)}
                      disabled={disabled}
                      onChange={() => {
                        toggleCheck(pk);
                      }}
                    />
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={pr.picture ?? undefined} alt="" />
                      <AvatarFallback className="text-xs">
                        {initials(pr.name, pk)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{pr.name}</p>
                      <p className="text-text-secondary truncate font-mono text-[11px]">
                        {pr.nip05 ?? formatNpubShort(pk)}
                      </p>
                    </div>
                    <span className="bg-surface-hover shrink-0 rounded-xs px-1.5 py-0.5 text-[10px]">
                      {rowRelationshipLabel}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={inSel ? "secondary" : "outline"}
                      disabled={disabled}
                      onClick={(e) => {
                        e.preventDefault();
                        if (inSel) removePubkey(pk);
                        else addPubkeys([pk]);
                      }}
                    >
                      {inSel ? (
                        "Added"
                      ) : (
                        <span className="inline-cluster-tight">
                          <UserPlus className="h-3.5 w-3.5" />
                          Add
                        </span>
                      )}
                    </Button>
                  </label>
                );
              })
            )}
          </div>
          {filteredPoolRows.length > MAX_BROWSER_ROWS ? (
            <p className="text-text-secondary text-xs">
              Showing first {String(MAX_BROWSER_ROWS)} matches. Refine search to
              narrow the list.
            </p>
          ) : null}
        </div>
      )}

      <div className="border-border bg-surface-hover/20 space-y-3 rounded-lg border p-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="text-text-secondary">Selected: </span>
            <strong>{String(selectedPubkeys.length)}</strong>
          </span>
          <span>
            <span className="text-text-secondary">Suppressed: </span>
            <strong>{String(suppressedCount)}</strong>
          </span>
          <span>
            <span className="text-text-secondary">Sendable: </span>
            <strong className="text-success-text">
              {String(sendableCount)}
            </strong>
          </span>
        </div>
        {selectedPubkeys.length === 0 ? (
          <p className="text-text-secondary text-xs">
            Select eligible recipients from followers, mutuals, or saved
            audiences.
          </p>
        ) : selectedPubkeys.length <= CHIP_THRESHOLD ? (
          <div className="flex flex-wrap gap-2">
            {selectedPubkeys.map((pk) => {
              const pl = pk.toLowerCase();
              const pr = profileMap[pl];
              return (
                <span
                  key={pl}
                  className="border-border bg-surface shadow-1 inline-cluster-tight.5 rounded-full border py-1 pr-1 pl-2 text-xs"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={pr?.picture ?? undefined} alt="" />
                    <AvatarFallback className="text-[8px]">
                      {initials(pr?.name ?? pl, pl)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[140px] truncate">
                    {pr?.name ?? formatNpubShort(pl)}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    className="text-text-secondary hover:text-text rounded-full p-0.5"
                    aria-label="Remove"
                    onClick={() => {
                      removePubkey(pl);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {selectedPubkeys.map((pk) => {
              const pl = pk.toLowerCase();
              const pr = profileMap[pl];
              return (
                <div
                  key={pl}
                  className="flex items-center justify-between gap-2 rounded-md py-1"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={pr?.picture ?? undefined} alt="" />
                      <AvatarFallback className="text-[9px]">
                        {initials(pr?.name ?? pl, pl)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-xs font-medium">
                      {pr?.name ?? formatNpubShort(pl)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    className="text-text-secondary hover:text-text shrink-0 p-1"
                    aria-label="Remove"
                    onClick={() => {
                      removePubkey(pl);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
