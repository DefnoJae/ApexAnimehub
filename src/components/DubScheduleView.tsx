import React, { useState, useEffect } from "react";
import { Search, Settings, Play, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { ScheduleEntry } from "../types/schedule";
import { getDisplayTitle, getShortTitle, formatAirTime, getDayOfWeek, getCurrentDateFormatted, isSameDay, getWeekStart, mondayOffset } from "../utils/schedule";
import { fetchDubSchedule, ScheduleResult } from "../utils/dubSchedule";
// FULL CALENDAR VIEW
interface FullCalendarViewProps {
  dubSchedule: ScheduleEntry[];
  onSelectMedia: (media: any, startEpisode?: number, startStream?: string | null) => void;
  onBack: () => void;
}

const FullCalendarView = ({ dubSchedule, onSelectMedia, onBack }: FullCalendarViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();
  const firstDay = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  );
  const firstDayOffset = mondayOffset(firstDay);

  const getDaysArray = (): (number | null)[] => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOffset; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getEntriesForDay = (day: number): ScheduleEntry[] => {
    if (!day) return [];
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    return dubSchedule.filter((entry: ScheduleEntry) =>
      isSameDay(new Date(entry.episodeDate), date)
    );
  };

  const days = getDaysArray();
  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="h-full flex flex-col pb-20">
      {/* TOP BAR */}
      <div className="sticky top-0 z-40 bg-[#121212]/95 backdrop-blur-md border-b border-purple-500/20 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-purple-600/20 rounded-full transition-all text-purple-400 hover:text-purple-300"
          >
            <ChevronLeft size={28} />
          </button>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            {monthName}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1
                  )
                )
              }
              className="p-2 hover:bg-purple-600/20 rounded-full transition-all text-slate-400 hover:text-white"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1
                  )
                )
              }
              className="p-2 hover:bg-purple-600/20 rounded-full transition-all text-slate-400 hover:text-white"
            >
              <ChevronRight size={24} />
            </button>
            <button className="p-2 hover:bg-purple-600/20 rounded-full transition-all text-slate-400 hover:text-white">
              <Settings size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* CALENDAR GRID */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-20">
        {/* DAY HEADERS */}
        <div className="grid grid-cols-7 gap-4 mb-4">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-slate-400 text-[12px] font-black uppercase tracking-widest"
            >
              {day}
            </div>
          ))}
        </div>

        {/* CALENDAR DAYS */}
        <div className="grid grid-cols-7 gap-4">
          {days.map((day, idx) => {
            const entries = day ? getEntriesForDay(day) : [];
            const isToday =
              day &&
              isSameDay(
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth(),
                  day
                ),
                new Date()
              );

            return (
              <div
                key={idx}
                className={`min-h-[280px] rounded-[16px] border-2 transition-all ${
                  day
                    ? `border-purple-500/30 bg-slate-800/30 hover:border-purple-400/60 hover:bg-slate-800/60 ${
                        isToday ? "border-purple-500/80 bg-purple-900/20" : ""
                      }`
                    : "border-transparent"
                } p-3 overflow-hidden`}
              >
                {day && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-[18px] font-black ${
                          isToday ? "text-purple-400" : "text-slate-400"
                        }`}
                      >
                        {day}
                      </span>
                      {entries.length > 0 && (
                        <span className="text-[10px] font-black bg-purple-600/60 text-purple-200 px-2 py-1 rounded">
                          {entries.length}
                        </span>
                      )}
                    </div>

                    {/* ENTRIES FOR THIS DAY */}
                    <div className="space-y-2 max-h-[230px] overflow-y-auto no-scrollbar">
                      {entries.slice(0, 4).map((entry, eIdx) => {
                        const totalEpisodes = entry.media?.media?.episodes;
                        const isFinale =
                          totalEpisodes &&
                          entry.episodeNumber === totalEpisodes;

                        return (
                          <div
                            key={eIdx}
                            onClick={() => onSelectMedia(entry.media?.media)}
                            className="group cursor-pointer"
                          >
                            <div className="relative w-full h-[60px] rounded-[12px] overflow-hidden border border-purple-500/30 hover:border-purple-400/60 group-hover:scale-105 transition-all">
                              <img
                                src={entry.media?.media?.coverImage?.extraLarge}
                                className="w-full h-full object-cover"
                                alt={getDisplayTitle(entry.media?.media)}
                              />
                              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent" />
                              <div className="absolute inset-0 flex items-center justify-between px-2 text-[9px]">
                                <span className="text-white font-black truncate line-clamp-1">
                                  {getShortTitle(entry.media?.media)}
                                </span>
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  {isFinale && (
                                    <span className="bg-emerald-600 text-white font-black px-1 rounded-[4px] text-[8px] uppercase tracking-wider">
                                      Finale
                                    </span>
                                  )}
                                  <span className="text-purple-300 font-black whitespace-nowrap">
                                    EP {entry.episodeNumber}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {entries.length > 4 && (
                        <div className="text-[10px] text-slate-500 font-black px-2">
                          + {entries.length - 4} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// RECTANGULAR WEEK OVERVIEW CARD
interface WeekOverviewCardProps {
  entry: ScheduleEntry;
  onSelect: (entry: ScheduleEntry) => void;
}

const WeekOverviewCard = ({ entry, onSelect }: WeekOverviewCardProps) => {
  const media = entry.media?.media;
  if (!media) return null;

  return (
    <div
      onClick={() => onSelect(entry)}
      className="group cursor-pointer relative"
    >
      <div className="relative h-[240px] rounded-[24px] overflow-hidden border-2 border-purple-500/40 hover:border-purple-400/80 transition-all duration-500 shadow-2xl bg-slate-900">
        {/* Background Image */}
        <img
          src={media.coverImage?.extraLarge}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
          alt={getDisplayTitle(media)}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex items-end p-5">
          <div className="w-full">
            {/* Left: Thumbnail + Info */}
            <div className="flex gap-4">
              {/* Small Thumbnail */}
              <div className="w-20 h-28 rounded-[16px] overflow-hidden flex-shrink-0 border border-purple-500/40">
                <img
                  src={media.coverImage?.extraLarge}
                  className="w-full h-full object-cover"
                  alt={getDisplayTitle(media)}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white text-[13px] font-black uppercase line-clamp-2 mb-2 leading-tight">
                  {getDisplayTitle(media)}
                </h3>

                <p className="text-slate-300 text-[11px] mb-2">
                  {media.title?.romaji}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <span className="text-slate-400 text-[10px] bg-slate-900/80 px-2 py-1 rounded font-black">
                      EP {entry.episodeNumber}
                    </span>
                    {entry.verified && (
                      <span className="text-purple-300 text-[10px] bg-purple-900/60 px-2 py-1 rounded font-black">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <span className="text-purple-300 text-[11px] font-black whitespace-nowrap">
                    {entry.timeOnly}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hover Play Button */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center rounded-[24px]">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
            <Play fill="white" size={24} className="ml-1 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};

// DUB SCHEDULE VIEW
interface DubScheduleViewProps {
  onSelectMedia: (media: any, startEpisode?: number, startStream?: string | null) => void;
}

export const DubScheduleView = ({ onSelectMedia }: DubScheduleViewProps) => {
  const [dubSchedule, setDubSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("weekly"); // 'weekly' or 'calendar'
  const [weekOffset, setWeekOffset] = useState(0);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleResult | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const loadSchedule = async () => {
      setLoading(true);
      const result = await fetchDubSchedule();
      if (!active) return;
      setScheduleStatus(result);
      const schedule = result.entries;

      const now = new Date();
      const ninetyDaysAhead = new Date(
        now.getTime() + 90 * 24 * 60 * 60 * 1000
      );
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const filtered = schedule
        .filter((entry) => {
          const airDate = new Date(entry.episodeDate);
          return airDate >= ninetyDaysAgo && airDate <= ninetyDaysAhead;
        })
        .map((entry) => ({
          ...entry,
          displayTime: formatAirTime(entry.episodeDate),
          timeOnly: new Date(entry.episodeDate).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          dayOfWeek: getDayOfWeek(entry.episodeDate),
        }))
        .sort(
          (a, b) =>
            new Date(a.episodeDate).getTime() -
            new Date(b.episodeDate).getTime()
        );

      setDubSchedule(filtered);
      setLoading(false);
    };

    loadSchedule();
    return () => { active = false; };
  }, [reload]);

  const filteredSchedule = dubSchedule.filter((entry) =>
    getDisplayTitle(entry.media?.media)
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // Get week start (Sunday) based on offset
  const today = new Date();
  let weekStart = getWeekStart(today);
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  // Get entries for the entire week (Sunday through Saturday)
  const weekEntries: { [key: string]: ScheduleEntry[] } = {
    SUNDAY: [],
    MONDAY: [],
    TUESDAY: [],
    WEDNESDAY: [],
    THURSDAY: [],
    FRIDAY: [],
    SATURDAY: [],
  };

  filteredSchedule.forEach((entry) => {
    const entryDate = new Date(entry.episodeDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    if (entryDate >= weekStart && entryDate < weekEnd) {
      weekEntries[entry.dayOfWeek].push(entry);
    }
  });

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const todayDateFormatted = getCurrentDateFormatted();
  const weekStartFormatted = weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-purple-500" />
      </div>
    );
  }

  const status = <div role="status" className="px-6 py-3 text-sm text-slate-400">
    {scheduleStatus?.error && <span>{scheduleStatus.error} {scheduleStatus.cached ? "Showing saved schedule. " : ""}</span>}
    {scheduleStatus?.updatedAt && <span>Last updated: {new Date(scheduleStatus.updatedAt).toLocaleString()} · Times are local. </span>}
    {!dubSchedule.length && <span>No schedule data available. </span>}
    <button className="text-purple-400 underline" onClick={() => setReload(n => n + 1)}>Refresh</button>
  </div>;

  if (viewMode === "calendar") {
    return (
      <>{status}<FullCalendarView
        dubSchedule={filteredSchedule}
        onSelectMedia={onSelectMedia}
        onBack={() => setViewMode("weekly")}
      /></>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar pb-20">
      {status}
      {/* TOP BAR */}
      <div className="sticky top-0 z-40 bg-[#121212]/95 backdrop-blur-md border-b border-purple-500/20 p-6 mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">
              {todayDateFormatted}
            </h2>
            <p className="text-purple-400 text-[10px] font-black uppercase tracking-[0.6em] mt-2">
              Today's Airings
            </p>
          </div>
          <div className="text-purple-300 text-sm font-bold">
            {currentTime}
          </div>
        </div>

        {/* FILTER & SORT */}
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3 bg-white/5 backdrop-blur-md px-6 py-3 rounded-[20px] border border-white/10">
            <Search size={18} className="text-purple-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none text-sm text-white placeholder-slate-500 w-full"
            />
          </div>

          <select
            value={viewMode === "weekly" ? "weekly" : "calendar"}
            onChange={(e) => {
              if (e.target.value === "calendar") {
                setViewMode("calendar");
              } else {
                setViewMode("weekly");
                setWeekOffset(e.target.value === "previous" ? -1 : 0);
              }
            }}
            className="px-6 py-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-[20px] text-slate-300 text-sm font-black uppercase outline-none cursor-pointer hover:border-purple-500/40 transition-all"
          >
            <option value="weekly">All Latest Episodes</option>
            <option value="previous">Previous Week</option>
            <option value="calendar">Full Calendar</option>
          </select>
        </div>

        {/* UPCOMING RELEASES */}
        {filteredSchedule.length > 0 && (
          <div className="mt-6 p-5 bg-purple-950/40 border border-purple-500/30 rounded-[16px]">
            <p className="text-purple-400 text-[10px] font-black uppercase tracking-[0.6em] mb-3">
              Upcoming Releases
            </p>
            <div className="space-y-1">
              {filteredSchedule
                .filter((entry) => {
                  const entryDate = new Date(entry.episodeDate);
                  return entryDate > today;
                })
                .slice(0, 2)
                .map((entry, idx) => (
                  <p key={idx} className="text-slate-300 text-sm">
                    <span className="text-purple-300 font-black">
                      NEXT WEEK - {entry.dayOfWeek}
                    </span>
                    <span className="text-slate-400 ml-2 text-[12px]">
                      {getDisplayTitle(entry.media?.media)} EP{" "}
                      {entry.episodeNumber}
                    </span>
                  </p>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* WEEK NAVIGATION */}
      <div className="px-6 mb-8 flex items-center gap-4">
        <button
          onClick={() => setWeekOffset(weekOffset - 1)}
          className="p-2 hover:bg-purple-600/20 rounded-full transition-all text-slate-400 hover:text-white"
        >
          <ChevronLeft size={24} />
        </button>
        <span className="text-slate-400 text-sm font-black">
          Week of {weekStartFormatted}
        </span>
        <button
          onClick={() => setWeekOffset(weekOffset + 1)}
          className="p-2 hover:bg-purple-600/20 rounded-full transition-all text-slate-400 hover:text-white"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* DAILY SECTIONS */}
      <div className="px-6 space-y-12 mb-20">
        {Object.entries(weekEntries).map(([day, entries]) => (
          <div key={day}>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.6em] mb-6">
              {day}
            </p>

            {entries.length > 0 ? (
              <div className="flex gap-6 overflow-x-auto no-scrollbar pb-6 scroll-smooth">
                {entries.map((entry, idx) => (
                  <div key={idx} className="min-w-[360px]">
                    <WeekOverviewCard
                      entry={entry}
                      onSelect={(e: ScheduleEntry) => {
                        onSelectMedia(e.media?.media);
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-sm font-black">
                No releases scheduled
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

