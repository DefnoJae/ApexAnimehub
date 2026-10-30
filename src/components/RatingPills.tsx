import React, { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { useRatingSource } from "../hooks/useRatingSource";
import { getMalScore, getCachedMalScore } from "../utils/animeMetadata";
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
  showBrand = true,
}: {
  id?: number;
  idMal?: number | null;
  averageScore?: number | null;
  malScore?: number | null;
  active?: boolean;
  asText?: boolean;
  showBrand?: boolean;
}) {
  const [source] = useRatingSource(),
    [al, setAl] = useState<number | null>(
      averageScore ? averageScore / 10 : null,
    ),
    [mal, setMal] = useState<number | null>(
      malScore ?? (idMal ? getCachedMalScore(idMal) : null),
    );
  const anchor = useRef<HTMLSpanElement>(null);
  const [nearby, setNearby] = useState(false);
  useEffect(() => {
    if (!asText || !anchor.current) return;
    if (!window.IntersectionObserver) {
      setNearby(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearby(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(anchor.current.closest(".poster-card") || anchor.current);
    return () => observer.disconnect();
  }, [asText]);
  useEffect(() => {
    let live = true;
    setAl(averageScore ? averageScore / 10 : null);
    setMal(malScore ?? (idMal ? getCachedMalScore(idMal) : null));
    if (active || nearby) {
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
  }, [id, idMal, averageScore, malScore, active, nearby, source]);
  const Tag = asText ? "span" : "a";
  return (
    <span
      ref={anchor}
      className={asText ? "hover-rating-values" : "rating-values"}
    >
      {(["anilist", "mal"] as const).map((provider) => {
        const score = provider === "anilist" ? al : mal;
        if ((source !== "both" && source !== provider) || !score) return null;
        const label = provider === "anilist" ? "AniList" : "MyAnimeList";
        return (
          <Tag
            key={provider}
            className={
              (asText || !showBrand
                ? "poster-rating-number rating-"
                : "public-rating-pill rating-") + provider
            }
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
            {!asText && showBrand && (
              <span
                className="rating-brand"
                role="img"
                aria-label={label}
                style={{
                  maskImage: `url(/${provider === "anilist" ? "anilist" : "mal"}-logo.svg)`,
                  WebkitMaskImage: `url(/${provider === "anilist" ? "anilist" : "mal"}-logo.svg)`,
                }}
              />
            )}
            <Star size={12} fill="currentColor" />
            <b>{score.toFixed(1)}</b>
          </Tag>
        );
      })}
    </span>
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
