import React, { useEffect, useRef, useState } from "react";
import { AudioLines } from "lucide-react";
import { RatingPills } from "./RatingPills";
import { getDubIndex } from "../utils/animeMetadata";
export function AnimeBadges({
  idMal,
  providedScore,
  id,
  averageScore,
}: {
  idMal?: number | null;
  id?: number;
  averageScore?: number | null;
  providedScore?: number | null;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dub, setDub] = useState("");

  useEffect(() => {
    if (!element.current) return;
    if (!window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    setDub("");

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
    }
    return () => {
      active = false;
    };
  }, [idMal, visible, providedScore]);
  return (
    <div ref={element} className="anime-badges">
      {providedScore !== null && (
        <RatingPills
          id={id}
          idMal={idMal}
          averageScore={averageScore}
          malScore={providedScore}
          active={visible}
        />
      )}
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
    </div>
  );
}
