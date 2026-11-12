import type { DashboardAnime } from "../components/HomeDashboard";
import { fetchAnilist } from "./anilist";

type SearchAnime = DashboardAnime & {
  synonyms?: string[];
  popularity?: number;
  title: DashboardAnime["title"] & { native?: string };
};

const commonWords = new Set([
  "a",
  "an",
  "and",
  "anime",
  "of",
  "on",
  "the",
  "to",
  "with",
  "in",
  "is",
  "my",
]);
const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const words = (text: string) => normalize(text).split(/\s+/).filter(Boolean);
const keywords = (text: string) =>
  words(text).filter((word) => !commonWords.has(word));

function searchVariants(input: string) {
  const normalized = normalize(input);
  const terms = keywords(input);
  const [anchor = "", secondary = ""] = Array.from(new Set(terms)).sort(
    (a, b) => b.length - a.length,
  );
  const last = terms[terms.length - 1] || "";
  const phrasePrefix =
    terms.length > 1 && last.length >= 5
      ? [...terms.slice(0, -1), last.slice(0, -1)].join(" ")
      : "";
  // Short prefixes retrieve candidates even when the full word has a typo.
  return Array.from(
    new Set([
      input,
      normalized,
      terms.join(" "),
      phrasePrefix,
      anchor,
      anchor.length >= 5
        ? anchor.slice(0, Math.max(3, Math.floor(anchor.length * 0.65)))
        : "",
      secondary.length >= 3 ? secondary : "",
    ]),
  )
    .filter((value) => value.length >= 2)
    .slice(0, 7);
}

function tokenScore(query: string, title: string) {
  if (query === title) return 3;
  if (query.length >= 3 && title.startsWith(query)) return 2;
  if (query.length < 4 || Math.abs(query.length - title.length) > 1) return 0;
  // One insertion, deletion, substitution or adjacent transposition.
  let index = 0;
  while (index < query.length && query[index] === title[index]) index++;
  const a = query.slice(index),
    b = title.slice(index);
  return a.slice(1) === b ||
    a === b.slice(1) ||
    a.slice(1) === b.slice(1) ||
    (a.length >= 2 &&
      a[0] === b[1] &&
      a[1] === b[0] &&
      a.slice(2) === b.slice(2))
    ? 1
    : 0;
}

export function rankAnimeSearch(
  input: string,
  candidates: SearchAnime[],
  primaryIds: Set<number>,
) {
  const phrase = normalize(input);
  const terms = keywords(input);
  return Array.from(
    new Map(candidates.map((anime) => [anime.id, anime])).values(),
  )
    .map((anime) => {
      const titles = [
        anime.title.english,
        anime.title.romaji,
        anime.title.native,
        ...(anime.synonyms || []),
      ];
      const relevance = Math.max(
        0,
        ...titles
          .filter((title): title is string => !!title)
          .map((title) => {
            const name = normalize(title);
            if (name === phrase) return 100;
            if (name.startsWith(phrase + " ")) return 80;
            if ((" " + name + " ").includes(" " + phrase + " ")) return 70;
            const titleWords = words(title);
            if (!terms.length) return 0;
            const matches = terms.map((term) =>
              Math.max(0, ...titleWords.map((word) => tokenScore(term, word))),
            );
            const matched = matches.filter(Boolean).length;
            if (matched < Math.ceil(terms.length / 2)) return 0;
            return (
              20 +
              (30 * matched) / terms.length +
              (5 * matches.reduce((sum, value) => sum + value, 0)) /
                terms.length
            );
          }),
      );
      return { anime, relevance };
    })
    .filter(({ anime, relevance }) => relevance > 0 || primaryIds.has(anime.id))
    .sort(
      (a, b) =>
        b.relevance - a.relevance ||
        (b.anime.popularity || 0) - (a.anime.popularity || 0),
    )
    .slice(0, 20)
    .map(({ anime }) => anime);
}

export async function searchAnimeTitles(input: string, signal?: AbortSignal) {
  const variants = searchVariants(input.trim().slice(0, 120));
  if (!variants.length) return [];
  const variables = Object.fromEntries(
    variants.map((value, index) => ["q" + index, value]),
  );
  const query = `query AnimeTitleSearch(${variants.map((_, index) => `$q${index}:String!`).join(",")}) {
    ${variants
      .map(
        (_, index) => `q${index}:Page(perPage:16) {
      media(search:$q${index},type:ANIME) {
        id idMal title { english romaji native } synonyms popularity
        coverImage { extraLarge } episodes nextAiringEpisode { episode }
      }
    }`,
      )
      .join("\n")}
  }`;
  const data = await fetchAnilist<Record<string, { media: SearchAnime[] }>>(
    query,
    variables,
    signal,
  );
  return rankAnimeSearch(
    input,
    Object.values(data).flatMap((page) => page.media),
    new Set(data.q0.media.map((anime) => anime.id)),
  );
}
