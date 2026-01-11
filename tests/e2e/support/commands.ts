import { faker } from "@faker-js/faker";

import { signEvent, type SignedEvent } from "./nostr-signer";
import { TEST_NPUB } from "./nostr-test-keys";
// Available test files in tests/e2e/memes_test_files/
export const TEST_FILES = [
  "3cecbbd43d51b4eb9f16f6229efcb5d8037e350150b55b4ae0a3277176b1db40.jpg",
  "490ee2539277d4d58dbdd4e949dcd796e49787bbde6156287a54dfae833dd352.jpg",
  "a22d05aa6e7d58a0c427cc62ba0ba91dfb240b828e314f1c4d58308aec4e8123.jpg",
];

// Subscription status for testing different plan states
export type TestSubscriptionStatus =
  | "FREE"
  | "ACTIVE"
  | "EXPIRED"
  | "CANCELED"
  | "PAST_DUE";

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Logs in with a random user. Yields the user and adds an alias to the user
       *
       * @returns {typeof login}
       * @memberof Chainable
       * @example
       *    cy.login()
       * @example
       *    cy.login({ email: 'whatever@example.com' })
       */
      login: typeof login;

      /**
       * Logs in with a Nostr user. Creates the user if needed and sets session cookie.
       *
       * @returns {typeof loginNostr}
       * @memberof Chainable
       * @example
       *    cy.loginNostr()
       * @example
       *    cy.loginNostr({ npub: 'npub1xxx' })
       */
      loginNostr: typeof loginNostr;

      /**
       * Deletes the current @user
       *
       * @returns {typeof cleanupUser}
       * @memberof Chainable
       * @example
       *    cy.cleanupUser()
       * @example
       *    cy.cleanupUser({ email: 'whatever@example.com' })
       */
      cleanupUser: typeof cleanupUser;

      /**
       * Deletes the current Nostr @user
       *
       * @returns {typeof cleanupNostrUser}
       * @memberof Chainable
       * @example
       *    cy.cleanupNostrUser()
       * @example
       *    cy.cleanupNostrUser({ npub: 'npub1xxx' })
       */
      cleanupNostrUser: typeof cleanupNostrUser;

      /**
       * Extends the standard visit command to wait for the page to load
       *
       * @returns {typeof visitAndCheck}
       * @memberof Chainable
       * @example
       *    cy.visitAndCheck('/')
       *  @example
       *    cy.visitAndCheck('/', 500)
       */
      visitAndCheck: typeof visitAndCheck;

      /**
       * Upload test files from tests/e2e/memes_test_files/ to a file input
       *
       * @returns {typeof uploadTestFile}
       * @memberof Chainable
       * @example
       *    cy.uploadTestFile('input[type="file"]', 0)
       * @example
       *    cy.uploadTestFile('input[type="file"]', [0, 1, 2])
       */
      uploadTestFile: typeof uploadTestFile;

      /**
       * Sign a Nostr event using test keys
       *
       * @returns {typeof signNostrEvent}
       * @memberof Chainable
       * @example
       *    cy.signNostrEvent({ content: 'Hello Nostr!' })
       */
      signNostrEvent: typeof signNostrEvent;

      /**
       * Set the subscription status for the current test user.
       * Used for testing different plan states (free, active, expired).
       *
       * @returns {typeof setSubscriptionStatus}
       * @memberof Chainable
       * @example
       *    cy.setSubscriptionStatus('FREE')
       * @example
       *    cy.setSubscriptionStatus('ACTIVE')
       * @example
       *    cy.setSubscriptionStatus('EXPIRED')
       */
      setSubscriptionStatus: typeof setSubscriptionStatus;
    }
  }
}

function login({
  email = faker.internet.email({ provider: "example.com" }),
}: {
  email?: string;
} = {}) {
  cy.then(() => ({ email })).as("user");
  cy.exec(`npx tsx ./tests/e2e/support/create-user.ts "${email}"`).then(
    ({ stdout }) => {
      const cookieValue = stdout
        .replace(/.*<cookie>(?<cookieValue>.*)<\/cookie>.*/s, "$<cookieValue>")
        .trim();
      cy.setCookie("__session", cookieValue);
    }
  );
  return cy.get("@user");
}

