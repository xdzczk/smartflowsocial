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
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {items.map((s) => (
          <li key={`${s.label}-${s.value}`} className="min-w-0">
            <p className={labelCls}>{s.label}</p>
            <p
              className={cn(
                "mt-0.5 text-sm leading-snug font-semibold [overflow-wrap:anywhere] tabular-nums",
                s.emphasis && "text-link"
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
              s.emphasis && "text-link",
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
        ratio === "landscape" && "border-border/40 mt-2 border-t pt-2"
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

function CampaignBrandingFoot({
  domainLabel,
  ratio,
}: {
  domainLabel: string | null;
  ratio: ProofRatio;
}) {
  if (ratio === "landscape") return null;
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

function resolveCampaignDomainLabel(
  payload: ProofCardPayload,
  showBranding: boolean
): string | null {
  if (!showBranding || payload.branding?.showDomainLabel === false) {
    return null;
  }
  if (payload.domain === "giveaway") return "Giveaway";
  if (payload.domain === "contest") return "Contest";
  return null;
}

function proofTitleHeadingClass(ratio: ProofRatio): string {
  return cn(
    "text-text mt-1 leading-tight font-semibold tracking-tight",
    ratio === "portrait" && "text-xl sm:text-2xl",
    ratio === "square" && "text-lg sm:text-xl",
    ratio === "landscape" && "text-lg sm:text-xl",
    "line-clamp-2 [overflow-wrap:anywhere]"
  );
}

function proofHeroMetricTopMargin(
  ratio: ProofRatio,
  metricFirst: boolean
): string {
  if (metricFirst) {
    return ratio === "landscape" ? "mt-1.5" : "mt-2";
  }
  return ratio === "landscape" ? "mt-2" : "mt-3";
}

function ProofCardStatusBadge({
  badge,
  ratio,
}: {
  badge: NonNullable<ProofCardPayload["statusBadge"]>;
  ratio: ProofRatio;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
        ratio === "landscape" ? "mb-1.5" : "mb-2",
        statusBadgeClass(badge.tone)
      )}
    >
      {badge.label}
    </span>
  );
}

function ProofCardHeroMetric({
  payload,
  ratio,
  heroClass,
  subClass,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
  heroClass: string;
  subClass: string;
}) {
  if (payload.heroValue == null) return null;
  return (
    <>
      <p
        className={cn(
          heroClass,
          proofHeroMetricTopMargin(ratio, payload.metricFirst === true)
        )}
      >
        {payload.heroValue}
      </p>
      {payload.heroLabel ? (
        <p className={subClass}>{payload.heroLabel}</p>
      ) : null}
    </>
  );
}

function ProofCardMetricFirstBody({
  payload,
  ratio,
  subClass,
  heroClass,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
  subClass: string;
  heroClass: string;
}) {
  return (
    <>
      <ProofCardHeroMetric
        payload={payload}
        ratio={ratio}
        heroClass={heroClass}
        subClass={subClass}
      />
      {payload.title.trim().length > 0 ? (
        <div
          className={cn(
            "text-text leading-snug font-semibold",
            "line-clamp-2 [overflow-wrap:anywhere]",
            ratio === "landscape" ? "mt-2 text-sm" : "mt-3 text-base sm:text-lg"
          )}
        >
          {payload.title}
        </div>
      ) : null}
      {payload.subtitle && ratio !== "landscape" ? (
        <p className={cn(subClass, "mt-1")}>{payload.subtitle}</p>
      ) : null}
    </>
  );
}

function ProofCardTitleFirstBody({
  payload,
  ratio,
  subClass,
  heroClass,
}: {
  payload: ProofCardPayload;
  ratio: ProofRatio;
  subClass: string;
  heroClass: string;
}) {
  return (
    <>
      <h2 className={proofTitleHeadingClass(ratio)}>{payload.title}</h2>
      <ProofCardHeroMetric
        payload={payload}
        ratio={ratio}
        heroClass={heroClass}
        subClass={subClass}
      />
      {payload.heroValue == null && payload.subtitle ? (
        <p className={subClass}>{payload.subtitle}</p>
      ) : null}
    </>
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
  const domainLabel = resolveCampaignDomainLabel(payload, showBranding);
  const bodyProps = { payload, ratio, subClass, heroClass };

  return (
    <div>
      {payload.statusBadge ? (
        <ProofCardStatusBadge badge={payload.statusBadge} ratio={ratio} />
      ) : null}
      {payload.eyebrow ? (
        <p className={eyebrowClass}>{payload.eyebrow}</p>
      ) : null}
      {payload.metricFirst ? (
        <ProofCardMetricFirstBody {...bodyProps} />
      ) : (
        <ProofCardTitleFirstBody {...bodyProps} />
      )}
      {showBranding ? (
        <CampaignBrandingFoot domainLabel={domainLabel} ratio={ratio} />
      ) : null}
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
      <div className="grid h-full min-h-0 flex-1 grid-cols-2 items-center gap-6">
        <div className="min-h-0 min-w-0">{head}</div>
        <div className="border-border/50 flex min-h-0 min-w-0 flex-col justify-center gap-3 border-l pl-6">
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
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {head}
        {stats.length > 0 ? <SupportLines items={stats} ratio={ratio} /> : null}
        <div className="mt-auto">
          <FooterBlock payload={payload} ratio={ratio} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {head}
      {stats.length > 0 ? <SupportLines items={stats} ratio={ratio} /> : null}
      <div className="border-border/50 mt-auto border-t pt-3">
        <FooterBlock payload={payload} ratio={ratio} />
      </div>
    </div>
  );
}
