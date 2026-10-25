const statusMap = {
  watching: { anilist: "CURRENT", mal: "watching" },
  planning: { anilist: "PLANNING", mal: "plan_to_watch" },
  completed: { anilist: "COMPLETED", mal: "completed" },
  paused: { anilist: "PAUSED", mal: "on_hold" },
  dropped: { anilist: "DROPPED", mal: "dropped" },
};
async function upstream(url, options) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      "Provider request failed (" +
        response.status +
        ")." +
        (response.status === 401 ? " Please reconnect your account." : ""),
    );
  return response.json();
}
async function graphql(accessToken, query, variables) {
  const payload = await upstream("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (payload.errors?.length || !payload.data)
    throw new Error(payload.errors?.[0]?.message || "AniList returned no data");
  return payload.data;
}
function validateUpdate(input) {
  if (
    !Number.isSafeInteger(input.id) ||
    input.id <= 0 ||
    !Object.prototype.hasOwnProperty.call(statusMap, input.status)
  )
    throw new Error("Invalid anime or list status");
  if (
    input.progress !== undefined &&
    (!Number.isSafeInteger(input.progress) ||
      input.progress < 0 ||
      input.progress > 100000)
  )
    throw new Error("Invalid episode progress");
  return input;
}
async function updateList(provider, account, input) {
  validateUpdate(input);
  let progress = input.progress;
  // Progress reports only move forward. Explicit status-only changes preserve progress.
  if (provider === "anilist") {
    let existing;
    if (progress !== undefined || input.automatic) {
      const data = await graphql(
        account.accessToken,
        "query($id:Int){Media(id:$id,type:ANIME){mediaListEntry{progress status}}}",
        { id: input.id },
      );
      if (!data.Media) throw new Error("Anime not found");
      existing = data.Media.mediaListEntry;
      if (progress !== undefined)
        progress = Math.max(progress, existing?.progress || 0);
    }
    const status =
      input.automatic && existing?.status === "COMPLETED"
        ? "COMPLETED"
        : statusMap[input.status].anilist;
    const data = await graphql(
      account.accessToken,
      "mutation($id:Int,$status:MediaListStatus,$progress:Int){SaveMediaListEntry(mediaId:$id,status:$status,progress:$progress){id status progress}}",
      { id: input.id, status, ...(progress !== undefined ? { progress } : {}) },
    );
    if (!data.SaveMediaListEntry)
      throw new Error("AniList did not confirm the update");
    return data.SaveMediaListEntry;
  }
  let existing;
  if (progress !== undefined || input.automatic) {
    const data = await upstream(
      "https://api.myanimelist.net/v2/anime/" +
        input.id +
        "?fields=my_list_status",
      { headers: { Authorization: "Bearer " + account.accessToken } },
    );
    existing = data.my_list_status;
    if (progress !== undefined)
      progress = Math.max(progress, existing?.num_episodes_watched || 0);
  }
  const status =
    input.automatic && existing?.status === "completed"
      ? "completed"
      : statusMap[input.status].mal;
  const fields = new URLSearchParams({ status });
  if (progress !== undefined)
    fields.set("num_watched_episodes", String(progress));
  return upstream(
    "https://api.myanimelist.net/v2/anime/" + input.id + "/my_list_status",
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + account.accessToken,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: fields.toString(),
    },
  );
}
async function readList(provider, account, page = 1) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    throw new Error("Invalid list page");
  const reverse = (value) =>
    Object.keys(statusMap).find((key) => statusMap[key][provider] === value) ||
    "watching";
  if (provider === "anilist") {
    const { Viewer } = account.identity
      ? { Viewer: account.identity }
      : await graphql(account.accessToken, "query{Viewer{id name}}");
    account.identity = Viewer;
    const data = await graphql(
      account.accessToken,
      "query($user:Int,$page:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} mediaList(userId:$user,type:ANIME){status progress updatedAt media{id idMal episodes title{english romaji} coverImage{extraLarge} bannerImage}}}}",
      { user: Viewer.id, page },
    );
    return {
      identity: String(Viewer.id),
      name: Viewer.name,
      hasNextPage: data.Page.pageInfo.hasNextPage,
      entries: data.Page.mediaList.map((entry) => ({
        anime: entry.media,
        status: reverse(entry.status),
        progress: entry.progress,
        updatedAt: entry.updatedAt * 1000,
      })),
    };
  }
  const headers = { Authorization: "Bearer " + account.accessToken };
  const user =
    account.identity ||
    (await upstream("https://api.myanimelist.net/v2/users/@me", {
      headers,
    }));
  account.identity = { id: user.id, name: user.name };
  const data = await upstream(
    "https://api.myanimelist.net/v2/users/@me/animelist?limit=100&offset=" +
      (page - 1) * 100 +
      "&nsfw=true&fields=list_status,num_episodes",
    { headers },
  );
  return {
    identity: String(user.id),
    name: user.name,
    hasNextPage: !!data.paging?.next,
    entries: data.data.map(({ node, list_status: entry }) => ({
      anime: {
        id: 0,
        idMal: node.id,
        title: { english: node.title },
        coverImage: {
          extraLarge: node.main_picture?.large || node.main_picture?.medium,
        },
        episodes: node.num_episodes || null,
      },
      status: reverse(entry.status),
      progress: entry.num_episodes_watched,
      updatedAt: Date.parse(entry.updated_at) || 0,
    })),
  };
}
module.exports = { updateList, readList, validateUpdate, statusMap };
