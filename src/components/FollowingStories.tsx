import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Pause, Play, Star, X } from "lucide-react";
import {
  activityAge,
  activityLabel,
  fetchFollowingStories,
  readSeenStories,
  StoryActivity,
  StoryGroup,
} from "../utils/followingStories";
import { getDisplayTitle } from "../utils/schedule";
import "./followingStories.css";
function Avatar({ user }: { user: StoryGroup["user"] }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="story-avatar">
      {user.avatar && !failed ? (
        <img src={user.avatar} alt="" onError={() => setFailed(true)} />
      ) : (
        user.name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
export function FollowingStories({
  identity,
  connected,
  checking = false,
  onConnect,
}: {
  identity?: string;
  connected: boolean;
  checking?: boolean;
  onConnect: () => void;
}) {
  const [open, setOpen] = useState(false),
    [groups, setGroups] = useState<StoryGroup[]>([]),
    [scope, setScope] = useState("");
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [warning, setWarning] = useState(""),
    [retry, setRetry] = useState(0),
    [seen, setSeen] = useState<number[]>([]);
  const trigger = useRef<HTMLButtonElement>(null);
  const valid = connected && !!identity && scope === identity;
  useEffect(() => {
    setOpen(false);
    setGroups([]);
    setScope("");
    setSeen(identity ? readSeenStories(identity) : []);
  }, [identity, connected]);
  useEffect(() => {
    if (!connected || !identity || checking) return;
    let active = true;
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 35000);
    setLoading(true);
    setError("");
    void fetchFollowingStories(identity, controller.signal, retry > 0)
      .then((result) => {
        if (active && !controller.signal.aborted) {
          setGroups(result.groups);
          setScope(identity);
          setWarning(result.warning || "");
        }
      })
      .catch((reason) => {
        if (active && !controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load following activity.",
          );
        else if (active && reason?.name === "AbortError")
          setError("Following activity took too long to load. Please retry.");
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [identity, connected, checking, retry]);
  useEffect(() => {
    if (open) return;
    const timer = setInterval(() => setRetry((value) => value + 1), 300000);
    return () => clearInterval(timer);
  }, [open]);
  const activeGroups = valid ? groups : [];
  const fresh = activeGroups.some((group) =>
    group.activities.some((activity) => !seen.includes(activity.id)),
  );
  const markSeen = (id: number) =>
    setSeen((previous) => {
      if (previous.includes(id)) return previous;
      const next = [...previous, id].slice(-500);
      try {
        localStorage.setItem(
          "apex_stories_seen_v1_" + identity,
          JSON.stringify(next),
        );
      } catch {}
      return next;
    });
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={"following-stories-trigger" + (fresh ? " has-new" : "")}
        aria-label={
          fresh ? "Following activity, new stories" : "Following activity"
        }
        title="View recent activity from people you follow"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeDasharray="12 4"
          />
          <circle
            cx="24"
            cy="24"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".3"
            strokeWidth="1"
          />
        </svg>
      </button>
      {open &&
        createPortal(
          <StoryViewer
            key={identity || "signed-out"}
            groups={activeGroups}
            seen={seen}
            onSeen={markSeen}
            loading={loading || checking || (connected && !identity)}
            error={error}
            warning={warning}
            connected={connected}
            reload={() => {
              setOpen(false);
              setRetry((value) => value + 1);
            }}
            onConnect={() => {
              setOpen(false);
              onConnect();
            }}
            onClose={() => {
              setOpen(false);
              window.setTimeout(() => trigger.current?.focus(), 0);
            }}
          />,
          document.body,
        )}
    </>
  );
}
export function StoryViewer({
  groups,
  seen,
  onSeen,
  loading,
  error,
  warning,
  connected,
  reload,
  onConnect,
  onClose,
}: {
  groups: StoryGroup[];
  seen: number[];
  onSeen: (id: number) => void;
  loading: boolean;
  error: string;
  warning: string;
  connected: boolean;
  reload: () => void;
  onConnect: () => void;
  onClose: () => void;
}) {
  const [userIndex, setUserIndex] = useState(() =>
      Math.max(
        0,
        groups.findIndex((group) =>
          group.activities.some((activity) => !seen.includes(activity.id)),
        ),
      ),
    ),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hidden, setHidden] = useState(document.hidden),
    [elapsed, setElapsed] = useState(0),
    [ended, setEnded] = useState(false);
  const dialog = useRef<HTMLDivElement>(null),
    closeButton = useRef<HTMLButtonElement>(null);
  const group = groups[userIndex],
    activity = group?.activities[index];
  const advance = (direction: number) => {
    setEnded(false);
    if (direction > 0) {
      if (group && index + 1 < group.activities.length) setIndex(index + 1);
      else if (userIndex + 1 < groups.length) {
        setUserIndex(userIndex + 1);
        setIndex(0);
      } else {
        setEnded(true);
        setPaused(true);
      }
    } else if (index > 0) setIndex(index - 1);
    else if (userIndex > 0) {
      setUserIndex(userIndex - 1);
      setIndex(groups[userIndex - 1].activities.length - 1);
    }
  };
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const seenCallback = useRef(onSeen);
  seenCallback.current = onSeen;
  useEffect(() => {
    setElapsed(0);
    setEnded(false);
    if (activity) seenCallback.current(activity.id);
  }, [activity?.id]);
  useEffect(() => {
    if (!activity || paused || hidden || ended) return;
    let previous = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(now - previous, 250);
      setElapsed((value) => Math.min(6000, value + delta));
      previous = now;
    }, 50);
    return () => clearInterval(timer);
  }, [activity?.id, paused, hidden, ended]);
  useEffect(() => {
    if (elapsed >= 6000 && !ended) advanceRef.current(1);
  }, [elapsed, ended]);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    const root = document.getElementById("root"),
      wasInert = root?.hasAttribute("inert");
    root?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      if (!wasInert) root?.removeAttribute("inert");
    };
  }, []);
  const keyboardRef = useRef({ onClose, paused });
  keyboardRef.current = { onClose, paused };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        keyboardRef.current.onClose();
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        advanceRef.current(event.key === "ArrowRight" ? 1 : -1);
      }
      if (
        event.key === " " &&
        !(event.target as HTMLElement)?.closest("button,a")
      ) {
        event.preventDefault();
        setPaused((value) => !value);
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href]",
          ) || [],
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => document.removeEventListener("keydown", keyboard, true);
  }, []);
  const choose = (next: number) => {
    setUserIndex(next);
    setIndex(0);
    setElapsed(0);
    setEnded(false);
    setPaused(false);
  };
  return (
    <div
      ref={dialog}
      className="following-story-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Following Activity"
      tabIndex={-1}
    >
      <header className="following-story-heading">
        <div>
          <h2>Following Activity</h2>
          <p>
            {groups.length} {groups.length === 1 ? "person" : "people"} · Recent
            anime activity
          </p>
        </div>
        <button
          ref={closeButton}
          aria-label="Close following activity"
          onClick={onClose}
        >
          <X size={25} />
        </button>
      </header>
      {!connected ? (
        <div className="story-state">
          <h3>Connect AniList</h3>
          <p>See recent anime activity from people you follow.</p>
          <button onClick={onConnect}>Manage accounts</button>
        </div>
      ) : loading && !groups.length ? (
        <p className="story-state" role="status">
          Loading following activity…
        </p>
      ) : error && !groups.length ? (
        <div className="story-state" role="alert">
          <p>{error}</p>
          <button onClick={reload}>Retry</button>
        </div>
      ) : !activity ? (
        <div className="story-state">
          <h3>No recent anime activity</h3>
          <p>
            New list updates from people you follow will appear here. Showing
            the latest 50 updates from the past seven days.
          </p>
          <button onClick={reload}>Refresh activity</button>
        </div>
      ) : (
        <>
          <div className="story-people" aria-label="People you follow">
            {groups.map((item, i) => (
              <button
                key={item.user.id}
                className={i === userIndex ? "is-active" : ""}
                aria-label={"Show stories from " + item.user.name}
                aria-pressed={i === userIndex}
                onClick={() => choose(i)}
              >
                <Avatar user={item.user} />
                <strong>{item.user.name}</strong>
                <small>
                  {activityAge(
                    item.activities[item.activities.length - 1].createdAt,
                  )}
                </small>
              </button>
            ))}
          </div>
          <div className="story-stage">
            <button
              className="story-arrow story-previous"
              aria-label="Previous activity"
              disabled={userIndex === 0 && index === 0}
              onClick={() => advance(-1)}
            >
              <ChevronLeft />
            </button>
            <article className="following-story-card" key={activity.id}>
              <div className="story-progress" aria-label="Activity progress">
                {group.activities.map((item, i) => (
                  <span key={item.id}>
                    <i
                      style={{
                        transform: `scaleX(${i < index ? 1 : i === index ? elapsed / 6000 : 0})`,
                      }}
                    />
                  </span>
                ))}
              </div>
              <header>
                <a
                  href={"https://anilist.co/user/" + group.user.id}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Avatar user={group.user} />
                  <span>
                    <strong>{group.user.name}</strong>
                    <time
                      dateTime={new Date(
                        activity.createdAt * 1000,
                      ).toISOString()}
                      title={new Date(
                        activity.createdAt * 1000,
                      ).toLocaleString()}
                    >
                      {activityAge(activity.createdAt)}
                    </time>
                  </span>
                </a>
                <button
                  aria-label={paused ? "Resume stories" : "Pause stories"}
                  onClick={() => {
                    if (ended) {
                      setElapsed(0);
                      setEnded(false);
                    }
                    setPaused((value) => !value);
                  }}
                >
                  {paused ? <Play size={18} /> : <Pause size={18} />}
                </button>
              </header>
              <StoryArtwork activity={activity} />
              <div className="story-anime-copy">
                <p>{activityLabel(activity)}</p>
                <h3>{getDisplayTitle(activity.anime)}</h3>
                {activity.score !== undefined && (
                  <span className="story-score">
                    <Star size={15} /> {activity.score}/10{" "}
                    <small>Current list rating</small>
                  </span>
                )}
                {ended && (
                  <small className="story-ended">You're all caught up</small>
                )}
              </div>
            </article>
            <button
              className="story-arrow story-next"
              aria-label="Next activity"
              disabled={ended}
              onClick={() => advance(1)}
            >
              <ChevronRight />
            </button>
            <aside className="story-previews" aria-label="More followed users">
              {groups.slice(userIndex + 1, userIndex + 3).map((item, i) => (
                <button
                  key={item.user.id}
                  aria-label={"Preview stories from " + item.user.name}
                  onClick={() => choose(userIndex + i + 1)}
                >
                  <StoryArtwork activity={item.activities[0]} />
                  <span>
                    <Avatar user={item.user} />
                    <strong>{item.user.name}</strong>
                    <small>{activityLabel(item.activities[0])}</small>
                  </span>
                </button>
              ))}
            </aside>
          </div>
          {(warning || error) && (
            <p className="story-warning" role="status">
              {warning || error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
function StoryArtwork({ activity }: { activity: StoryActivity }) {
  const [failed, setFailed] = useState(false),
    url = activity.anime.coverImage?.extraLarge || activity.anime.bannerImage;
  return url && !failed ? (
    <img
      className="story-artwork"
      src={url}
      alt={getDisplayTitle(activity.anime)}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="story-artwork story-artwork-fallback">
      {getDisplayTitle(activity.anime)}
    </div>
  );
}
