/**
 * Trusted reverse-proxy configuration for Express (`app.set("trust proxy", …)`).
 *
 * Production topology:
 *
 *   client -> Cloudflare edge -> Traefik (coolify-proxy, 10.0.1.x) -> app
 *
 * Traefik only preserves an incoming `X-Forwarded-For` header when the peer is
 * in its `forwardedHeaders.trustedIPs` list (configured to the Cloudflare
 * ranges below in /data/coolify/proxy/docker-compose.yml). It then appends the
 * peer address, so the app receives `X-Forwarded-For: <client>, <cf-edge>`.
 *
 * For Express to resolve `req.ip` to `<client>`, it must trust BOTH hops:
 * Traefik (private network) and Cloudflare (public ranges). Express walks the
 * header right-to-left and stops at the first untrusted address, so a client
 * that spoofs its own `X-Forwarded-For` is ignored (Cloudflare appends the
 * real address after it).
 *
 * Previously `trust proxy` was `1`, which made `req.ip` the Cloudflare edge
 * address for every visitor, so all users behind the same Cloudflare POP
 * shared one rate-limit bucket.
 */

/**
 * Cloudflare IPv4/IPv6 ranges.
 * Source: https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
 * Snapshot: 2026-10-21. These change rarely; if Cloudflare adds a range not
 * listed here, visitors via that edge degrade to the old behaviour (their
 * `req.ip` becomes the edge address) rather than anything unsafe.
 *
 * Keep in sync with `--entrypoints.*.forwardedHeaders.trustedIPs` in the
 * Traefik proxy configuration.
 */
export const CLOUDFLARE_IP_RANGES: readonly string[] = [
  // IPv4
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  // IPv6
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

/**
 * Value for `app.set("trust proxy", …)`.
 *
 * - `loopback`    : 127.0.0.0/8, ::1 (container-local health probes)
 * - `uniquelocal` : 10/8, 172.16/12, 192.168/16, fc00::/7 (Traefik on the
 *                   Docker `coolify` network)
 * - Cloudflare    : public edge ranges above
 */
export const TRUSTED_PROXIES: readonly string[] = [
  "loopback",
  "uniquelocal",
  ...CLOUDFLARE_IP_RANGES,
];
