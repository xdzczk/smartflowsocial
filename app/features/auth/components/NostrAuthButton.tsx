import { Link, useFetcher, useLocation } from "@remix-run/react";
import { useCallback } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { handleAsyncError } from "~/lib/error-handler.client";
import { useOptionalUser } from "~/lib/remix-utils";
// ============================================================================
// Helper Functions
// ============================================================================

function getUserProfilePicture(user: unknown): string | undefined {
  if (
    typeof user === "object" &&
    user !== null &&
    "nostrProfile" in user &&
    typeof user.nostrProfile === "object" &&
    user.nostrProfile !== null &&
    "picture" in user.nostrProfile
  ) {
    return String(user.nostrProfile["picture"]);
  }
  return undefined;
}

function getUserDisplayName(user: unknown): string {
  if (
    typeof user === "object" &&
    user !== null &&
    "nostrProfile" in user &&
    typeof user.nostrProfile === "object" &&
    user.nostrProfile !== null
  ) {
    if ("name" in user.nostrProfile && user.nostrProfile["name"]) {
      return String(user.nostrProfile["name"]);
    }
    if (
      "display_name" in user.nostrProfile &&
      user.nostrProfile["display_name"]
    ) {
      return String(user.nostrProfile["display_name"]);
    }
  }

  if (
    typeof user === "object" &&
    user !== null &&
    "npub" in user &&
    user.npub
  ) {
    const npub = String(user.npub);
    return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
  }

  return "";
}

function getUserAvatarFallback(user: unknown): string {
  if (
    typeof user === "object" &&
    user !== null &&
    "nostrProfile" in user &&
    typeof user.nostrProfile === "object" &&
    user.nostrProfile !== null
  ) {
    if ("name" in user.nostrProfile && user.nostrProfile["name"]) {
      return String(user.nostrProfile["name"])[0] ?? "U";
    }
    if (
      "display_name" in user.nostrProfile &&
      user.nostrProfile["display_name"]
    ) {
      return String(user.nostrProfile["display_name"])[0] ?? "U";
    }
  }
  return "U";
}

function generateRandomKeys(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function handleNostrAuth(fetcher: {
  submit: (
    formData: FormData,
    options: { method: string; action: string }
  ) => void;
}): Promise<void> {
  // @ts-ignore - window.nostr is injected by browser extensions at runtime
  if (!window.nostr) {
    throw new Error(
      "Nostr extension not found. Please install a Nostr extension like Alby or nos2x."
    );
  }

  const contentSign = `Login request ${generateRandomKeys()}`;
  const event = {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: contentSign,
  };

  // @ts-ignore - window.nostr is injected by browser extensions at runtime
  const signedEvent = await window.nostr.signEvent(event);

  const formData = new FormData();
  formData.append("pubkey", signedEvent.pubkey);
  formData.append("signature", signedEvent.sig);
  formData.append("event", JSON.stringify(signedEvent));
  formData.append("contentSign", contentSign);

  fetcher.submit(formData, {
    method: "post",
    action: "/nostr-auth",
  });
}

export default function NostrAuthButton() {
  const user = useOptionalUser() ?? null;
  const fetcher = useFetcher();
  const location = useLocation();

  const handleNostrLogin = useCallback(() => {
    void (async () => {
      try {
        // Load and initialize nostr-login when button is clicked
        // @ts-ignore - Dynamic imports work in client-side Remix bundles
        const { init } = await import("nostr-login");

        await init({
          methods: ["connect", "extension"],
          noBanner: true,
          onAuth: () => {
            void (async () => {
              try {
                await handleNostrAuth({
                  submit: (
                    formData: FormData,
                    options: { method: string; action: string }
                  ) => {
                    fetcher.submit(formData, {
                      method: options.method as "post" | "get",
                      action: options.action,
                    });
                  },
                });
              } catch (authError) {
                handleAsyncError(
                  authError,
                  {
                    component: "NostrAuthButton",
                    action: "onAuth",
                  },
                  true
                );
              }
            })();
          },
        });

        // Trigger the login modal
        document.dispatchEvent(
          new CustomEvent("nlLaunch", { detail: "welcome" })
        );
      } catch (error) {
        handleAsyncError(
          error,
          {
            component: "NostrAuthButton",
            action: "handleNostrLogin",
          },
          true
        );
      }
    })();
  }, [fetcher]);

  const handleLogout = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      // Dispatch nostr logout event
      document.dispatchEvent(new Event("nlLogout"));

      // Submit the logout form after a small delay to ensure nostr logout completes
      setTimeout(() => {
        if (event.target instanceof HTMLFormElement) {
          event.target.submit();
        }
      }, 100);
    },
    []
  );

  return (
    <>
      {user ? (
        <>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={getUserProfilePicture(user)} alt="Profile" />
              <AvatarFallback>{getUserAvatarFallback(user)}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{getUserDisplayName(user)}</span>
            {location.pathname === "/" ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : null}
            <form action="/logout" method="post" onSubmit={handleLogout}>
              <Button variant="outline" size="sm" type="submit">
                Logout
              </Button>
            </form>
          </div>
        </>
      ) : (
        <Button
          onClick={handleNostrLogin}
          disabled={fetcher.state === "submitting"}
          className="bg-gradient-to-r from-purple-500 to-indigo-600 font-bold text-white hover:from-purple-600 hover:to-indigo-700"
          size="lg"
          type="button"
        >
          {fetcher.state === "submitting"
            ? "Logging in..."
            : "Login with Nostr 🪿"}
        </Button>
      )}
    </>
  );
}
