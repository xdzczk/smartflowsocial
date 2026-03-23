import { useCallback, useLayoutEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  parseRecipientInput,
  validHexLinesFromRows,
  type ParsedRecipientRow,
} from "~/features/broadcast/broadcast-recipient-parse";
import { cn } from "~/lib/utils";

import {
  RecipientReviewTable,
  type ReviewFilter,
} from "./RecipientReviewTable";

export type CustomInputTab = "paste" | "import" | "search" | "saved";

export interface AudiencePanelCustomListProps {
  savedAudiences: Array<{
    id: string;
    name: string;
    audienceType: string;
    customNpubLines: string[];
  }>;
  /** Pre-filled paste (e.g. from saved audience load). */
  initialPaste?: string;
  onRowsChange: (rows: ParsedRecipientRow[]) => void;
  onValidHexLinesChange: (hexLines: string[]) => void;
}

function downloadInvalidCsv(rows: ParsedRecipientRow[]) {
  const invalid = rows.filter(
    (r) =>
      r.status === "invalid_format" ||
      r.status === "invalid_length" ||
      r.status === "unsupported_link"
  );
  const blob = new Blob(
    [["raw"].concat(invalid.map((r) => r.raw)).join("\n")],
    {
      type: "text/csv;charset=utf-8",
    }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "invalid-recipients.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function AudiencePanelCustomList({
  savedAudiences,
  initialPaste = "",
  onRowsChange,
  onValidHexLinesChange,
}: AudiencePanelCustomListProps) {
  const [tab, setTab] = useState<CustomInputTab>("paste");
  const [paste, setPaste] = useState(initialPaste);
  const [rows, setRows] = useState<ParsedRecipientRow[]>(() =>
    initialPaste.trim().length > 0 ? parseRecipientInput(initialPaste).rows : []
  );
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [searchQ, setSearchQ] = useState("");
  const [savedQuery, setSavedQuery] = useState("");

  const syncRows = useCallback(
    (next: ParsedRecipientRow[]) => {
      setRows(next);
      onRowsChange(next);
      onValidHexLinesChange(validHexLinesFromRows(next));
    },
    [onRowsChange, onValidHexLinesChange]
  );

  useLayoutEffect(() => {
    onRowsChange(rows);
    onValidHexLinesChange(validHexLinesFromRows(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync initial rows to parent once on mount
  }, []);

  const runParse = useCallback(() => {
    const { rows: r } = parseRecipientInput(paste);
    syncRows(r);
  }, [paste, syncRows]);

  const summary = useMemo(() => {
    const text = rows.map((x) => x.raw).join("\n");
    return parseRecipientInput(text).summary;
  }, [rows]);

  const applyRemoveInvalid = () => {
    const next = rows.filter(
      (r) =>
        r.status !== "invalid_format" &&
        r.status !== "invalid_length" &&
        r.status !== "unsupported_link"
    );
    syncRows(next);
    setPaste(next.map((r) => r.raw).join("\n"));
  };

  const applyRemoveDuplicates = () => {
    const seen = new Set<string>();
    const out: ParsedRecipientRow[] = [];
    for (const r of rows) {
      if (r.status === "duplicate") continue;
      if (r.normalizedHex) {
        if (seen.has(r.normalizedHex)) continue;
        seen.add(r.normalizedHex);
      }
      out.push(r);
    }
    syncRows(out);
    setPaste(out.map((r) => r.raw).join("\n"));
  };

  const filteredSaved = savedAudiences.filter(
    (s) =>
      s.name.toLowerCase().includes(savedQuery.toLowerCase()) ||
      s.audienceType.toLowerCase().includes(savedQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Add recipients without relying on raw keys alone: paste, import a file,
        paste an npub in search, or pull from a saved audience.
      </p>
      <div className="flex flex-wrap gap-1 rounded-lg border p-1">
        {(
          [
            ["paste", "Paste"],
            ["import", "Import file"],
            ["search", "Add by npub"],
            ["saved", "Use saved"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTab(k);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              tab === k
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "paste" ? (
        <div className="space-y-2">
          <Label htmlFor="broadcast-custom-paste">
            Paste npubs, hex pubkeys, or profile links
          </Label>
          <textarea
            id="broadcast-custom-paste"
            rows={8}
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
            }}
            onBlur={() => {
              runParse();
            }}
            className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm"
            placeholder="npub1…, hex, or nostr links — separated by line, comma, or space"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={runParse}
            >
              Parse recipients
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPaste("");
                syncRows([]);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "import" ? (
        <div className="space-y-2">
          <Label htmlFor="broadcast-csv-import">Import .txt or .csv</Label>
          <Input
            id="broadcast-csv-import"
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                const t = String(reader.result ?? "");
                setPaste((p) => {
                  const next = p ? `${p}\n${t}` : t;
                  const { rows: r } = parseRecipientInput(next);
                  syncRows(r);
                  return next;
                });
              };
              reader.readAsText(f);
              e.target.value = "";
            }}
          />
          <p className="text-muted-foreground text-xs">
            CSV columns: pubkey, npub, or nostr_link — or plain lines of npubs.
          </p>
        </div>
      ) : null}

      {tab === "search" ? (
        <div className="space-y-2">
          <Label htmlFor="broadcast-npub-search">npub or 64-char hex</Label>
          <div className="flex gap-2">
            <Input
              id="broadcast-npub-search"
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
              }}
              placeholder="npub1… or hex"
              className="font-mono text-sm"
            />
            <Button
              type="button"
              onClick={() => {
                const line = searchQ.trim();
                if (!line) return;
                const next = paste ? `${paste}\n${line}` : line;
                setPaste(next);
                const { rows: r } = parseRecipientInput(next);
                syncRows(r);
                setSearchQ("");
              }}
            >
              Add
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "saved" ? (
        <div className="space-y-2">
          <Label htmlFor="broadcast-saved-search">Search saved audiences</Label>
          <Input
            id="broadcast-saved-search"
            value={savedQuery}
            onChange={(e) => {
              setSavedQuery(e.target.value);
            }}
            placeholder="Filter by name…"
          />
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
            {filteredSaved.length === 0 ? (
              <li className="text-muted-foreground text-xs">No matches.</li>
            ) : (
              filteredSaved.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      const text = s.customNpubLines.join("\n");
                      setPaste(text);
                      const { rows: r } = parseRecipientInput(text);
                      syncRows(r);
                    }}
                  >
                    {s.name}
                  </button>
                  <span className="text-muted-foreground text-xs">
                    {" "}
                    · {s.audienceType}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      <div className="border-border bg-muted/20 rounded-md border p-3">
        <p className="text-xs font-medium tracking-wide uppercase">Summary</p>
        <ul className="text-muted-foreground mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          <li>Parsed: {String(summary.parsed)}</li>
          <li>Valid: {String(summary.valid)}</li>
          <li>Duplicates: {String(summary.duplicates)}</li>
          <li>Invalid: {String(summary.invalid)}</li>
          <li>
            Sendable:{" "}
            <strong className="text-foreground">
              {String(summary.finalSendable)}
            </strong>
          </li>
        </ul>
      </div>

      <RecipientReviewTable
        rows={rows}
        filter={reviewFilter}
        onFilterChange={setReviewFilter}
        onRemoveRow={(i) => {
          const next = rows.filter((_, j) => j !== i);
          syncRows(next);
          setPaste(next.map((r) => r.raw).join("\n"));
        }}
        onRemoveInvalid={applyRemoveInvalid}
        onRemoveDuplicates={applyRemoveDuplicates}
        onExportInvalid={() => {
          downloadInvalidCsv(rows);
        }}
      />
    </div>
  );
}
