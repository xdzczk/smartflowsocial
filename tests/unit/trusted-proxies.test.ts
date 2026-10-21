import type { AddressInfo } from "node:net";

import express, { type Express } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CLOUDFLARE_IP_RANGES,
  TRUSTED_PROXIES,
} from "~/lib/trusted-proxies.server";

type Server = ReturnType<Express["listen"]>;

function listen(application: Express): Promise<Server> {
  return new Promise((resolve) => {
    const srv = application.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

/**
 * Exercises Express's real `trust proxy` resolution with the production
 * setting, simulating what Traefik forwards to the app.
 *
 * The socket peer in these tests is 127.0.0.1 (loopback, trusted) standing in
 * for Traefik on the private Docker network (uniquelocal, trusted).
 */
describe("TRUSTED_PROXIES / req.ip resolution", () => {
  const app = express();
  app.set("trust proxy", [...TRUSTED_PROXIES]);
  app.get("/ip", (req, res) => {
    res.json({ ip: req.ip });
  });

  let baseUrl = "";
  let server: Server;

  beforeAll(async () => {
    server = await listen(app);
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function ipFor(xff?: string): Promise<string> {
    const res = await fetch(`${baseUrl}/ip`, {
      headers: xff ? { "X-Forwarded-For": xff } : {},
    });
    const body = (await res.json()) as { ip: string };
    return body.ip;
  }

  it("resolves the real client behind Cloudflare -> Traefik", async () => {
    // Traefik (trusting Cloudflare) preserves Cloudflare's XFF and appends the edge IP
    expect(await ipFor("203.0.113.5, 172.64.1.1")).toBe("203.0.113.5");
    expect(await ipFor("2001:db8::1, 2606:4700:10::1")).toBe("2001:db8::1");
  });

  it("ignores a client-spoofed X-Forwarded-For entry", async () => {
    // Client sent "XFF: 9.9.9.9"; Cloudflare appended the real client; Traefik appended the edge
    expect(await ipFor("9.9.9.9, 203.0.113.5, 172.64.1.1")).toBe("203.0.113.5");
  });

  it("falls back to the edge/peer address when the peer is not Cloudflare", async () => {
    // Traefik did not trust the peer -> XFF is just the peer (e.g. uptime checker)
    expect(await ipFor("198.51.100.7")).toBe("198.51.100.7");
  });

  it("uses the socket address when no X-Forwarded-For is present (health probes)", async () => {
    expect(await ipFor()).toBe("127.0.0.1");
  });

  it("would have reported the Cloudflare edge with the previous setting", async () => {
    // Regression context: documents the bug that motivated the change.
    const legacy = express();
    legacy.set("trust proxy", 1);
    legacy.get("/ip", (req, res) => {
      res.json({ ip: req.ip });
    });
    const srv = await listen(legacy);
    const { port } = srv.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/ip`, {
      headers: { "X-Forwarded-For": "203.0.113.5, 172.64.1.1" },
    });
    const body = (await res.json()) as { ip: string };
    await new Promise<void>((resolve) => srv.close(() => resolve()));
    expect(body.ip).toBe("172.64.1.1");
  });

  it("lists well-formed CIDR ranges only", () => {
    const cidr = /^([0-9.]+|[0-9a-f:]+)\/\d{1,3}$/i;
    for (const range of CLOUDFLARE_IP_RANGES) {
      expect(range).toMatch(cidr);
    }
    expect(CLOUDFLARE_IP_RANGES.length).toBeGreaterThanOrEqual(20);
  });
});
