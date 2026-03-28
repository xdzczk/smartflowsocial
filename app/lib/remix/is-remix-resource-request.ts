/**
 * Remix client resource requests include `?_data=routes/...` so loaders can return
 * synchronous JSON while document navigations use `defer()` for faster shells.
 */
export function isRemixResourceRequest(request: Request): boolean {
  return new URL(request.url).searchParams.has("_data");
}
