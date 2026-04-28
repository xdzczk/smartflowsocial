import { nip19 } from "nostr-tools";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
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
    <div className="giveaway-post-container border-border bg-surface shadow-1 rounded-xl border p-4">
      <Button type="button" onClick={handleGenerateMessage} className="mb-4">
        Generate Message
      </Button>

      {message ? (
        <div className="mt-4">
          <Textarea
            className="bg-surface min-h-[18rem]"
            rows={12}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCopyToClipboard}
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default GiveawayPost;
