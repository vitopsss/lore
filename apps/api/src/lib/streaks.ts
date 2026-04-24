import type { StreakSnapshot } from "../types/domain";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toDayKey = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("invalid_streak_date");
  }

  return parsed.toISOString().slice(0, 10);
};

const toDayIndex = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map((value) => Number.parseInt(value, 10));
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_IN_MS);
};

export const normalizeActivityDay = (value?: string | Date | null) => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return toDayKey(value);
};

export const toStreakTimestamp = (dayKey: string | null) =>
  dayKey ? `${dayKey}T00:00:00.000Z` : null;

export const resolveNextStreak = ({
  currentStreak,
  lastReadDate,
  nextReadDate
}: {
  currentStreak: number;
  lastReadDate: string | null;
  nextReadDate: string;
}): StreakSnapshot => {
  const nextDayKey = toDayKey(nextReadDate);

  if (!lastReadDate) {
    return {
      currentStreak: 1,
      lastReadDate: nextDayKey
    };
  }

  const lastDayKey = toDayKey(lastReadDate);
  const dayDelta = toDayIndex(nextDayKey) - toDayIndex(lastDayKey);

  if (dayDelta < 0) {
    return {
      currentStreak: Math.max(currentStreak, 1),
      lastReadDate: lastDayKey
    };
  }

  if (dayDelta === 0) {
    return {
      currentStreak: Math.max(currentStreak, 1),
      lastReadDate: lastDayKey
    };
  }

  if (dayDelta === 1) {
    return {
      currentStreak: Math.max(currentStreak, 0) + 1,
      lastReadDate: nextDayKey
    };
  }

  return {
    currentStreak: 1,
    lastReadDate: nextDayKey
  };
};
