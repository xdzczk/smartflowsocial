import { nip19 } from "nostr-tools";
import { useState } from "react";

import { handleErrorSafely } from "~/lib/error-handler.client";
interface RandomUser {
  pubkey: string;
}

interface RandomUsers {
  reposters: RandomUser[];
  likers: RandomUser[];
  commenters: RandomUser[];
}

interface GiveawayPostProps {
  randomUsers: RandomUsers;
}

const GiveawayPost = ({ randomUsers }: GiveawayPostProps) => {
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // Generate the giveaway message based on random users
  const generateMessage = () => {
    if (
      randomUsers.reposters.length === 0 ||
      randomUsers.likers.length === 0 ||
      randomUsers.commenters.length === 0
    ) {
      return "No user data available to generate message.";
    }

    const formatNpub = (pubkey: string): string => {
      if (!pubkey) return "unknown";
      try {
        const npub = nip19.npubEncode(pubkey);
        return `nostr:${npub}`;
      } catch (error) {
        handleErrorSafely(error, {
          component: "GiveawayPost",
          action: "formatNpub",
        });
        return "unknown";
      }
    };

    const reposters = randomUsers.reposters
      .map((user: RandomUser) => formatNpub(user.pubkey))
      .join(", ");
    const likers = randomUsers.likers
      .map((user: RandomUser) => formatNpub(user.pubkey))
      .join(", ");
    const commenters = randomUsers.commenters
      .map((user: RandomUser) => formatNpub(user.pubkey))
      .join(", ");

    return `Thanks to everyone who shared, zapped, liked and commented on our memes lately 🫡

✅ 3 random reposts from last week each got 2,000 sats - congrats to ${reposters} 🎉

✅ 3 random reactions from last week each got 1,000 sats - congrats to ${likers} 🎉

✅ 3 random comments from last week each got 1,000 sats - congrats to ${commenters} 🎉

Enjoy your memes and have a nice day!

#bitcoin #plebchain #giveaway`;
  };

  const handleGenerateMessage = () => {
    const generatedMessage = generateMessage();
    setMessage(generatedMessage);
  };

  const handleCopyToClipboard = () => {
    void navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="giveaway-post-container border-border bg-card rounded-lg border p-4 shadow">
      <button
        onClick={handleGenerateMessage}
        className="bg-primary text-primary-foreground hover:bg-primary/90 mb-4 rounded px-4 py-2"
      >
        Generate Message
      </button>

      {message ? (
        <div className="mt-4">
          <textarea
            className="border-border bg-background text-foreground w-full rounded-lg border p-3"
            rows={12}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          ></textarea>

          <div className="mt-2 flex justify-end">
            <button
              onClick={handleCopyToClipboard}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default GiveawayPost;
