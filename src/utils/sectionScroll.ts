export type ScrollSection = "discover" | "my-list";

const positions = new Map<ScrollSection, number>();

export function scrollSection(view: string): ScrollSection | null {
  return view === "discover" || view === "my-list" ? view : null;
}

export function rememberScroll(view: string, y: number): void {
  const section = scrollSection(view);
  if (section) positions.set(section, y);
}

export function takeScroll(view: ScrollSection): number {
  const y = positions.get(view) ?? 0;
  positions.delete(view);
  return y;
}

export function clearScroll(view: ScrollSection): void {
  positions.delete(view);
}
