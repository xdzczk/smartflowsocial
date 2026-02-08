/**
 * New longform post page header component.
 * Minimal, editorial; hashtags live in the Publish Panel.
 */

interface NewLongFormHeaderProps {
  displayedHashtags: string;
}

export function NewLongFormHeader({
  displayedHashtags: _displayedHashtags,
}: NewLongFormHeaderProps) {
  return (
    <header className="mx-auto w-full max-w-[760px] px-4 pt-6">
      <h1 className="text-foreground text-xl font-semibold tracking-tight dark:text-white">
        New article
      </h1>
    </header>
  );
}
