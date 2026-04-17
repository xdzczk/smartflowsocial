/**
 * Detect whether this request wants a synchronous JSON response rather than
 * the default `defer()` streaming response.
 *
 * Remix strips the internal `_data` query-param before the loader sees the
 * Request, so we use our own `_loader=json` param instead.  The `queryFn` in
 * `useInfiniteRemixQuery` appends this param to every page-fetch URL.
 */
export function isRemixResourceRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.get("_loader") === "json";
}
