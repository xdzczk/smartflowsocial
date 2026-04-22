import { nip19 } from "nostr-tools";
import { useEffect, useState } from "react";

import ZapButton from "~/components/dashboard/ZapButton";
import { handleErrorSafely } from "~/lib/error-handler.client";

import type { RelatedEvent } from "../types";

import GiveawayPost from "./GiveawayPost";
interface GiveawayRandomizerProps {
  relatedEvents: RelatedEvent[];
}

const GiveawayRandomizer = ({ relatedEvents }: GiveawayRandomizerProps) => {
  const [randomUsers, setRandomUsers] = useState({
    reposters: [] as RelatedEvent[],
    likers: [] as RelatedEvent[],
    commenters: [] as RelatedEvent[],
  });

  useEffect(() => {
    if (relatedEvents.length === 0) return;

    // Group events by type
    const reposters = relatedEvents.filter((event) => event.kind === 6);
    const likers = relatedEvents.filter(
      (event) => event.kind === 7 || event.kind === 9735 || event.kind === 9734
    );
    const commenters = relatedEvents.filter((event) => event.kind === 1);

    // Function to get random items from array
    const getRandomItems = (array: RelatedEvent[], count: number) => {
      const shuffled = [...array].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(count, shuffled.length));
    };

    // Get 3 random users from each category
    // Defer to avoid cascading renders
    setTimeout(() => {
      setRandomUsers({
        reposters: getRandomItems(reposters, 3),
        likers: getRandomItems(likers, 3),
        commenters: getRandomItems(commenters, 3),
      });
    }, 0);
  }, [relatedEvents]);

  // Convert pubkey to npub format using nostr-tools
  const formatPubkey = (pubkey: string | undefined) => {
    if (!pubkey) return "unknown";
    try {
      return nip19.npubEncode(pubkey);
    } catch (error) {
      handleErrorSafely(error, {
        component: "GiveawayRandomizer",
        action: "formatPubkey",
      });
      return pubkey;
    }
  };

  return (
    <div className="giveaway-container border-border bg-surface shadow-1 rounded-lg border p-4">
      <h2 className="text-text mb-4 text-xl font-bold">Giveaway Winners</h2>
      <GiveawayPost randomUsers={randomUsers} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Reposters Section */}
        <div className="border-border bg-surface-hover/60 rounded-lg border p-3">
          <h3 className="text-text mb-2 font-semibold">Reposters</h3>
          {randomUsers.reposters.length > 0 ? (
            <ul className="space-y-2">
              {randomUsers.reposters.map((user, index) => (
                <li
                  // eslint-disable-next-line react/no-array-index-key -- Stable list of random users, composite key with prefix
                  key={`repost-${index}`}
                  className="border-border bg-surface rounded-xs border p-2"
                >
                  <div className="text-text mb-2 overflow-hidden text-xs text-ellipsis">
                    {formatPubkey(user.pubkey)}
                  </div>
                  <ZapButton npub={formatPubkey(user.pubkey)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary text-sm">No reposters found</p>
          )}
        </div>

        {/* Likers/Zappers Section */}
        <div className="border-border bg-surface-hover/60 rounded-lg border p-3">
          <h3 className="text-text mb-2 font-semibold">Likes & Zaps</h3>
          {randomUsers.likers.length > 0 ? (
            <ul className="space-y-2">
              {randomUsers.likers.map((user, index) => (
                <li
                  // eslint-disable-next-line react/no-array-index-key -- Stable list of random users, composite key with prefix
                  key={`like-${index}`}
                  className="border-border bg-surface rounded-xs border p-2"
                >
                  <div className="text-text mb-2 overflow-hidden text-xs text-ellipsis">
                    {formatPubkey(user.pubkey)}
                  </div>
                  <ZapButton npub={formatPubkey(user.pubkey)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary text-sm">
              No likes or zaps found
            </p>
          )}
        </div>

        {/* Commenters Section */}
        <div className="border-border bg-surface-hover/60 rounded-lg border p-3">
          <h3 className="text-text mb-2 font-semibold">Commenters</h3>
          {randomUsers.commenters.length > 0 ? (
            <ul className="space-y-2">
              {randomUsers.commenters.map((user, index) => (
                <li
                  // eslint-disable-next-line react/no-array-index-key -- Stable list of random users, composite key with prefix
                  key={`comment-${index}`}
                  className="border-border bg-surface rounded-xs border p-2"
                >
                  <div className="text-text mb-2 overflow-hidden text-xs text-ellipsis">
                    {formatPubkey(user.pubkey)}
                  </div>
                  <ZapButton npub={formatPubkey(user.pubkey)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary text-sm">No comments found</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GiveawayRandomizer;
