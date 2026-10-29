import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useRatingSource } from "../hooks/useRatingSource";
import { getMalScore } from "../utils/animeMetadata";
import { fetchAnilist } from "../utils/anilist";
import "./ratingPills.css";
const pending = new Map<string, Promise<number | null>>();
function anilistScore(id?: number, idMal?: number | null) {
  const key = id + ":" + idMal;
  if (!pending.has(key)) {
    if (pending.size >= 500) pending.delete(pending.keys().next().value!);
    pending.set(
      key,
      fetchAnilist<{ Media: { averageScore?: number } }>(
        "query($id:Int,$idMal:Int){Media(id:$id,idMal:$idMal,type:ANIME){averageScore}}",
        id ? { id } : { idMal },
      )
        .then((d) => (d.Media?.averageScore ? d.Media.averageScore / 10 : null))
        .catch(() => null),
    );
  }
  return pending.get(key)!;
}
export function RatingPills({
  id,
  idMal,
  averageScore,
  malScore,
  active = true,
  asText = false,
}: {
  id?: number;
  idMal?: number | null;
  averageScore?: number | null;
  malScore?: number | null;
  active?: boolean;
  asText?: boolean;
}) {
  const [source] = useRatingSource(),
    [al, setAl] = useState<number | null>(
      averageScore ? averageScore / 10 : null,
    ),
    [mal, setMal] = useState<number | null>(malScore ?? null);
  useEffect(() => {
    let live = true;
    setAl(averageScore ? averageScore / 10 : null);
    setMal(malScore ?? null);
    if (active) {
      if (source !== "mal" && !averageScore && (id || idMal))
        void anilistScore(id, idMal).then((v) => {
          if (live) setAl(v);
        });
      if (source !== "anilist" && malScore == null && idMal)
        void getMalScore(idMal).then((v) => {
          if (live) setMal(v);
        });
    }
    return () => {
      live = false;
    };
  }, [id, idMal, averageScore, malScore, active, source]);
  const Tag = asText ? "span" : "a";
  return (
    <>
      {(["anilist", "mal"] as const).map((provider) => {
        const score = provider === "anilist" ? al : mal;
        if ((source !== "both" && source !== provider) || !score) return null;
        const label = provider === "anilist" ? "AniList" : "MyAnimeList";
        return (
          <Tag
            key={provider}
            className={"public-rating-pill rating-" + provider}
            href={
              provider === "anilist"
                ? id
                  ? "https://anilist.co/anime/" + id
                  : "https://anilist.co"
                : "https://myanimelist.net/anime/" + idMal
            }
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label + " rating " + score.toFixed(1)}
            title={label + " rating"}
          >
            <span
              className="rating-brand"
              role="img"
              aria-label={label}
              style={{
                maskImage: `url(/${provider === "anilist" ? "anilist" : "mal"}-logo.svg)`,
                WebkitMaskImage: `url(/${provider === "anilist" ? "anilist" : "mal"}-logo.svg)`,
              }}
            />
            <Star size={12} fill="currentColor" />
            <b>{score.toFixed(1)}</b>
          </Tag>
        );
      })}
    </>
  );
}
export function PersonalRating({
  score,
  className = "",
}: {
  score?: number;
  className?: string;
}) {
  if (!score || score < 1 || score > 10) return null;
  const hue = Math.min(145, Math.round((score - 1) * 20));
  return (
    <span
      className={"personal-rating-pill " + className}
      style={{
        background: `hsl(${hue} 42% 26% / .8)`,
        borderColor: `hsl(${hue} 60% 65% / .35)`,
      }}
      aria-label={"Your rating: " + score + "/10"}
      title={"Your rating: " + score + "/10"}
    >
      <Star size={13} />
      <b>{score}</b>
    </span>
  );
}
