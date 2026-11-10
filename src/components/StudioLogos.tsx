import React, { useEffect, useState } from "react";
export interface AnimeStudio {
  id: number;
  name: string;
  isAnimationStudio: boolean;
}
const logos = new Map<number, { url: string | null; expires: number }>();
function StudioLogo({
  studio,
  onSelect,
}: {
  studio: AnimeStudio;
  onSelect?: (id: number, name: string) => void;
}) {
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => {
    setLogo(null);
    const cached = logos.get(studio.id);
    if (cached && cached.expires > Date.now()) {
      setLogo(cached.url);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/studio-logo?id=${studio.id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const url =
          data.id === studio.id &&
          typeof data.logo === "string" &&
          /^https:\/\/image\.tmdb\.org\/t\/p\/original\/[A-Za-z0-9_.-]+$/.test(
            data.logo,
          )
            ? data.logo
            : null;
        if (logos.size >= 200)
          logos.delete(logos.keys().next().value as number);
        logos.set(studio.id, {
          url,
          expires: Date.now() + (url ? 21600000 : 900000),
        });
        setLogo(url);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [studio.id]);
  const href = `/discover?studio=${studio.id}&studioName=${encodeURIComponent(studio.name)}`;
  return (
    <a
      className="detail-studio-logo"
      href={href}
      title={`Explore anime by ${studio.name}`}
      aria-label={`Explore anime by ${studio.name}`}
      onClick={(event) => {
        if (
          onSelect &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.button === 0
        ) {
          event.preventDefault();
          onSelect(studio.id, studio.name);
        }
      }}
    >
      {logo ? (
        <img src={logo} alt={studio.name} onError={() => setLogo(null)} />
      ) : (
        <span>{studio.name}</span>
      )}
    </a>
  );
}
export function StudioLogos({
  studios,
  onSelect,
}: {
  studios: AnimeStudio[];
  onSelect?: (id: number, name: string) => void;
}) {
  const animation = Array.from(
    new Map(
      studios
        .filter(
          (studio) =>
            studio.isAnimationStudio &&
            Number.isSafeInteger(studio.id) &&
            studio.id > 0,
        )
        .map((studio) => [studio.id, studio]),
    ).values(),
  );
  return (
    <>
      {animation.map((studio) => (
        <StudioLogo key={studio.id} studio={studio} onSelect={onSelect} />
      ))}
    </>
  );
}
