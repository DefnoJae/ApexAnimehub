const { createServer } = require("node:http");
const exchange = require("./api/exchange.js");

createServer(async (req, res) => {
  res.status = (status) => { res.statusCode = status; return res; };
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };
  if (req.url === "/health" && req.method === "GET") {
    return res.status(process.env.APEX_RELAY_KEY ? 200 : 503).end();
  }
  if (req.url !== "/api/exchange") return res.status(404).end();
  if (req.method !== "POST") return res.status(405).end();
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      size += chunk.length;
      if (size > 65536) return res.status(413).end();
      chunks.push(chunk);
    }
    req.body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).end();
    }
  } catch {
    return res.status(400).end();
  }
  await exchange(req, res);
}).listen(Number(process.env.PORT || 10000), "0.0.0.0");
