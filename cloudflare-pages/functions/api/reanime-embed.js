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
  return response;
}
