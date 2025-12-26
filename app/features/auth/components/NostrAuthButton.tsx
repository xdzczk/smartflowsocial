import { useFetcher, Link, useLocation } from "@remix-run/react";
import { useCallback } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { useOptionalUser } from "~/lib/remix-utils";
import { handleAsyncError } from "~/lib/error-handler.client";

export default function NostrAuthButton() {
  const user = useOptionalUser();
  const fetcher = useFetcher();
  const location = useLocation();

  const handleNostrLogin = useCallback(async () => {
    try {
      // Load and initialize nostr-login when button is clicked
      const { init } = await import("nostr-login");
      
      init({
        methods: ["connect", "extension"],
        noBanner: true,
        onAuth: async () => {
          try {
            if (!window.nostr) {
              throw new Error("Nostr extension not found. Please install a Nostr extension like Alby or nos2x.");
            }

            const randomKeys = () => {
              const chars =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
              let result = "";
              for (let i = 0; i < 10; i++) {
                result += chars.charAt(
                  Math.floor(Math.random() * chars.length),
                );
              }
              return result;
            };
            const contentSign = `Login request ${randomKeys()}`;
            const event = {
              kind: 27235,
              created_at: Math.floor(Date.now() / 1000),
              tags: [],
              content: contentSign,
            };

            const signedEvent = await window.nostr.signEvent(event);
            
            const formData = new FormData();
            formData.append("pubkey", signedEvent.pubkey);
            formData.append("signature", signedEvent.sig);
            formData.append("event", JSON.stringify(signedEvent));
            formData.append("contentSign", contentSign);
            
            // Submit auth request
            fetcher.submit(formData, {
              method: "post",
              action: "/nostr-auth",
            });
          } catch (authError) {
            handleAsyncError(authError, {
              component: "NostrAuthButton",
              action: "onAuth",
            }, true);
          }
        },
      });

      // Trigger the login modal
      document.dispatchEvent(
        new CustomEvent("nlLaunch", { detail: "welcome" }),
      );
    } catch (error) {
      // Log and handle error
      handleAsyncError(error, {
        component: "NostrAuthButton",
        action: "handleNostrLogin",
      }, true);
    }
  }, [fetcher]);

  const handleLogout = useCallback(async (event) => {
    event.preventDefault();
    // Dispatch nostr logout event
    document.dispatchEvent(new Event("nlLogout"));

    // Submit the logout form after a small delay to ensure nostr logout completes
    setTimeout(() => {
      event.target.submit();
    }, 100);
  }, []);

  return (
    <>
      {user ? (
        <>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage
                src={user.nostrProfile?.picture}
                alt="Profile"
              />
              <AvatarFallback>
                {user.nostrProfile?.name?.[0] ||
                  user.nostrProfile?.display_name?.[0] ||
                  "U"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">
              {user.nostrProfile?.name ||
                user.nostrProfile?.display_name
                ? user.nostrProfile.name ||
                user.nostrProfile.display_name
                : `${(user.npub || "").slice(0, 12)}...${(user.npub || "").slice(-8)}`}
            </span>
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
