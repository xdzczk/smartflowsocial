import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Short health probe. This is the profile used when no staging URL is configured.
 * It is not a capacity test of the application.
 */
export const options = {
  vus: 2,
  duration: "15s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

const base = __ENV.BASE_URL || "http://127.0.0.1:3999";

export default function () {
  const response = http.get(`${base}/healthcheck`);
  check(response, {
    "health responds 200": (result) => result.status === 200,
  });
  sleep(0.5);
}
