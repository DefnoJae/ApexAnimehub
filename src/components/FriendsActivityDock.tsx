import React, { useEffect, useRef, useState } from "react";
import { Users, ChevronLeft, Star } from "lucide-react";
import {
  fetchFriendsActivity,
  FriendActivity,
  friendStatuses,
} from "../utils/friendsActivity";
import "./friendsActivityDock.css";
function Avatar({ friend }: { friend: FriendActivity }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="friends-avatar">
      {friend.avatar && !failed ? (
        <img src={friend.avatar} alt="" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{friend.name.slice(0, 2).toUpperCase()}</span>
      )}
      <i style={{ background: friendStatuses[friend.status].color }} />
    </span>
  );
}
export function FriendsActivityDock({
  animeId,
  identity,
  connected,
  checking = false,
}: {
  animeId: number;
  identity?: string;
  connected: boolean;
  checking?: boolean;
}) {
  const [rows, setRows] = useState<FriendActivity[]>([]),
    [next, setNext] = useState<number | null>(null),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false),
    [pinned, setPinned] = useState(false);
  const touchInput = useRef(false);
  const scope = identity + ":" + animeId;
  const [loadedScope, setLoadedScope] = useState("");
  const activePage = loadedScope === scope ? page : 1;
  const expanded = hover || focus || pinned;
  useEffect(() => {
    setPage(1);
    setRows([]);
    setNext(null);
    setPinned(false);
    setHover(false);
    setFocus(false);
  }, [scope, connected]);
  useEffect(() => {
    if (
      !connected ||
      !identity ||
      checking ||
      animeId <= 0 ||
      (page !== 1 && loadedScope !== scope)
    )
      return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let active = true;
    setLoading(true);
    setError("");
    void fetchFriendsActivity(animeId, identity, activePage, controller.signal)
      .then((result) => {
        if (!active) return;
        setRows((previous) =>
          Array.from(
            new Map(
              (page === 1
                ? result.friends
                : [...previous, ...result.friends]
              ).map((friend) => [friend.id, friend]),
            ).values(),
          ),
        );
        setNext(result.nextPage);
        setLoadedScope(scope);
      })
      .catch(() => {
        if (active) {
          setError("Following activity is unavailable. Please retry.");
          setLoadedScope(scope);
        }
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [animeId, identity, connected, checking, activePage, retry, scope]);
  if (!connected || checking || !identity) return null;
  const visible = loadedScope === scope ? rows : [];
  if (!loading && !error && loadedScope === scope && !visible.length)
    return null;
  return (
    <aside
      className={"friends-dock" + (expanded ? " is-expanded" : "")}
      aria-label="Friends activity"
      onPointerDownCapture={(event) => {
        touchInput.current =
          event.pointerType === "touch" || event.pointerType === "pen";
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHover(true);
      }}
      onPointerLeave={() => setHover(false)}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setFocus(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setPinned(false);
          setHover(false);
          setFocus(false);
          event.stopPropagation();
        }
      }}
    >
      <button
        className="friends-dock-toggle"
        aria-label="Toggle following activity"
        aria-expanded={expanded}
        aria-controls="friends-dock-content"
        onClick={() => {
          if (pinned) {
            setPinned(false);
            setHover(false);
            setFocus(false);
          } else setPinned(true);
        }}
      >
        <Users size={18} />
        <span>Following</span>
        <ChevronLeft size={15} />
      </button>
      <div id="friends-dock-content" className="friends-dock-content">
        {visible.map((friend) => {
          const status = friendStatuses[friend.status];
          return (
            <a
              className="friends-dock-row"
              key={friend.id}
              href={
                "https://anilist.co/user/" + encodeURIComponent(friend.name)
              }
              onClick={(event) => {
                if (touchInput.current && !pinned) {
                  event.preventDefault();
                  setPinned(true);
                }
              }}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={
                friend.name + ": " + status.label + ", open AniList profile"
              }
              style={{ "--friend-color": status.color } as React.CSSProperties}
            >
              <Avatar friend={friend} />
              <span className="friends-dock-info">
                <strong>{friend.name}</strong>
                <span>
                  {friend.progress > 0 && (
                    <span>
                      Ep {friend.progress}
                      {friend.total ? "/" + friend.total : ""}
                    </span>
                  )}
                  {friend.score !== undefined && (
                    <span className="friends-score">
                      <Star size={12} fill="currentColor" />
                      {friend.score}
                    </span>
                  )}
                  {friend.repeat && (
                    <span
                      className="friends-repeat"
                      title={"Rewatched " + friend.repeat + " times"}
                    >
                      ↻ {friend.repeat}
                    </span>
                  )}
                </span>
              </span>
              <span className="friends-status">{status.label}</span>
            </a>
          );
        })}
        {loading && (
          <p role="status" className="friends-dock-message">
            Loading following activity…
          </p>
        )}
        {error && (
          <p role="status" className="friends-dock-message">
            {error}
            <button onClick={() => setRetry((value) => value + 1)}>
              Retry
            </button>
          </p>
        )}
        {!loading && next && !error && (
          <button className="friends-view-more" onClick={() => setPage(next)}>
            View more
          </button>
        )}
      </div>
    </aside>
  );
}
