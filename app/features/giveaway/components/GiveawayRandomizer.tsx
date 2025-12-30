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
    if (!relatedEvents || relatedEvents.length === 0) return;

    // Group events by type
    const reposters = relatedEvents.filter((event) => event.kind === 6);
    const likers = relatedEvents.filter(
      (event) =>
        event.kind === 7 || event.kind === 9735 || event.kind === 9734,
    );
    const commenters = relatedEvents.filter((event) => event.kind === 1);

    // Function to get random items from array
    const getRandomItems = (array: RelatedEvent[], count: number) => {
      const shuffled = [...array].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(count, shuffled.length));
    };

    // Get 3 random users from each category
    setRandomUsers({
      reposters: getRandomItems(reposters, 3),
      likers: getRandomItems(likers, 3),
      commenters: getRandomItems(commenters, 3),
    });
  }, [relatedEvents]);

  // Convert pubkey to npub format using nostr-tools
  const formatPubkey = (pubkey: string | undefined) => {
    if (!pubkey) return "unknown";
    try {
      const npub = nip19.npubEncode(pubkey);
      return npub;
    } catch (error) {
      handleErrorSafely(error, {
        component: "GiveawayRandomizer",
        action: "formatPubkey",
      });
      return pubkey;
    }
  };

  return (
    <div className="giveaway-container rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
        Giveaway Winners
      </h2>
      <GiveawayPost randomUsers={randomUsers} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Reposters Section */}
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
          <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">
            Reposters
          </h3>
          {randomUsers.reposters.length > 0 ? (
            <ul className="space-y-2">
              {randomUsers.reposters.map((user, index) => (
                <li
                  key={`repost-${index}`}
                  className="rounded bg-white p-2 dark:bg-gray-600"
                >
                  <div className="mb-2 overflow-hidden text-ellipsis text-xs">
                    {formatPubkey(user.pubkey)}
                  </div>
                  <ZapButton npub={formatPubkey(user.pubkey)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No reposters found
            </p>
          )}
        </div>

        {/* Likers/Zappers Section */}
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
          <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">
            Likes & Zaps
          </h3>
          {randomUsers.likers.length > 0 ? (
            <ul className="space-y-2">
              {randomUsers.likers.map((user, index) => (
                <li
                  key={`like-${index}`}
                  className="rounded bg-white p-2 dark:bg-gray-600"
                >
                  <div className="mb-2 overflow-hidden text-ellipsis text-xs">
                    {formatPubkey(user.pubkey)}
                  </div>
                  <ZapButton npub={formatPubkey(user.pubkey)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No likes or zaps found
            </p>
          )}
        </div>

        {/* Commenters Section */}
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
          <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-200">
            Commenters
          </h3>
          {randomUsers.commenters.length > 0 ? (
            <ul className="space-y-2">
              {randomUsers.commenters.map((user, index) => (
                <li
                  key={`comment-${index}`}
                  className="rounded bg-white p-2 dark:bg-gray-600"
                >
                  <div className="mb-2 overflow-hidden text-ellipsis text-xs">
                    {formatPubkey(user.pubkey)}
                  </div>
                  <ZapButton npub={formatPubkey(user.pubkey)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No comments found
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GiveawayRandomizer;
