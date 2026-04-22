import { BRAND_NAME } from "~/lib/brand";
import {
  proofEyebrowClass,
  proofFooterTextClass,
  proofHeroClass,
  proofSubClass,
  statusBadgeClass,
  type ProofCardPayload,
  type ProofRatio,
} from "~/lib/proof";
import { cn } from "~/lib/utils";

function SupportLines({
  items,
  ratio,
  landscapePair = false,
}: {
  items: NonNullable<ProofCardPayload["stats"]>;
  ratio: ProofRatio;
  landscapePair?: boolean;
}) {
  const labelCls =
    ratio === "square"
      ? "text-[10px] leading-tight text-text-secondary"
      : "text-xs leading-tight text-text-secondary";
  const valueCls =
    ratio === "square"
      ? "text-sm font-semibold tabular-nums"
      : "text-sm font-semibold tabular-nums sm:text-base";

  if (landscapePair) {
    return (
      <ul className="flex flex-col gap-3">
        {items.map((s) => (
          <li key={`${s.label}-${s.value}`} className="min-w-0">
            <p className={labelCls}>{s.label}</p>
            <p
              className={cn(
                "mt-0.5 text-lg font-semibold tabular-nums",
                s.emphasis && "text-brand"
              )}
            >
              {s.value}
            </p>
          </li>
        ))}
      </ul>
    );
  }

  const isGrid = ratio === "portrait";

  return (
    <ul
      className={cn(
        isGrid ? "grid grid-cols-2 gap-x-4 gap-y-3" : "stack-tight.5"
      )}
    >
      {items.map((s) => (
        <li
          key={`${s.label}-${s.value}`}
          className={cn(
            "min-w-0",
            isGrid
              ? "flex flex-col gap-0.5"
              : "flex flex-row items-baseline justify-between gap-2"
          )}
        >
          <span className={labelCls}>{s.label}</span>
          <span
            className={cn(
              valueCls,
              s.emphasis && "text-brand",
              isGrid && "text-base"
            )}
          >
            {s.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FooterBlock({
  payload,
  ratio,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
}) {
  const f = payload.footer;
  if (!f) return null;
  const lines: string[] = [];
  if (f.productLabel) lines.push(f.productLabel);
  if (f.snapshotLabel) lines.push(f.snapshotLabel);
  if (f.timeRangeLabel) lines.push(f.timeRangeLabel);
  if (f.referenceLabel) lines.push(f.referenceLabel);
  if (lines.length === 0) return null;
  const textCls = proofFooterTextClass(ratio);
  return (
    <div
      className={cn(
        "space-y-0.5",
        ratio === "landscape" && "border-border/40 mt-3 border-t pt-3"
      )}
    >
      {lines.map((line) => (
        <p key={line} className={textCls}>
          {line}
        </p>
      ))}
    </div>
  );
}

function CampaignBrandingFoot({ domainLabel }: { domainLabel: string | null }) {
  return domainLabel ? (
    <p className="text-text-secondary mt-2 text-[10px] font-medium tracking-wider uppercase">
      {BRAND_NAME} · {domainLabel}
    </p>
  ) : (
    <p className="text-text-secondary mt-2 text-[10px] font-medium tracking-wider uppercase">
      {BRAND_NAME}
    </p>
  );
}

function ProofCardHead({
  payload,
  ratio,
  variant,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
  variant: "campaign" | "admin";
}) {
  const heroReliability =
    payload.domain === "admin" && payload.cardType === "reliability";
  const heroClass = proofHeroClass(ratio, heroReliability);
  const subClass = proofSubClass(ratio);
  const eyebrowClass = proofEyebrowClass(ratio);

  const showBranding =
    variant === "campaign" && payload.branding?.showLogo !== false;
  const domainLabel =
    showBranding && payload.branding?.showDomainLabel !== false
      ? payload.domain === "giveaway"
        ? "Giveaway"
        : payload.domain === "contest"
          ? "Contest"
          : null
      : null;

  const titleBlock = (
    <h2
      className={cn(
        "text-text mt-1 leading-tight font-semibold tracking-tight",
        ratio === "portrait" && "text-xl sm:text-2xl",
        ratio === "square" && "text-lg sm:text-xl",
        ratio === "landscape" && "text-xl sm:text-2xl",
        "line-clamp-2 [overflow-wrap:anywhere]"
      )}
    >
      {payload.title}
    </h2>
  );

  const metricBlock =
    payload.heroValue != null ? (
      <>
        <p className={cn(heroClass, payload.metricFirst ? "mt-2" : "mt-3")}>
          {payload.heroValue}
        </p>
        {payload.heroLabel ? (
          <p className={subClass}>{payload.heroLabel}</p>
        ) : null}
      </>
    ) : null;

  return (
    <div>
      {payload.statusBadge ? (
        <span
          className={cn(
            "mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
            statusBadgeClass(payload.statusBadge.tone)
          )}
        >
          {payload.statusBadge.label}
        </span>
      ) : null}
      {payload.eyebrow ? (
        <p className={eyebrowClass}>{payload.eyebrow}</p>
      ) : null}
      {payload.metricFirst ? (
        <>
          {metricBlock}
          {payload.title.trim().length > 0 ? (
            <div
              className={cn(
                "text-text mt-3 text-base leading-snug font-semibold",
                "line-clamp-2 [overflow-wrap:anywhere] sm:text-lg"
              )}
            >
              {payload.title}
            </div>
          ) : null}
          {payload.subtitle ? (
            <p className={cn(subClass, "mt-1")}>{payload.subtitle}</p>
          ) : null}
        </>
      ) : (
        <>
          {titleBlock}
          {metricBlock}
          {payload.heroValue == null && payload.subtitle ? (
            <p className={subClass}>{payload.subtitle}</p>
          ) : null}
        </>
      )}
      {showBranding ? <CampaignBrandingFoot domainLabel={domainLabel} /> : null}
    </div>
  );
}

export function ProofCardBody({
  payload,
  ratio,
  variant,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
  variant: "campaign" | "admin";
}) {
  const stats = payload.stats ?? [];
  const head = (
    <ProofCardHead payload={payload} ratio={ratio} variant={variant} />
  );

  if (ratio === "landscape") {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <div className="flex flex-col justify-center">{head}</div>
        <div className="border-border/50 flex flex-col justify-center sm:border-l sm:pl-6">
          {stats.length > 0 ? (
            <SupportLines items={stats} ratio={ratio} landscapePair />
          ) : null}
          <FooterBlock payload={payload} ratio={ratio} />
        </div>
      </div>
    );
  }

  if (ratio === "square") {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
        {head}
        {stats.length > 0 ? <SupportLines items={stats} ratio={ratio} /> : null}
        <FooterBlock payload={payload} ratio={ratio} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-4">
      {head}
      {stats.length > 0 ? (
        <div className="min-h-0 flex-1">
          <SupportLines items={stats} ratio={ratio} />
        </div>
      ) : null}
      <div className="border-border/50 mt-auto border-t pt-3">
        <FooterBlock payload={payload} ratio={ratio} />
      </div>
    </div>
  );
}
