export async function fetchFallbackAnimeDetails(id: number, signal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);
  if (signal.aborted) abort();
  const timer = setTimeout(abort, 8000);
  const data = await (async () => {
    const response = await fetch("https://api.ani.zip/mappings?anilist_id=" + id, {
      signal: controller.signal,
      credentials: "omit",
    });
    return response.ok ? await response.json() : null;
  })().finally(() => {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  });
  if (Number(data?.mappings?.anilist_id) !== id) return null;
  const title = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const english = title(data.titles?.en);
  const romaji = title(data.titles?.["x-jat"]) || title(data.titles?.ja);
  if (!english && !romaji) return null;
  const image = (coverType: string) => {
    const match = Array.isArray(data.images)
      ? data.images.find((item: { coverType?: string; url?: string }) =>
          item?.coverType === coverType && typeof item.url === "string" && item.url.startsWith("https://"))
      : undefined;
    return match?.url as string | undefined;
  };
  return {
    id,
    idMal: Number(data.mappings.mal_id) || undefined,
    title: { english, romaji },
    coverImage: { extraLarge: image("Poster") },
    bannerImage: image("Fanart"),
    format: title(data.mappings.type),
    fallbackEpisodeCount: Number.isSafeInteger(data.episodeCount) && data.episodeCount > 0
      ? data.episodeCount as number
      : undefined,
  };
}

export const detailQuery = `query AnimeDetails($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore
    trailer { id site }
    seasonYear format status genres studios(isMain:true){nodes{id name isAnimationStudio}} nextAiringEpisode { episode }
    recommendations(sort:RATING_DESC,perPage:24){nodes{mediaRecommendation{id idMal type isAdult seasonYear format title{english romaji} coverImage{extraLarge} bannerImage episodes averageScore}}}
    relations { edges { relationType node { id idMal title { english romaji } coverImage { extraLarge } type bannerImage description seasonYear format episodes averageScore nextAiringEpisode { episode } } } }
  }
}`;
