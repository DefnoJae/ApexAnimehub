const {test} = require("node:test");
const assert = require("node:assert/strict");
const {companyMatch,studioLogo,handler} = require("./studios.cjs");
test("company identity ignores punctuation but never chooses a similarly named studio", () => {
 assert.equal(companyMatch("SILVER LINK.", "Silver Link"),true);
 assert.equal(companyMatch("MAPPA", "MAPPA Pictures"),false);
 assert.equal(companyMatch("", ""),false);
});
test("validated AniList identity chooses the exact company, deduplicates and caches", async () => {
 const original = global.fetch, token = process.env.TMDB_READ_ACCESS_TOKEN;
 process.env.TMDB_READ_ACCESS_TOKEN = "test";
 const calls=[];
 global.fetch = async (url) => { calls.push(url);return {ok:true,json:async()=>url.includes("graphql") ? {data:{Studio:{id:123456,name:"SILVER LINK.",isAnimationStudio:true}}} : {results:[{name:"Silver Pictures",logo_path:"/wrong.png"},{name:"Silver Link",logo_path:"/right.png"}]}}; };
 try {
  const [a,b] = await Promise.all([studioLogo(123456),studioLogo(123456)]);
  assert.equal(a.logo,"https://image.tmdb.org/t/p/original/right.png");assert.deepEqual(a,b);
  await studioLogo(123456); assert.equal(calls.length,2);
 } finally {global.fetch=original;if(token===undefined)delete process.env.TMDB_READ_ACCESS_TOKEN;else process.env.TMDB_READ_ACCESS_TOKEN=token;}
});
test("invalid IDs are rejected before contacting providers", async () => {
 const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
 await handler({method:"GET",url:"/api/studio-logo?id=-1"},res);assert.equal(res.statusCode,400);
});
