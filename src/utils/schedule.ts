export const getDisplayTitle = (item?: { title?: { english?: string; romaji?: string } }) => {
  if (!item) return "Untitled";
  if (item.title) return item.title.english || item.title.romaji || "Untitled";
  return "Untitled";
};

export const getShortTitle = (item?: { title?: { english?: string; romaji?: string } }) => {
  const title = getDisplayTitle(item);
  const words = title.trim().split(/\s+/);
  if (words.length > 6) {
    return words.slice(0, 6).join(" ") + "...";
  }
  return title;
};

export const formatAirTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export const getDayOfWeek = (dateString: string) => {
  const days = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];
  return days[new Date(dateString).getDay()];
};

export const getCurrentDateFormatted = () => {
  const today = new Date();
  return today
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
};

export const isSameDay = (date1: Date, date2: Date) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};


export const mondayOffset = (date: Date) => (date.getDay() + 6) % 7;
