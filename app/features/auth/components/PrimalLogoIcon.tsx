/** Official Primal logo for "Login with Primal" button. Shared by Reconnect dialog and NostrLoginPanel. */
export function PrimalLogoIcon({ className }: { className?: string }) {
  return (
    <img
      src="/PrimalIcon.png"
      alt=""
      className={className}
      width={20}
      height={20}
      aria-hidden
    />
  );
}
