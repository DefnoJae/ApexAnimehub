import { fetchAnilist } from "./anilist";
import type { DashboardAnime } from "../components/HomeDashboard";

export interface OrderAnime extends DashboardAnime {
  type?: string;
  format?: string;
  seasonYear?: number;
  startDate?: { year?: number; month?: number; day?: number };
  relations?: { edges: Array<{ relationType: string; node: OrderAnime }> };
}
export interface OrderEdge {
  from: number;
  to: number;
  relation: string;
}
export interface OrderGraph {
  nodes: OrderAnime[];
  edges: OrderEdge[];
  warning?: string;
}
const allowed = new Set([
  "SEQUEL",
  "PREQUEL",
  "SIDE_STORY",
  "PARENT",
  "SPIN_OFF",
  "ALTERNATIVE",
  "SUMMARY",
]);
const cache = new Map<number, { time: number; graph: OrderGraph }>();
const fields = `id idMal type title { english romaji } coverImage { extraLarge } format episodes seasonYear startDate { year month day }`;
const query = `query WatchOrder($ids: [Int]) { Page(page: 1, perPage: 40) { media(id_in: $ids, type: ANIME) { ${fields} relations { edges { relationType node { ${fields} } } } } } }`;
export const releaseTime = (node: OrderAnime) =>
  (node.startDate?.year || node.seasonYear || 9999) * 10000 +
  (node.startDate?.month || 1) * 100 +
  (node.startDate?.day || 1);

// Reverse inverse relations and deduplicate the two ends of every relationship.
export function orderEdges(nodes: OrderAnime[]): OrderEdge[] {
  const ids = new Set(nodes.map((node) => node.id));
  const edges = new Map<string, OrderEdge>();
  for (const node of nodes)
    for (const edge of node.relations?.edges || []) {
      if (
        !allowed.has(edge.relationType) ||
        !ids.has(edge.node.id) ||
        edge.node.id === node.id
      )
        continue;
      let from = node.id,
        to = edge.node.id,
        relation = edge.relationType;
      if (relation === "PREQUEL" || relation === "PARENT") {
        [from, to] = [to, from];
        relation = relation === "PREQUEL" ? "SEQUEL" : "SIDE_STORY";
      }
      if (relation === "ALTERNATIVE" && from > to) [from, to] = [to, from];
      const key = `${Math.min(from, to)}:${Math.max(from, to)}:${relation}`;
      edges.set(key, { from, to, relation });
    }
  return Array.from(edges.values());
}

export async function fetchWatchOrder(
  root: OrderAnime,
  signal: AbortSignal,
  refresh = false,
): Promise<OrderGraph> {
  const saved = cache.get(root.id);
  if (!refresh && saved && Date.now() - saved.time < 30 * 60 * 1000)
    return saved.graph;
  const nodes = new Map<number, OrderAnime>([[root.id, root]]);
  const fetched = new Set<number>();
  let warning = "";
  // Bound large franchises and batch relation traversal to protect AniList's quota.
  for (let round = 0; round < 8; round++) {
    if (signal.aborted)
      throw new DOMException("Request cancelled", "AbortError");
    const ids = Array.from(nodes.keys())
      .filter((id) => !fetched.has(id))
      .slice(0, 12);
    if (!ids.length) break;
    let media: OrderAnime[];
    try {
      const data = await fetchAnilist<{ Page: { media: OrderAnime[] } }>(
        query,
        { ids },
        signal,
      );
      media = data.Page.media;
    } catch (error) {
      if (signal.aborted) throw error;
      if (!fetched.size) throw error;
      warning =
        error instanceof Error
          ? error.message
          : "Some relationships could not load.";
      break;
    }
    ids.forEach((id) => fetched.add(id));
    for (const node of media) {
      if (!nodes.has(node.id)) continue;
      nodes.set(node.id, node);
      for (const edge of node.relations?.edges || []) {
        if (
          !allowed.has(edge.relationType) ||
          edge.node.type !== "ANIME" ||
          nodes.has(edge.node.id)
        )
          continue;
        if (nodes.size >= 40) {
          warning =
            "Showing the first 40 connected titles. Open a title to explore further.";
          continue;
        }
        nodes.set(edge.node.id, edge.node);
      }
    }
  }
  if (Array.from(nodes.keys()).some((id) => !fetched.has(id)) && !warning)
    warning =
      "Some further relationships have not loaded. Open a title to explore further.";
  const result: OrderGraph = {
    nodes: Array.from(nodes.values()).sort(
      (a, b) => releaseTime(a) - releaseTime(b) || a.id - b.id,
    ),
    edges: orderEdges(Array.from(nodes.values())),
    warning,
  };
  if (!warning) {
    if (cache.size >= 12) cache.delete(cache.keys().next().value as number);
    cache.set(root.id, { time: Date.now(), graph: result });
  }
  return result;
}
