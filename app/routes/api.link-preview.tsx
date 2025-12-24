import { json } from "@remix-run/node";

export async function loader({ request }) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return json({ success: 0, meta: {} }, { status: 400 });
  }

  try {
    new URL(targetUrl);
  } catch {
    return json({ success: 0, meta: {} }, { status: 400 });
  }

  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    return json({ success: 0, meta: {} }, { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0)",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descriptionMatch =
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i,
      );
    const imageMatch =
      html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
      );

    const title = titleMatch ? titleMatch[1].trim() : "";
    const description = descriptionMatch ? descriptionMatch[1].trim() : "";
    const image = imageMatch ? imageMatch[1].trim() : "";

    return json({
      success: 1,
      meta: {
        title,
        description,
        image: {
          url: image,
        },
      },
    });
  } catch (error) {
    console.error("Link preview error:", error);
    return json({ success: 0, meta: {} }, { status: 500 });
  }
}
