export async function GET() {
  const site = (import.meta.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  return new Response(
    ["User-agent: *", "Allow: /", "", site ? `Sitemap: ${site}/sitemap.xml` : ""].filter(Boolean).join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}