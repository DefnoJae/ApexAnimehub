import React, { useEffect, useMemo, useRef, useState } from "react";
import { graphlib, layout } from "@dagrejs/dagre";
import { CheckCircle2, Maximize, Minus, Plus, X } from "lucide-react";
import { fetchWatchOrder, OrderAnime, OrderGraph } from "../utils/watchOrder";
import type { DashboardAnime } from "./HomeDashboard";
import type { useAccounts } from "../hooks/useAccounts";
import { sameAnime } from "../hooks/useLibrary";
import { getDisplayTitle } from "../utils/schedule";
import "./watchOrder.css";

const width = 260,
  height = 112;
export function graphLayout(data: OrderGraph) {
  const graph = new graphlib.Graph({ multigraph: true }).setGraph({
    rankdir: "LR",
    ranksep: 80,
    nodesep: 34,
    marginx: 24,
    marginy: 32,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  data.nodes.forEach((node) =>
    graph.setNode(String(node.id), { width, height }),
  );
  data.edges.forEach((edge, i) =>
    graph.setEdge(
      String(edge.from),
      String(edge.to),
      { width: 62, height: 16 },
      String(i),
    ),
  );
  layout(graph);
  return {
    width: graph.graph().width || width + 48,
    height: Math.max(220, graph.graph().height || height + 64),
    nodes: data.nodes.map((node) => ({ node, ...graph.node(String(node.id)) })),
    edges: data.edges.map((edge, i) => ({
      ...edge,
      ...(graph.edge({
        v: String(edge.from),
        w: String(edge.to),
        name: String(i),
      }) as { points: Array<{ x: number; y: number }>; x: number; y: number }),
    })),
  };
}

export default function WatchOrder({
  anime,
  accounts,
  onSelect,
  onClose,
}: {
  anime: OrderAnime;
  accounts: ReturnType<typeof useAccounts>;
  onSelect: (anime: DashboardAnime) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<OrderGraph | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const latestAnime = useRef(anime);
  latestAnime.current = anime;
  const drag = useRef<{ x: number; y: number; left: number; top: number }>();
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    void fetchWatchOrder(latestAnime.current, abort.signal, attempt > 0)
      .then((result) => {
        if (!abort.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (!abort.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Watch Order could not load.",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [anime.id, attempt]);
  const positions = useMemo(() => (data ? graphLayout(data) : null), [data]);
  useEffect(() => {
    const selected = positions?.nodes.find(({ node }) => node.id === anime.id);
    const element = viewport.current;
    if (!element || !selected) return;
    element.scrollLeft = Math.max(0, selected.x - element.clientWidth / 2);
    element.scrollTop = Math.max(0, selected.y - element.clientHeight / 2);
  }, [positions, anime.id]);
  const fit = () => {
    if (!positions || !viewport.current) return;
    setZoom(
      Math.max(
        0.2,
        Math.min(1, viewport.current.clientWidth / positions.width),
      ),
    );
    viewport.current.scrollTo?.({ left: 0, top: 0 });
  };
  return (
    <section
      className="watch-order glass"
      id="anime-watch-order"
      aria-label="Watch Order"
    >
      <header className="watch-order-heading">
        <div>
          <h2>Watch Order</h2>
          <p>Explore connected seasons and stories.</p>
        </div>
        <div className="watch-order-tools">
          <button
            onClick={fit}
            disabled={!positions}
            title="Fit graph to width"
            aria-label="Fit watch order graph"
          >
            <Maximize size={15} />
            <span>Fit view</span>
          </button>
          <button
            disabled={!positions || zoom <= 0.2}
            onClick={() => setZoom((value) => Math.max(0.2, value - 0.15))}
            aria-label="Zoom out watch order"
          >
            <Minus size={16} />
          </button>
          <button
            disabled={!positions || zoom >= 1.6}
            onClick={() => setZoom((value) => Math.min(1.6, value + 0.15))}
            aria-label="Zoom in watch order"
          >
            <Plus size={16} />
          </button>
          <button onClick={onClose} aria-label="Close watch order">
            <X size={17} />
          </button>
        </div>
      </header>
      {loading ? (
        <p className="watch-order-state" role="status">
          Loading connected anime…
        </p>
      ) : error ? (
        <div className="watch-order-state" role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : positions && data ? (
        <>
          {data.nodes.length === 1 && (
            <p className="watch-order-state">
              No connected anime titles were found on AniList.
            </p>
          )}
          <div
            ref={viewport}
            className="watch-order-viewport"
            role="region"
            aria-label="Anime relationship graph. Scroll or drag to explore; use Tab to select titles."
            tabIndex={0}
            onPointerDown={(event) => {
              if (
                event.button !== 0 ||
                (event.target as HTMLElement).closest("button")
              )
                return;
              const element = event.currentTarget;
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                left: element.scrollLeft,
                top: element.scrollTop,
              };
              element.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (drag.current) {
                event.currentTarget.scrollLeft =
                  drag.current.left - (event.clientX - drag.current.x);
                event.currentTarget.scrollTop =
                  drag.current.top - (event.clientY - drag.current.y);
              }
            }}
            onPointerUp={() => {
              drag.current = undefined;
            }}
            onPointerCancel={() => {
              drag.current = undefined;
            }}
          >
            <div
              style={{
                width: positions.width * zoom,
                height: positions.height * zoom,
                position: "relative",
              }}
            >
              <div
                className="watch-order-canvas"
                style={{
                  width: positions.width,
                  height: positions.height,
                  transform: `scale(${zoom})`,
                }}
              >
                <svg
                  width={positions.width}
                  height={positions.height}
                  className="watch-order-lines"
                  aria-hidden="true"
                >
                  <defs>
                    <marker
                      id={`order-arrow-${anime.id}`}
                      markerWidth="7"
                      markerHeight="7"
                      refX="6"
                      refY="3.5"
                      orient="auto"
                    >
                      <path d="M0,0 L7,3.5 L0,7" fill="#b58aff" />
                    </marker>
                  </defs>
                  {positions.edges.map((edge, index) => (
                    <g
                      key={index}
                      className={
                        edge.relation === "SEQUEL" ? "" : "order-side-edge"
                      }
                    >
                      <polyline
                        points={edge.points
                          .map(
                            (point: { x: number; y: number }) =>
                              `${point.x},${point.y}`,
                          )
                          .join(" ")}
                        fill="none"
                        stroke="#b58aff"
                        strokeWidth="1.5"
                        markerEnd={`url(#order-arrow-${anime.id})`}
                      />
                      <text
                        x={edge.x}
                        y={edge.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {edge.relation.replace(/_/g, " ").toLowerCase()}
                      </text>
                    </g>
                  ))}
                </svg>
                {positions.nodes.map(({ node, x, y }) => {
                  const entries = accounts.libraryEntries.filter((entry) =>
                    sameAnime(entry.anime, node),
                  );
                  const progress = Math.max(
                    0,
                    ...entries.map((entry) => entry.progress),
                  );
                  const completed = entries.some(
                    (entry) => entry.status === "completed",
                  );
                  const current = node.id === anime.id;
                  return (
                    <button
                      key={node.id}
                      className={`watch-order-node ${current ? "is-current" : ""}`}
                      style={{
                        left: x - width / 2,
                        top: y - height / 2,
                        width,
                        height,
                      }}
                      onClick={() => onSelect(node)}
                      aria-label={`Open ${getDisplayTitle(node)} details${current ? ", current title" : ""}`}
                      aria-current={current ? "true" : undefined}
                    >
                      {node.coverImage?.extraLarge ? (
                        <img
                          src={node.coverImage.extraLarge}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <span className="watch-order-poster-placeholder" />
                      )}
                      <span className="watch-order-node-copy">
                        <strong>{getDisplayTitle(node)}</strong>
                        <small>
                          {node.startDate?.year || node.seasonYear || "TBA"} ·{" "}
                          {node.format?.replace(/_/g, " ") || "Anime"} ·{" "}
                          {node.episodes
                            ? `${node.episodes} eps`
                            : "Episodes TBA"}
                        </small>
                        {current && (
                          <span className="watch-order-current">
                            Current title
                          </span>
                        )}
                        {entries.length ? (
                          <span
                            className={
                              completed
                                ? "watch-order-completed"
                                : "watch-order-progress"
                            }
                          >
                            {completed && <CheckCircle2 size={12} />}{" "}
                            {completed ? "Completed" : "Watched"}{" "}
                            {Math.min(node.episodes || Infinity, progress)}
                            {node.episodes ? `/${node.episodes}` : " episodes"}
                          </span>
                        ) : (
                          <span className="watch-order-unsaved">
                            Not in your lists
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {data.warning && (
            <p className="watch-order-warning" role="status">
              {data.warning}{" "}
              <button onClick={() => setAttempt((value) => value + 1)}>
                Retry
              </button>
            </p>
          )}
        </>
      ) : null}
      <footer>
        Relationships from AniList · Click a poster to open details.{" "}
        <span>
          Connections show relationships, not a definitive chronological viewing
          order.
        </span>
      </footer>
    </section>
  );
}
