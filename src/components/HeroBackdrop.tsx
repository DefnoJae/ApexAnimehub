import React, { useEffect, useState } from "react";
import {
  fetchHeroBackdrops,
  isHeroBackdrop,
  isHeroBanner,
} from "../utils/heroArtwork";
import type { DashboardAnime } from "./HomeDashboard";

export function HeroBackdrop({ anime }: { anime: DashboardAnime }) {
  const [artwork, setArtwork] = useState<{ id: number; urls: string[] } | null>(
    null,
  );
  const [index, setIndex] = useState(0),
    [accepted, setAccepted] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setIndex(0);
    setAccepted(null);
    void fetchHeroBackdrops(anime.id).then((urls) => {
      if (active) setArtwork({ id: anime.id, urls });
    });
    return () => {
      active = false;
    };
  }, [anime.id]);
  const candidates = [
    ...(artwork?.id === anime.id ? artwork.urls : []),
    ...(anime.bannerImage ? [anime.bannerImage] : []),
  ];
  // Wait for the provider's landscape choices before evaluating the old banner.
  const source = artwork?.id === anime.id ? candidates[index] : undefined;
  return (
    <div className="hero-artwork" aria-hidden="true">
      {artwork?.id === anime.id && !source && (
        <div className="hero-poster-fallback">
          <img src={anime.coverImage?.extraLarge} alt="" />
        </div>
      )}
      {source && (
        <img
          key={source}
          className="hero-backdrop"
          src={source}
          alt=""
          style={{ opacity: accepted === source ? 1 : 0 }}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (
              isHeroBackdrop(image.naturalWidth, image.naturalHeight) ||
              (source === anime.bannerImage &&
                isHeroBanner(image.naturalWidth, image.naturalHeight))
            )
              setAccepted(source);
            else setIndex((value) => value + 1);
          }}
          onError={() => setIndex((value) => value + 1)}
        />
      )}
    </div>
  );
}
