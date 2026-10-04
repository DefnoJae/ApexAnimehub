import React from "react";
import { Play } from "lucide-react";
import { getDisplayTitle } from "../utils/schedule";
interface RowAnime { id: number; title: { english?: string; romaji?: string }; coverImage?: { extraLarge?: string } }
interface AnimeRowProps {
  title: string;
  animes: RowAnime[];
  onSelect: (anime: RowAnime) => void;
}

export const AnimeRow = ({ title, animes, onSelect }: AnimeRowProps) => {
  if (!animes || animes.length === 0) return null;
  return (
    <div className="mb-16 animate-fade-in px-12">
      <h2 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.7em] mb-8 flex items-center gap-4">
        <div className="w-12 h-[1px] bg-purple-500/40"></div> {title}
      </h2>
      <div className="flex gap-8 overflow-x-auto no-scrollbar pb-6 px-2 scroll-smooth">
        {animes.map((a: RowAnime, idx: number) => (
          <div
            key={a.id || idx}
            onClick={() => onSelect(a)}
            className="min-w-[220px] cursor-pointer group"
          >
            <div className="aspect-[2/3] rounded-[48px] overflow-hidden border border-white/5 group-hover:border-purple-500/50 transition-all duration-700 shadow-2xl bg-zinc-900 relative">
              <img
                src={a.coverImage?.extraLarge}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                alt={getDisplayTitle(a)}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-purple-950/80 via-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-[1px]">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                  <Play fill="black" size={28} className="ml-1" />
                </div>
              </div>
            </div>
            <p className="mt-6 text-[12px] font-black truncate text-zinc-400 group-hover:text-white uppercase italic tracking-tighter transition-colors">
              {getDisplayTitle(a)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

