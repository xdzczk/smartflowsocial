/**
 * Tiny HTTP fixture for the k6 smoke profile.
 * It is not the application. Full load tests belong on an explicit staging URL.
 */
import { createServer } from "node:http";

const port = Number(process.env.FIXTURE_PORT ?? 3999);
const server = createServer((req, res) => {
  if (req.url?.startsWith("/healthcheck")) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not the app");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`load-test fixture listening on 127.0.0.1:${port}`);
});
