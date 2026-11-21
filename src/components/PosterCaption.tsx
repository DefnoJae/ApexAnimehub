import "./posterCaption.css";

export interface PosterMeta {
  year?: number | null;
  format?: string | null;
  episodes?: number | null;
}

export function posterMeta({ year, format, episodes }: PosterMeta): string {
  const parts: string[] = [
    typeof year === "number" && Number.isFinite(year) && year > 0
      ? String(year)
      : "TBA",
  ];
  const type = typeof format === "string" ? format.trim() : "";
  if (type) parts.push(type);
  if (Number.isSafeInteger(episodes) && Number(episodes) > 0)
    parts.push(`${episodes}eps`);
  return parts.join(" · ");
}

export interface PosterCaptionProps extends PosterMeta {
  title: string;
}

export function PosterCaption({
  title,
  year,
  format,
  episodes,
}: PosterCaptionProps) {
  return (
    <div className="poster-caption">
      <strong>{title}</strong>
      <small>{posterMeta({ year, format, episodes })}</small>
    </div>
  );
}
