export function onRequest({ request, env }) {
  return env.APEX_API.fetch(request);
}
