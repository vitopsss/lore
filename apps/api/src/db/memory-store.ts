import { randomUUID } from "node:crypto";

import { DEMO_BOOKS } from "../constants/demo-books";
import { normalizeActivityDay, resolveNextStreak, toStreakTimestamp } from "../lib/streaks";
import { buildAmazonAffiliateLink } from "../services/amazon-affiliate.service";
import type {
  ActivityType,
  BookInput,
  CardThemeName,
  CurrentUser,
  StoredBook,
  UserSummary
} from "../types/domain";

interface MemoryUser extends CurrentUser {
  bio: string | null;
  email: string | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryActivity {
  id: string;
  userId: string;
  bookId: string;
  type: ActivityType;
  rating: number | null;
  reviewText: string | null;
  readAt: string | null;
  cardTheme: CardThemeName;
  showExcerpt: boolean;
  createdAt: string;
}

interface MemoryFollow {
  followerId: string;
  followingId: string;
  createdAt: string;
}

const nowIso = () => new Date().toISOString();

const daysAgoIso = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString();
};

const mapCurrentUser = (user: MemoryUser): CurrentUser => ({
  id: user.id,
  username: user.username,
  premiumStatus: user.premiumStatus,
  currentStreak: user.currentStreak,
  lastReadDate: user.lastReadDate
});

const mapUserSummary = (user: MemoryUser): UserSummary => ({
  ...mapCurrentUser(user),
  bio: user.bio,
  avatar: user.avatar
});

const toStoredBook = (book: BookInput, id?: string): StoredBook => ({
  id: id ?? randomUUID(),
  googleId: book.googleId,
  title: book.title,
  author: book.author,
  coverUrl: book.coverUrl ?? null,
  isbn: book.isbn ?? null,
  pageCount: book.pageCount ?? null,
  categories: book.categories ?? [],
  amazonAffiliateLink: buildAmazonAffiliateLink(book.isbn, book.amazonAffiliateLink)
});

const users: MemoryUser[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    username: "ana_estante",
    bio: "Leitora de romance historico, thrillers e clube do livro.",
    email: null,
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    premiumStatus: false,
    currentStreak: 0,
    lastReadDate: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    username: "rafa_atlas",
    bio: "NÃ£o larga nÃ£o ficÃ§Ã£o, ensaios e resenhas curtas.",
    email: null,
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    premiumStatus: true,
    currentStreak: 0,
    lastReadDate: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
];

const books: StoredBook[] = [
  toStoredBook(
    DEMO_BOOKS.find((book) => book.googleId === "zyTCAlFPjgYC") ?? DEMO_BOOKS[0],
    "10000000-0000-0000-0000-000000000001"
  )
];

const follows: MemoryFollow[] = [
  {
    followerId: "00000000-0000-0000-0000-000000000001",
    followingId: "00000000-0000-0000-0000-000000000002",
    createdAt: daysAgoIso(30)
  }
];

const activities: MemoryActivity[] = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    userId: "00000000-0000-0000-0000-000000000002",
    bookId: "10000000-0000-0000-0000-000000000001",
    type: "lido",
    rating: 4,
    reviewText: "Leitura agil sobre produto, cultura e escala.",
    readAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    cardTheme: "wrapped",
    showExcerpt: true,
    createdAt: daysAgoIso(7)
  }
];

export const searchDemoBooks = (query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  return DEMO_BOOKS.filter((book) =>
    `${book.title} ${book.author}`.toLowerCase().includes(normalizedQuery)
  )
    .slice(0, 12)
    .map((book) => ({
      ...book,
      coverUrl: book.coverUrl ?? null,
      isbn: book.isbn ?? null,
      pageCount: book.pageCount ?? null,
      categories: book.categories ?? [],
      amazonAffiliateLink: buildAmazonAffiliateLink(book.isbn, book.amazonAffiliateLink)
    }));
};

