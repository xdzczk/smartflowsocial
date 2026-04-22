/**
 * New post page header: title only. Session/relays/signer live in the publishing rail.
 */

export type ComposerStatus =
  | "Draft"
  | "Ready"
  | "Scheduled"
  | "Signing…"
  | "Publishing…"
  | "Failed";

interface NewPostHeaderProps {
  title?: string;
}

export function NewPostHeader({ title = "Create post" }: NewPostHeaderProps) {
  return <h1 className="text-text text-h2">{title}</h1>;
}
