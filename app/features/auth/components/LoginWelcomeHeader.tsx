import { useLoginAuthShell } from "./LoginAuthShellContext";

/** Hidden during remote-signer waiting state so the fold emphasizes status + scan. */
export function LoginWelcomeHeader() {
  const { isAwaitingApproval } = useLoginAuthShell();
  if (isAwaitingApproval) return null;

  return (
    <header className="mb-8 text-center md:text-left">
      <h1 className="text-foreground mb-2 text-3xl font-black tracking-tight sm:text-4xl">
        Welcome
      </h1>
      <h2 className="text-muted-foreground text-base font-medium sm:text-lg">
        Sign in to your dashboard using Nostr
      </h2>
    </header>
  );
}