export const findDemoBookByGoogleId = (googleId: string) => {
  const book = DEMO_BOOKS.find((entry) => entry.googleId === googleId);

  if (!book) {
    return null;
  }

  return {
    ...book,
    coverUrl: book.coverUrl ?? null,
    isbn: book.isbn ?? null,
    pageCount: book.pageCount ?? null,
    categories: book.categories ?? [],
    amazonAffiliateLink: buildAmazonAffiliateLink(book.isbn, book.amazonAffiliateLink)
  };
};

export const memoryStore = {
  getUserById(userId: string): CurrentUser | null {
    const user = users.find((entry) => entry.id === userId);
    return user ? mapCurrentUser(user) : null;
  },

  listUsers(): UserSummary[] {
    return users
      .map(mapUserSummary)
      .sort((left, right) => {
        const leftUser = users.find((user) => user.id === left.id);
        const rightUser = users.find((user) => user.id === right.id);

        if (!leftUser || !rightUser) {
          return 0;
        }

        return new Date(rightUser.createdAt).getTime() - new Date(leftUser.createdAt).getTime();
      });
  },

  createUser(input: { username: string; bio?: string | null; avatar?: string | null }): UserSummary {
    const normalizedUsername = input.username.trim().toLowerCase();
    const usernameTaken = users.some(
      (user) => user.username.trim().toLowerCase() === normalizedUsername
    );

    if (usernameTaken) {
      throw new Error("username_taken");
    }

    const timestamp = nowIso();
    const user: MemoryUser = {
      id: randomUUID(),
      username: input.username.trim(),
      bio: input.bio?.trim() || null,
      email: null,
      avatar: input.avatar?.trim() || null,
      premiumStatus: false,
      currentStreak: 0,
      lastReadDate: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    users.unshift(user);

    return mapUserSummary(user);
  },

  upsertAuthUser(input: {
    id: string;
    username: string;
    email?: string | null;
    avatar?: string | null;
  }): UserSummary {
    const existingUser = users.find((entry) => entry.id === input.id);
    const timestamp = nowIso();

    if (existingUser) {
      existingUser.email = input.email?.trim().toLowerCase() || existingUser.email;
      existingUser.avatar = input.avatar?.trim() || existingUser.avatar;
      existingUser.updatedAt = timestamp;
      return mapUserSummary(existingUser);
    }

    const user: MemoryUser = {
      id: input.id,
      username: input.username.trim(),
      bio: null,
      email: input.email?.trim().toLowerCase() || null,
      avatar: input.avatar?.trim() || null,
      premiumStatus: false,
      currentStreak: 0,
      lastReadDate: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    users.unshift(user);

    return mapUserSummary(user);
  },

  findBookById(bookId: string): StoredBook | null {
    return books.find((entry) => entry.id === bookId) ?? null;
  },

  upsertBook(book: BookInput): StoredBook {
    const existingIndex = books.findIndex((entry) => entry.googleId === book.googleId);
    const normalizedBook = toStoredBook(
      book,
      existingIndex >= 0 ? books[existingIndex].id : undefined
    );

    if (existingIndex >= 0) {
      books[existingIndex] = normalizedBook;
      return books[existingIndex];
    }

    books.push(normalizedBook);
    return normalizedBook;
  },

  insertActivity(input: {
    userId: string;
    bookId: string;
    type: ActivityType;
    rating: number | null;
    reviewText: string | null;
    readAt: string | null;
    cardTheme: CardThemeName;
    showExcerpt: boolean;
  }) {
    const createdAt = nowIso();
    const activity: MemoryActivity = {
      id: randomUUID(),
      userId: input.userId,
      bookId: input.bookId,
      type: input.type,
      rating: input.rating,
      reviewText: input.reviewText,
      readAt: input.readAt,
      cardTheme: input.cardTheme,
      showExcerpt: input.showExcerpt,
      createdAt
    };

    activities.unshift(activity);

    const user = users.find((entry) => entry.id === input.userId);
    const activityDay = normalizeActivityDay(input.readAt ?? createdAt);

    if (user) {
      const nextStreak = resolveNextStreak({
        currentStreak: user.currentStreak,
        lastReadDate: user.lastReadDate,
        nextReadDate: activityDay
      });

      user.currentStreak = nextStreak.currentStreak;
      user.lastReadDate = toStreakTimestamp(nextStreak.lastReadDate);
      user.updatedAt = createdAt;
    }

    return {
      activity: {
        id: activity.id,
        userId: activity.userId,
        bookId: activity.bookId,
        type: activity.type,
        rating: activity.rating,
        reviewText: activity.reviewText,
        readAt: activity.readAt,
        cardTheme: activity.cardTheme,
        showExcerpt: activity.showExcerpt,
        createdAt: activity.createdAt
      },
      streak: user ? mapCurrentUser(user) : null
    };
  },

  getActivityShareCardData(activityId: string) {
    const activity = activities.find((entry) => entry.id === activityId);

    if (!activity) {
      return null;
    }

    const user = users.find((entry) => entry.id === activity.userId);
    const book = books.find((entry) => entry.id === activity.bookId);

    if (!user || !book) {
      return null;
    }

    return {
      activityId: activity.id,
      type: activity.type,
      rating: activity.rating,
      reviewText: activity.reviewText,
      readAt: activity.readAt,
      createdAt: activity.createdAt,
      cardTheme: activity.cardTheme,
      showExcerpt: activity.showExcerpt,
      username: user.username,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl
    };
  },

  getBookCommunityDetails(googleId: string) {
    const book = books.find((entry) => entry.googleId === googleId);

    if (!book) {
      return {
        communityAverageRating: null,
        communityRatingsCount: 0,
        communityReviewsCount: 0,
        communityLogsCount: 0,
        reviews: []
      };
    }

    const relatedActivities = activities.filter((activity) => activity.bookId === book.id);
    const ratedActivities = relatedActivities.filter((activity) => activity.rating !== null);
    const reviewActivities = relatedActivities
      .filter(
        (activity) =>
          activity.rating !== null ||
          Boolean(activity.reviewText && activity.reviewText.trim().length > 0)
      )
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
      .slice(0, 12);

    return {
      communityAverageRating: ratedActivities.length
        ? Math.round(
            (ratedActivities.reduce((total, activity) => total + (activity.rating ?? 0), 0) /
              ratedActivities.length) *
              100
          ) / 100
        : null,
      communityRatingsCount: ratedActivities.length,
      communityReviewsCount: relatedActivities.filter((activity) =>
        Boolean(activity.reviewText && activity.reviewText.trim().length > 0)
      ).length,
      communityLogsCount: relatedActivities.length,
      reviews: reviewActivities.flatMap((activity) => {
        const user = users.find((entry) => entry.id === activity.userId);

        if (!user) {
          return [];
        }

        return [
          {
            activityId: activity.id,
            userId: user.id,
            username: user.username,
            rating: activity.rating,
            reviewText: activity.reviewText,
            readAt: activity.readAt,
            createdAt: activity.createdAt,
            cardTheme: activity.cardTheme
          }
        ];
      })
    };
  },

  getFeedForUser(userId: string, scope: "community" | "self" = "community") {
    const followedUsers =
      scope === "community"
        ? new Set(
            follows
              .filter((follow) => follow.followerId === userId)
              .map((follow) => follow.followingId)
          )
        : new Set<string>();

    return activities
      .filter((activity) =>
        scope === "self"
          ? activity.userId === userId
          : activity.userId === userId || followedUsers.has(activity.userId)
      )
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
      .slice(0, 30)
      .flatMap((activity) => {
        const user = users.find((entry) => entry.id === activity.userId);
        const book = books.find((entry) => entry.id === activity.bookId);

        if (!user || !book) {
          return [];
        }

        return [
          {
            activityId: activity.id,
            type: activity.type,
            rating: activity.rating,
            reviewText: activity.reviewText,
            readAt: activity.readAt,
            cardTheme: activity.cardTheme,
            createdAt: activity.createdAt,
            userId: user.id,
            username: user.username,
            bookId: book.id,
            googleId: book.googleId,
            title: book.title,
            author: book.author,
            coverUrl: book.coverUrl,
            isbn: book.isbn,
            amazonAffiliateLink: book.amazonAffiliateLink
          }
        ];
      });
  },

  getStats(userId: string, advanced: boolean) {
    const userActivities = activities.filter((activity) => activity.userId === userId);
    const statuses = userActivities.reduce<Record<string, number>>((accumulator, activity) => {
      accumulator[activity.type] = (accumulator[activity.type] ?? 0) + 1;
      return accumulator;
    }, {});

    const latestCompletedByBook = new Map<string, MemoryActivity>();
    userActivities
      .filter((activity) => activity.type === "lido")
      .sort((left, right) => {
        const leftDate = left.readAt ?? left.createdAt.slice(0, 10);
        const rightDate = right.readAt ?? right.createdAt.slice(0, 10);
        return rightDate.localeCompare(leftDate) || right.createdAt.localeCompare(left.createdAt);
      })
      .forEach((activity) => {
        if (!latestCompletedByBook.has(activity.bookId)) {
          latestCompletedByBook.set(activity.bookId, activity);
        }
      });

    const completedBooks = [...latestCompletedByBook.values()]
      .map((activity) => books.find((book) => book.id === activity.bookId))
      .filter((book): book is StoredBook => Boolean(book));

    const pagesRead = completedBooks.reduce((total, book) => total + (book.pageCount ?? 0), 0);

    const genreTotals = new Map<string, number>();
    completedBooks.forEach((book) => {
      const categories = book.categories.length > 0 ? book.categories : ["Sem categoria"];
      categories.forEach((genre) => {
        genreTotals.set(genre, (genreTotals.get(genre) ?? 0) + 1);
      });
    });

    const averageDaysValues = [...latestCompletedByBook.values()]
      .map((completed) => {
        const completedDate = new Date(completed.readAt ?? completed.createdAt.slice(0, 10));
        const started = userActivities
          .filter(
            (activity) =>
              activity.bookId === completed.bookId &&
              activity.type === "lendo" &&
              new Date(activity.createdAt) <= completedDate
          )
          .sort(
            (left, right) =>
              new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
          )[0];

        if (!started) {
          return null;
        }

        const startedDate = new Date(started.createdAt.slice(0, 10));
        return Math.round(
          ((completedDate.getTime() - startedDate.getTime()) / (1000 * 60 * 60 * 24)) * 10
        ) / 10;
      })
      .filter((value): value is number => value !== null);

    const response: {
      userId: string;
      summary: {
        booksRead: number;
        pagesRead: number;
        averageDaysToFinish: number;
      };
      statuses: Record<string, number>;
      topGenres: Array<{ genre: string; total: number }>;
      advanced?: {
        averageRating: number;
        completionRate: number;
        monthlyPace: number;
      };
    } = {
      userId,
      summary: {
        booksRead: completedBooks.length,
        pagesRead,
        averageDaysToFinish: averageDaysValues.length
          ? Math.round(
              (averageDaysValues.reduce((total, value) => total + value, 0) /
                averageDaysValues.length) *
                10
            ) / 10
          : 0
      },
      statuses,
      topGenres: [...genreTotals.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 5)
        .map(([genre, total]) => ({ genre, total }))
    };

    if (!advanced) {
      return response;
    }

    const ratedActivities = userActivities.filter((activity) => activity.rating !== null);
    const finishedOrAbandoned = userActivities.filter((activity) =>
      ["lido", "abandonado"].includes(activity.type)
    );
    const completedCount = userActivities.filter((activity) => activity.type === "lido").length;
    const monthlyThreshold = new Date();
    monthlyThreshold.setDate(monthlyThreshold.getDate() - 30);

    response.advanced = {
      averageRating: ratedActivities.length
        ? Math.round(
            (ratedActivities.reduce((total, activity) => total + (activity.rating ?? 0), 0) /
              ratedActivities.length) *
              100
          ) / 100
        : 0,
      completionRate: finishedOrAbandoned.length
        ? Math.round((completedCount / finishedOrAbandoned.length) * 1000) / 10
        : 0,
      monthlyPace: userActivities.filter(
        (activity) =>
          activity.type === "lido" &&
          new Date(activity.readAt ?? activity.createdAt) >= monthlyThreshold
      ).length
    };

    return response;
  }
};
