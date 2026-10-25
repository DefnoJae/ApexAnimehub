import React, { useEffect, useRef, useState } from "react";
import { AudioLines, Star } from "lucide-react";
import { getDubIndex, getMalScore } from "../utils/animeMetadata";
export function AnimeBadges({ idMal }: { idMal?: number | null }) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dub, setDub] = useState("");
  const [score, setScore] = useState<number | null>(null);
  useEffect(() => {
    if (!element.current) return;
    if (!window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    setDub("");
    setScore(null);
    if (visible && idMal) {
      void getDubIndex()
        .then((index) => {
          if (active)
            setDub(
              index.partial.includes(idMal)
                ? "PARTIAL DUB"
                : index.dubbed.includes(idMal)
                  ? "DUB"
                  : "",
            );
        })
        .catch(() => {});
      void getMalScore(idMal).then((value) => {
        if (active) setScore(value);
      });
    }
    return () => {
      active = false;
    };
  }, [idMal, visible]);
  return (
    <div ref={element} className="anime-badges">
      {dub && (
        <span
          title={
            dub === "DUB"
              ? "English dub available · MyDubList"
              : "Some episodes have an English dub · MyDubList"
          }
        >
          <AudioLines size={13} />
          {dub}
        </span>
      )}
      {score !== null && (
        <a
          href={"https://myanimelist.net/anime/" + idMal}
          target="_blank"
          rel="noreferrer"
          title="MyAnimeList rating via Jikan"
        >
          <Star size={12} />
          MAL {score.toFixed(2)}
        </a>
      )}
    </div>
  );
}
