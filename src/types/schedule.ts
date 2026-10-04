export interface DubEntry {
  title: string;
  route: string;
  native: string;
  episodeDate: string;
  episodeNumber: number;
  delayedFrom: string;
  delayedUntil: string;
  airingStatus: string;
  verified: boolean;
  media?: {
    media: {
      id: number;
      title: { english?: string; romaji?: string };
      coverImage: { extraLarge: string };
      description: string;
      episodes: number;
      averageScore: number;
      airingSchedule: { nodes: Array<{ episode: number; airingAt: string | number }> };
    };
  };
}

export interface ScheduleEntry extends DubEntry {
  displayTime: string;
  timeOnly: string;
  dayOfWeek: string;
}

