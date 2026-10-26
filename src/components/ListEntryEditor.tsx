import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, X } from "lucide-react";
import type {
  AccountProvider,
  ListAnime,
  useAccounts,
} from "../hooks/useAccounts";
import { sameAnime } from "../hooks/useLibrary";
type Accounts = ReturnType<typeof useAccounts>;
const providers: AccountProvider[] = ["anilist", "mal"];
const label = (provider: AccountProvider) =>
  provider === "mal" ? "MyAnimeList" : "AniList";
export function ListEntryEditor({
  anime,
  accounts,
  onConnect,
}: {
  anime: ListAnime;
  accounts: Accounts;
  onConnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const entries = accounts.libraryEntries.filter((entry) =>
    sameAnime(entry.anime, anime),
  );
  const progress = Math.max(0, ...entries.map((entry) => entry.progress));
  return (
    <>
      <button
        ref={trigger}
        className="detail-entry-edit glass"
        aria-label="Edit watched episodes and personal scores"
        title="Edit watched progress and your scores"
        onClick={() => {
          if (!providers.some((p) => accounts.connected[p])) {
            onConnect();
            return;
          }
          setOpen(true);
        }}
      >
        <span>
          {progress}/{anime.episodes || "?"}
        </span>
        <Pencil size={15} />
      </button>
      {entries
        .filter((entry) => entry.score !== undefined && entry.score > 0)
        .map((entry) => (
          <span key={entry.provider} className="detail-personal-score">
            Your {entry.provider === "mal" ? "MAL" : "AniList"}: {entry.score}
            /10
          </span>
        ))}
      {open && (
        <EntryDialog
          anime={anime}
          accounts={accounts}
          onClose={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        />
      )}
    </>
  );
}
function EntryDialog({
  anime,
  accounts,
  onClose,
}: {
  anime: ListAnime;
  accounts: Accounts;
  onClose: () => void;
}) {
  const entries = accounts.libraryEntries.filter((entry) =>
    sameAnime(entry.anime, anime),
  );
  const enabled = providers.filter((p) => accounts.connected[p]);
  const [progress, setProgress] = useState(
    String(Math.max(0, ...entries.map((entry) => entry.progress))),
  );
  const [scores, setScores] = useState<
    Partial<Record<AccountProvider, string>>
  >(() =>
    Object.fromEntries(
      entries.map((entry) => [
        entry.provider,
        entry.score ? String(entry.score) : "",
      ]),
    ),
  );
  const [errors, setErrors] = useState<
    Partial<Record<AccountProvider, string>>
  >({});
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState(0);
  const dirty = useRef({ progress: false, scores: new Set<AccountProvider>() });
  const panel = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("input")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    setErrors({});
    void Promise.allSettled(
      enabled.map(async (provider) => {
        const id = provider === "mal" ? anime.idMal : anime.id;
        if (!id)
          throw new Error(
            "This anime has no confirmed " + label(provider) + " ID.",
          );
        const response = await fetch(
          "/api/list/" + provider + "?animeId=" + id,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load your entry");
        if (
          data.entry &&
          (!Number.isSafeInteger(data.entry.progress) ||
            typeof data.entry.score !== "number")
        )
          throw new Error("Invalid account entry");
        return { provider, entry: data.entry };
      }),
    )
      .then((results) => {
        if (disposed) return;
        const counts: number[] = [];
        results.forEach((result, i) => {
          const provider = enabled[i];
          if (result.status === "fulfilled") {
            const entry = result.value.entry;
            counts.push(entry?.progress || 0);
            if (entry)
              accounts.record(provider, anime, entry.status, entry.progress, {
                score: entry.score,
                manualProgress: true,
              });
            if (!dirty.current.scores.has(provider))
              setScores((previous) => ({
                ...previous,
                [provider]: entry?.score ? String(entry.score) : "",
              }));
          } else {
            counts.push(
              entries.find((entry) => entry.provider === provider)?.progress ||
                0,
            );
            setErrors((previous) => ({
              ...previous,
              [provider]:
                result.reason instanceof Error
                  ? result.reason.message
                  : "Could not refresh this entry",
            }));
          }
        });
        if (!dirty.current.progress)
          setProgress(String(Math.max(0, ...counts)));
      })
      .finally(() => {
        clearTimeout(timer);
        if (!disposed) setLoading(false);
      });
    let disposed = false;
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [anime.id, anime.idMal, retry]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    const count = Number(progress);
    if (
      !progress.trim() ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      (anime.episodes && count > anime.episodes)
    ) {
      setNotice("Enter a valid watched episode count.");
      return;
    }
    const changes: Partial<Record<AccountProvider, number>> = {};
    for (const provider of enabled) {
      if (!dirty.current.scores.has(provider) || !scores[provider]?.trim())
        continue;
      const score = Number(scores[provider]);
      if (
        !Number.isFinite(score) ||
        score < 0 ||
        score > 10 ||
        (provider === "mal"
          ? !Number.isInteger(score)
          : Math.abs(score * 10 - Math.round(score * 10)) > 1e-8)
      ) {
        setNotice(
          label(provider) +
            ": use " +
            (provider === "mal" ? "whole numbers" : "up to one decimal place") +
            " from 0 to 10.",
        );
        return;
      }
      changes[provider] = score;
    }
    if (!dirty.current.progress && !Object.keys(changes).length) {
      setNotice("No changes to save.");
      return;
    }
    setSaving(true);
    try {
      const results = await accounts.sync(
        anime,
        accounts.getListStatus(anime) || "planning",
        dirty.current.progress ? count : undefined,
        false,
        { manualProgress: dirty.current.progress, scores: changes },
      );
      if (results.length && results.every((result) => result.success))
        onClose();
      else
        setNotice(
          results
            .map(
              (result) =>
                label(result.provider) +
                ": " +
                (result.success ? "Saved" : result.error),
            )
            .join("\n") || "Connect an account before saving.",
        );
    } finally {
      setSaving(false);
    }
  };
  return createPortal(
    <div
      className="entry-editor-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Edit watched progress and scores"
        className="entry-editor glass"
        onSubmit={save}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Tab") {
            const fields = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                "input, button:not(:disabled)",
              ),
            );
            const first = fields[0],
              last = fields[fields.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>Edit your entry</h2>
          <button
            type="button"
            aria-label="Close entry editor"
            disabled={saving}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <label>
          Episodes watched <span>of {anime.episodes || "?"}</span>
          <input
            aria-label="Episodes watched"
            type="number"
            min="0"
            max={anime.episodes || 100000}
            step="1"
            value={progress}
            onChange={(event) => {
              dirty.current.progress = true;
              setProgress(event.target.value);
            }}
          />
        </label>
        {enabled.map((provider) => (
          <label key={provider}>
            {label(provider)} score /10{" "}
            <small>
              {provider === "mal" ? "Whole numbers" : "One decimal allowed"}
            </small>
            <input
              aria-label={label(provider) + " personal score"}
              type="number"
              min="0"
              max="10"
              step={provider === "mal" ? "1" : "0.1"}
              placeholder="Unrated"
              value={scores[provider] || ""}
              onChange={(event) => {
                dirty.current.scores.add(provider);
                setScores((previous) => ({
                  ...previous,
                  [provider]: event.target.value,
                }));
              }}
            />
          </label>
        ))}
        <p>
          Blank scores stay unchanged. Enter 0 to clear a score. Manual episode
          edits can increase or decrease your count.
        </p>
        {loading && <p role="status">Refreshing your saved scores…</p>}
        {Object.entries(errors).map(([provider, error]) => (
          <p role="alert" key={provider}>
            {label(provider as AccountProvider)}: {error} Existing imported
            values are shown where available.
          </p>
        ))}
        {Object.keys(errors).length > 0 && (
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            disabled={loading}
          >
            Refresh saved values
          </button>
        )}
        {notice && (
          <p role="alert" className="entry-save-notice">
            {notice}
          </p>
        )}
        <button
          className="entry-save"
          disabled={loading || saving || accounts.busy}
          type="submit"
        >
          {saving ? "Saving…" : "Save to connected lists"}
        </button>
      </form>
    </div>,
    document.body,
  );
}
