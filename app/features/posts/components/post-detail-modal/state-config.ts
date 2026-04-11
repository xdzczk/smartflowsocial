export type PostDetailState = "draft" | "published" | "scheduled";

export interface PostDetailStateConfig {
  sectionMode: "performance" | "actions";
  headerPrefix: string;
  footer: {
    primaryLabel: string;
    secondaryLabel?: string;
  };
}

const STATE_CONFIG: Record<PostDetailState, PostDetailStateConfig> = {
  draft: {
    sectionMode: "actions",
    headerPrefix: "Created",
    footer: {
      primaryLabel: "Edit draft",
    },
  },
  scheduled: {
    sectionMode: "actions",
    headerPrefix: "Scheduled for",
    footer: {
      primaryLabel: "Edit post",
      secondaryLabel: "Reschedule",
    },
  },
  published: {
    sectionMode: "performance",
    headerPrefix: "Posted",
    footer: {
      primaryLabel: "View thread",
      secondaryLabel: "Open on Nostr",
    },
  },
};

export function getPostDetailStateConfig(
  state: PostDetailState
): PostDetailStateConfig {
  return STATE_CONFIG[state];
}
