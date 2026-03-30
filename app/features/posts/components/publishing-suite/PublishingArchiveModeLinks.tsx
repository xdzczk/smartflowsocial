import { PublishingSegmentedControlLinks } from "./PublishingSegmentedControl";

export function PublishingArchiveModeLinks({
  active,
}: {
  active: "published" | "recyclables";
}) {
  return (
    <PublishingSegmentedControlLinks
      ariaLabel="Published library mode"
      activeId={active}
      items={[
        {
          id: "published",
          label: "Published",
          to: "/dashboard/published",
          ariaLabel: "View published posts",
        },
        {
          id: "recyclables",
          label: "Recyclables",
          to: "/dashboard/recyclables",
          ariaLabel: "View recyclable posts",
        },
      ]}
    />
  );
}