function loginNostr({ npub = TEST_NPUB }: { npub?: string } = {}) {
  cy.then(() => ({ npub })).as("user");
  // Delete user first to ensure fresh state, then create
  cy.exec(`npx tsx ./tests/e2e/support/delete-nostr-user.ts "${npub}"`, {
    failOnNonZeroExit: false,
    env: {
      ...process.env,
    },
  }).then(() => {
    // Get DATABASE_URL from Cypress env or process.env
    const databaseUrl =
      (Cypress.env("DATABASE_URL") as string | undefined) ??
      process.env["DATABASE_URL"];
    const sessionSecret =
      (Cypress.env("SESSION_SECRET") as string | undefined) ??
      process.env["SESSION_SECRET"];
    const nostrPublisherUrl =
      (Cypress.env("NOSTR_PUBLISHER_URL") as string | undefined) ??
      process.env["NOSTR_PUBLISHER_URL"];
    const redisUrl =
      (Cypress.env("REDIS_URL") as string | undefined) ??
      process.env["REDIS_URL"];

    cy.exec(`npx tsx ./tests/e2e/support/create-nostr-user.ts "${npub}"`, {
      failOnNonZeroExit: false,
      env: {
        DATABASE_URL: databaseUrl,
        SESSION_SECRET: sessionSecret,
        NOSTR_PUBLISHER_URL: nostrPublisherUrl,
        REDIS_URL: redisUrl,
        ...process.env,
        // Override NODE_ENV after spread to ensure it's set
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- process.env values can be undefined at runtime
        NODE_ENV: process.env["NODE_ENV"] ?? "test",
      },
    }).then((result) => {
      const { stdout, stderr } = result;
      const code = "code" in result ? result.code : undefined;
      // Check if cookie is in stdout (script succeeded even if code is undefined)
      const cookieMatch = stdout.match(/<cookie>\s*([^<]+)\s*<\/cookie>/s);
      const cookieValue = cookieMatch?.[1]?.trim();
      if (cookieValue) {
        cy.setCookie("__session", cookieValue);
        return;
      }

      // If no cookie found, check exit code
      if (code !== 0 && code !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stderr/stdout can be undefined
        const errorMsg = `Failed to create user (exit code ${String(code)}). stderr: ${stderr ?? "none"}. stdout: ${stdout ?? "none"}`;
        cy.log(errorMsg);
        throw new Error(errorMsg);
      }

      // If code is undefined but we have stdout, try to extract cookie anyway
      if (stdout) {
        const extractedCookie = stdout
          .replace(
            /.*<cookie>(?<cookieValue>.*)<\/cookie>.*/s,
            "$<cookieValue>"
          )
          .trim();
        if (extractedCookie) {
          cy.setCookie("__session", extractedCookie);
          return;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stderr can be undefined
      throw new Error(
        `No cookie value found in output. stdout: ${stdout ?? "none"}, stderr: ${stderr ?? "none"}, code: ${code !== undefined ? String(code) : "undefined"}`
      );
    });
  });
  return cy.get("@user");
}

function cleanupUser({ email }: { email?: string } = {}) {
  if (email) {
    deleteUserByEmail(email);
  } else {
    cy.get("@user").then((user) => {
      const email = (user as { email?: string }).email;
      if (email) {
        deleteUserByEmail(email);
      }
    });
  }
  cy.clearCookie("__session");
}

function cleanupNostrUser({ npub }: { npub?: string } = {}) {
  if (npub) {
    deleteNostrUserByNpub(npub);
  } else {
    // Check if @user alias exists before trying to access it
    // Use cy.state to check aliases
    cy.wrap(null).then(() => {
      // Type assertion for Cypress internal state access
      interface CypressState {
        state: (key: string) => unknown;
      }
      const aliases = (cy as unknown as CypressState).state("aliases") as
        | Record<string, unknown>
        | undefined;
      if (aliases?.user) {
        cy.get("@user", { log: false }).then((user) => {
          const userNpub = (user as { npub?: string }).npub;
          if (userNpub) {
            deleteNostrUserByNpub(userNpub);
          }
        });
      } else {
        cy.log("No user to cleanup");
      }
    });
  }
  cy.clearCookie("__session");
}

function deleteUserByEmail(email: string) {
  void cy.exec(`npx tsx ./tests/e2e/support/delete-user.ts "${email}"`);
  cy.clearCookie("__session");
}

function deleteNostrUserByNpub(npub: string) {
  cy.exec(`npx tsx ./tests/e2e/support/delete-nostr-user.ts "${npub}"`, {
    failOnNonZeroExit: false,
    env: {
      ...process.env,
    },
  }).then((result) => {
    const code = "code" in result ? result.code : undefined;
    const stderr = result.stderr;
    if (code !== 0) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stderr can be undefined
      cy.log(
        `Warning: delete-nostr-user exited with code ${String(code)}: ${stderr ?? "unknown error"}`
      );
    }
  });
  cy.clearCookie("__session");
}

// We're waiting a second because of this issue happen randomly
// https://github.com/cypress-io/cypress/issues/7306
// Also added custom types to avoid getting detached
// https://github.com/cypress-io/cypress/issues/7306#issuecomment-1152752612
// ===========================================================
function visitAndCheck(url: string, waitTime = 1000) {
  cy.visit(url);
  // For URLs with query params, check the full href; otherwise check pathname
  if (url.includes("?")) {
    const basePath = url.split("?")[0];
    cy.location("pathname").should("contain", basePath).wait(waitTime);
  } else {
    cy.location("pathname").should("contain", url).wait(waitTime);
  }
}

/**
 * Upload test file(s) from tests/e2e/memes_test_files/ to a file input
 * @param selector - CSS selector for the file input
 * @param fileIndex - Index of file(s) to upload from TEST_FILES array (0, 1, 2, or array of indices)
 */
function uploadTestFile(
  selector: string,
  fileIndex: number | number[] = 0
): void {
  const indices = Array.isArray(fileIndex) ? fileIndex : [fileIndex];
  const filePaths = indices.map(
    (i) => `tests/e2e/memes_test_files/${TEST_FILES[i]}`
  );

  cy.get(selector).selectFile(filePaths, { force: true });
}

/**
 * Sign a Nostr event using test keys
 * Returns the signed event that can be used in tests
 */
function signNostrEvent(eventData: {
  content: string;
  kind?: number;
  tags?: string[][];
}): Cypress.Chainable<SignedEvent> {
  return cy.wrap(signEvent(eventData));
}

/**
 * Set subscription status for the current test user.
 * Updates the database directly to simulate different plan states.
 * @param status - The subscription status to set (FREE, ACTIVE, EXPIRED, CANCELED, PAST_DUE)
 */
function setSubscriptionStatus(status: TestSubscriptionStatus): void {
  cy.get("@user").then((user) => {
    const npub = (user as { npub?: string }).npub;
    if (!npub) {
      throw new Error(
        "No npub found on user. Make sure to call cy.loginNostr() first."
      );
    }

    // Get environment variables for the script
    const databaseUrl =
      (Cypress.env("DATABASE_URL") as string | undefined) ??
      process.env["DATABASE_URL"];
    const sessionSecret =
      (Cypress.env("SESSION_SECRET") as string | undefined) ??
      process.env["SESSION_SECRET"];
    const nostrPublisherUrl =
      (Cypress.env("NOSTR_PUBLISHER_URL") as string | undefined) ??
      process.env["NOSTR_PUBLISHER_URL"];
    const redisUrl =
      (Cypress.env("REDIS_URL") as string | undefined) ??
      process.env["REDIS_URL"];

    cy.exec(
      `npx tsx ./tests/e2e/support/update-subscription-status.ts "${npub}" "${status}"`,
      {
        failOnNonZeroExit: false,
        env: {
          DATABASE_URL: databaseUrl,
          SESSION_SECRET: sessionSecret,
          NOSTR_PUBLISHER_URL: nostrPublisherUrl,
          REDIS_URL: redisUrl,
          ...process.env,
          // Override NODE_ENV after spread to ensure it's set
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- process.env values can be undefined at runtime
          NODE_ENV: process.env["NODE_ENV"] ?? "test",
        },
      }
    ).then((result) => {
      const { stdout, stderr } = result;
      const code = "code" in result ? result.code : undefined;
      // Check if status is in stdout (script succeeded even if code is undefined)
      const statusMatch = stdout.match(/<status>\s*([^<]+)\s*<\/status>/s);
      const resultStatus = statusMatch?.[1]?.trim();
      if (resultStatus) {
        cy.log(`Subscription status set to: ${resultStatus}`);
        return;
      }

      // If no status found, check exit code
      if (code !== 0 && code !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stderr/stdout can be undefined
        const errorMsg = `Failed to set subscription status (exit code ${String(code)}). stderr: ${stderr ?? "none"}. stdout: ${stdout ?? "none"}`;
        cy.log(errorMsg);
        throw new Error(errorMsg);
      }

      // If code is undefined but we have stdout, try to extract status anyway
      if (stdout) {
        const extractedStatus = stdout
          .replace(
            /.*<status>(?<statusValue>.*)<\/status>.*/s,
            "$<statusValue>"
          )
          .trim();
        if (extractedStatus) {
          cy.log(`Subscription status set to: ${extractedStatus}`);
          return;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- stderr can be undefined
      cy.log(
        `Warning: Could not extract subscription status from output. stdout: ${stdout ?? "none"}, stderr: ${stderr ?? "none"}, code: ${code !== undefined ? String(code) : "undefined"}`
      );
    });
  });
}

export const registerCommands = () => {
  Cypress.Commands.add("login", login);
  Cypress.Commands.add("loginNostr", loginNostr);
  Cypress.Commands.add("cleanupUser", cleanupUser);
  Cypress.Commands.add("cleanupNostrUser", cleanupNostrUser);
  Cypress.Commands.add("visitAndCheck", visitAndCheck);
  Cypress.Commands.add("uploadTestFile", uploadTestFile);
  Cypress.Commands.add("signNostrEvent", signNostrEvent);
  Cypress.Commands.add("setSubscriptionStatus", setSubscriptionStatus);
};
