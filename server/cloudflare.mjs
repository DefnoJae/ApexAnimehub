import { createServer } from "node:http";
import { httpServerHandler } from "cloudflare:node";
import { handler } from "./vercel.cjs";

const api = httpServerHandler(createServer(handler));

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
