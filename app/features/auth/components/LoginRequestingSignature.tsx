import { Button } from "~/components/ui/button";
import { formatNpubShort } from "~/features/auth/login-flow.client";

export interface LoginRequestingSignatureProps {
  signingInDisplayName: string | null;
  pubkey: string;
  isVerifying: boolean;
  onCancel: () => void;
}

export function LoginRequestingSignature({
  signingInDisplayName,
  pubkey,
  isVerifying,
  onCancel,
}: LoginRequestingSignatureProps) {
  return (
    <div className="border-border bg-card min-h-[164px] space-y-4 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl">
      <div className="flex min-h-6 w-full items-center gap-1 text-base">
        <span className="shrink-0">Signing in as</span>
        <span
          className="text-primary min-w-0 truncate font-bold"
          title={signingInDisplayName ?? formatNpubShort(pubkey)}
        >
          {signingInDisplayName ?? formatNpubShort(pubkey)}
        </span>
      </div>
      <div className="flex gap-3">
        <Button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[170px] justify-center shadow-md"
          disabled
        >
          {isVerifying ? "Verifying…" : "Waiting for signature…"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-border bg-card hover:bg-muted hover:text-foreground"
          onClick={() => onCancel()}
          disabled={isVerifying}
        >
          Cancel
        </Button>
      </div>
      <div className="text-muted-foreground text-xs">
        Waiting for your extension to sign the login request. If it doesn&apos;t
        respond, try canceling and checking your extension settings.
      </div>
    </div>
  );
}
