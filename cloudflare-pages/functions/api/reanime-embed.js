import embed from "../../../server/reanime-embed.cjs";

export async function onRequest({ request }) {
  const headers = new Headers();
  let response;
  const adapter = {
    statusCode: 200,
    setHeader: (name, value) => headers.set(name, value),
    end(body) {
      response = new Response(body, { status: this.statusCode, headers });
    },
  };
  await embed.reanimeEmbed(request, adapter);
  if (response.status !== 502) return response;

  // Retry only the small lookup response. The iframe still loads from FlixCloud.
  const url = new URL("/api/reanime-embed", "https://apexanime.vercel.app");
  url.search = new URL(request.url).search;
  try {
    return await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "error" });
  } catch {
    return response;
  }
}
