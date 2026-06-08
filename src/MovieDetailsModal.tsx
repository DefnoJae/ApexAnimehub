import React from "react";
import Modal from "react-modal";
import { X, Play, Plus, Star } from "lucide-react";

interface MovieDetailsModalProps {
  movie: any;
  isOpen: boolean;
  onRequestClose: () => void;
  onWatch: () => void;
}

const MovieDetailsModal = ({
  movie,
  isOpen,
  onRequestClose,
  onWatch,
}: MovieDetailsModalProps) => {
  if (!movie) return null;

  // Title Logic: Checks TMDb title/name, then falls back to MAL titles
  const title =
    movie.title ||
    movie.name ||
    movie.title_english ||
    movie.title_japanese ||
    "Untitled";

  // Image Logic: Checks TMDb backdrop first, then falls back to Jikan/MAL poster
  const imageUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : movie.images?.jpg?.large_image_url;

  // Info Logic: Handles both TMDb and MAL (Jikan) data structures
  const description =
    movie.overview || movie.synopsis || "No description available.";
  const rating = movie.vote_average || movie.score || "N/A";
  const year = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : movie.aired?.prop?.from?.year || "TBA";

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="outline-none flex items-center justify-center h-full"
      overlayClassName="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex items-center justify-center p-4"
    >
      <div className="bg-[#0f0f0f] w-full max-w-4xl rounded-[40px] overflow-hidden border border-white/10 shadow-2xl relative flex flex-col md:flex-row h-auto md:h-[600px] animate-in fade-in zoom-in duration-300">
        {/* Close Button */}
        <button
          onClick={onRequestClose}
          className="absolute top-6 right-6 z-20 p-2 bg-black/50 hover:bg-purple-600 rounded-full text-white transition-all border border-white/5"
        >
          <X size={24} />
        </button>

        {/* Poster Section */}
        <div className="w-full md:w-1/2 h-64 md:h-full relative bg-zinc-900">
          <img
            src={imageUrl}
            className="w-full h-full object-cover"
            alt={title}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#0f0f0f]" />
        </div>

        {/* Info Section */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter mb-4 leading-none text-white">
            {title}
          </h2>

          <div className="flex items-center gap-4 mb-6 text-sm font-bold">
            <div className="flex items-center gap-1.5 text-yellow-500">
              <Star size={16} fill="currentColor" />
              <span>
                {typeof rating === "number" ? rating.toFixed(1) : rating}
              </span>
            </div>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">{year}</span>
          </div>

          <div className="overflow-y-auto max-h-48 no-scrollbar mb-8">
            <p className="text-zinc-400 text-sm leading-relaxed">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 mt-auto">
            {/* The "Watch Now" button that triggers the media player */}
            <button
              onClick={onWatch}
              className="bg-white text-black px-10 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-purple-600 hover:text-white transition-all active:scale-95 shadow-lg"
            >
              <Play size={18} fill="currentColor" /> Watch Now
            </button>
            <button className="bg-white/5 border border-white/10 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95">
              <Plus size={18} /> My List
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MovieDetailsModal;
