module.exports = async (req,res) => {
res.setHeader('Cache-Control','no-store');
if(req.method!=='POST') return res.status(405).end();
const {timingSafeEqual}=require('node:crypto');
const a=Buffer.from(req.headers.authorization||''), b=Buffer.from('Bearer '+process.env.APEX_RELAY_KEY);
if(!process.env.APEX_RELAY_KEY||a.length!==b.length||!timingSafeEqual(a,b)) return res.status(401).end();
const input = req.body || {};
if (input.operation === "graphql") {
  const { accessToken, payload } = input;
  if (typeof accessToken !== "string" || !/^[A-Za-z0-9._-]{1,4096}$/.test(accessToken) ||
      typeof payload?.query !== "string" || JSON.stringify(payload).length > 32768)
    return res.status(400).json({error:"Invalid AniList request"});
  try {
    const upstream = await fetch("https://graphql.anilist.co", {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify(payload),
    });
    const data = await upstream.json().catch(() => ({error:"AniList returned a non-JSON response"}));
    return res.status(upstream.status >= 300 && upstream.status < 400 ? 502 : upstream.status).json(data);
  } catch {
    return res.status(502).json({error:"AniList is unavailable"});
  }
}
const {client_secret,code}=input;
if(typeof client_secret!=='string'||client_secret.length>256||typeof code!=='string'||code.length>4096) return res.status(400).end();
try {
const r=await fetch('https://anilist.co/api/v2/oauth/token',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({grant_type:'authorization_code',client_id:'56888',redirect_uri:'https://apexanime.pages.dev/api/oauth/anilist/callback',client_secret,code})});
if(!r.ok) return res.status(502).json({status:r.status,error:(await r.json().catch(()=>({}))).error||null});
const d=await r.json(); return res.json({access_token:d.access_token,expires_in:d.expires_in});
} catch { return res.status(502).end(); }
};
