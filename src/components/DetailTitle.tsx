import React, { useEffect, useState } from "react";
import { fetchHeroArtwork, isTitleTreatment } from "../utils/heroArtwork";
export function DetailTitle({ id, title }: { id: number; title: string }) {
  const [art, setArt] = useState<{ id: number; urls: string[] }>({
    id: 0,
    urls: [],
  });
  const [index, setIndex] = useState(0),
    [loaded, setLoaded] = useState("");
  useEffect(() => {
    let active = true;
    setIndex(0);
    setLoaded("");
    void fetchHeroArtwork(id).then((urls) => {
      if (active) setArt({ id, urls });
    });
    return () => {
      active = false;
    };
  }, [id]);
  const url = art.id === id ? art.urls[index] : undefined;
  return (
    <h1 className="detail-title" aria-label={title} title={title}>
      {(!url || loaded !== url) && title}
      {url && (
        <img
          className="detail-title-logo"
          src={url}
          alt={title}
          style={{ display: loaded === url ? "block" : "none" }}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (isTitleTreatment(image.naturalWidth, image.naturalHeight))
              setLoaded(url);
            else setIndex((value) => value + 1);
          }}
          onError={() => setIndex((value) => value + 1)}
        />
      )}
    </h1>
  );
}
