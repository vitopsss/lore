import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  loadDailyVerse,
  loadFeed,
  loadFeaturedBooks,
  loadNowReadingPulse,
  loadStats
} from "../api/client";
import { BookCover } from "../components/BookCover";
import { FeedEntryCard } from "../components/FeedEntryCard";
import { SectionHeader } from "../components/SectionHeader";
import { SubTabBar } from "../components/SubTabBar";
import { getPreferredCatalogLanguage } from "../lib/catalog-language";
import { COLORS } from "../theme";
import type { BookSearchResult, FeedItem, StatsPayload } from "../types";

type HomeTab = "popular" | "reviews" | "lists" | "journal";

interface DailyVerseData {
  quote: string;
  bookTitle: string;
  author: string;
}

interface PulseBook {
  book: BookSearchResult;
  readerCount: number;
  latestReader: string;
}

const DailyVerse = ({
  verse,
  onShare
}: {
  verse: DailyVerseData | null;
  onShare?: () => void;
}) => {
  const { t } = useTranslation();

  if (!verse) {
    return null;
  }

  return (
    <View style={styles.verseCard}>
      <View style={styles.verseHeader}>
        <Text style={styles.verseEyebrow}>{t("community.dailyVerse")}</Text>
        <View style={styles.verseDivider} />
      </View>
      <Text style={styles.verseText}>"{verse.quote}"</Text>
      <Text style={styles.verseSource}>
        - {verse.bookTitle}, {verse.author}
      </Text>
      {onShare ? (
        <Pressable onPress={onShare} style={styles.verseButton}>
          <Text style={styles.verseButtonText}>{t("community.shareInsight")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const BookRail = ({
  title,
  books,
  onPickBook,
  actionLabel,
  onAction,
  pulseBooks
}: {
  title: string;
  books: BookSearchResult[];
  onPickBook: (book: BookSearchResult) => void;
  actionLabel?: string;
  onAction?: () => void;
  pulseBooks?: PulseBook[];
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.railSection}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction}>
            <Text style={styles.linkText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={styles.popularRow}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
      >
        {books.map((book, index) => {
          const pulseData = pulseBooks?.[index];
          const readerCount = pulseData?.readerCount ?? 0;

          return (
            <Pressable key={book.googleId} onPress={() => onPickBook(book)} style={styles.popularCard}>
              <View style={styles.coverWrapper}>
                <BookCover uri={book.coverUrl} style={styles.popularCover} />
                {readerCount > 0 ? (
                  <View style={styles.pulseBadge}>
                    <Text style={styles.pulseBadgeText}>
                      {t("community.peopleReading", { count: readerCount })}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.popularTitle} numberOfLines={2}>
                {book.title}
              </Text>
              <Text style={styles.popularAuthor} numberOfLines={1}>
                {book.author}
              </Text>
              <Text style={styles.popularMeta} numberOfLines={2}>
                {book.categories.slice(0, 2).join(" / ") || t("home.openBook")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

export const HomeScreen = ({
  currentStreak,
  viewerId,
  onRequestDiscover,
  onRequestActivity,
  onRequestProfile,
  onPickBook,
  onOpenFeedBook,
  refreshKey
}: {
  currentStreak: number;
  viewerId: string;
  onRequestDiscover: () => void;
  onRequestActivity: () => void;
  onRequestProfile: () => void;
  onPickBook: (book: BookSearchResult) => void;
  onOpenFeedBook: (item: FeedItem) => void;
  refreshKey: number;
}) => {
  const { i18n, t } = useTranslation();
  const [activeTab, setActiveTab] = useState<HomeTab>("popular");
  const [dailyVerse, setDailyVerse] = useState<DailyVerseData | null>(null);
  const [popularBooks, setPopularBooks] = useState<BookSearchResult[]>([]);
  const [pulseBooks, setPulseBooks] = useState<PulseBook[]>([]);
  const [communityFeed, setCommunityFeed] = useState<FeedItem[]>([]);
  const [selfFeed, setSelfFeed] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const preferredLanguage = getPreferredCatalogLanguage();

  const homeTabs = useMemo<Array<{ key: HomeTab; label: string }>>(
    () => [
      { key: "popular", label: t("home.popularTab") },
      { key: "reviews", label: t("home.reviewsTab") },
      { key: "lists", label: t("home.listsTab") },
      { key: "journal", label: t("home.journalTab") }
    ],
    [t]
  );

  const shelfLabels: Record<string, string> = useMemo(
    () => ({
      quero_ler: t("shelf.wantToRead"),
      lendo: t("shelf.reading"),
      lido: t("shelf.completed"),
      abandonado: t("shelf.abandoned")
    }),
    [t]
  );

  const refresh = async () => {
    setLoading(true);
    setError(null);

    const [verseResult, popularResult, pulseResult, communityResult, selfResult, statsResult] =
      await Promise.allSettled([
        loadDailyVerse(),
        loadFeaturedBooks(viewerId, preferredLanguage, "popular"),
        loadNowReadingPulse(),
        loadFeed(viewerId, "community"),
        loadFeed(viewerId, "self"),
        loadStats(viewerId, viewerId, false)
      ]);

    setDailyVerse(verseResult.status === "fulfilled" ? verseResult.value : null);
    setPopularBooks(popularResult.status === "fulfilled" ? popularResult.value.slice(0, 12) : []);
    setPulseBooks(pulseResult.status === "fulfilled" ? pulseResult.value : []);
    setCommunityFeed(communityResult.status === "fulfilled" ? communityResult.value : []);
    setSelfFeed(selfResult.status === "fulfilled" ? selfResult.value : []);
    setStats(statsResult.status === "fulfilled" ? statsResult.value : null);

    if (
      popularResult.status === "rejected" &&
      communityResult.status === "rejected" &&
      selfResult.status === "rejected" &&
      statsResult.status === "rejected"
    ) {
      setError(t("home.errors.loadFailed"));
    }

    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [i18n.language, preferredLanguage, refreshKey, viewerId]);

  const handleShareInsight = async () => {
    if (!dailyVerse) {
      return;
    }

    try {
      await Share.share({
        message: t("home.shareInsightMessage", {
          quote: dailyVerse.quote,
          bookTitle: dailyVerse.bookTitle,
          author: dailyVerse.author
        })
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("home.errors.shareFailed"));
    }
  };

  const reviewFeed = communityFeed.filter((item) => Boolean(item.reviewText)).slice(0, 6);
  const journalFeed = selfFeed.filter((item) => item.type !== "quero_ler").slice(0, 6);
  const shelfEntries = Object.entries(stats?.statuses ?? {}).sort((left, right) => right[1] - left[1]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <SectionHeader title={t("home.headline")} />
        {currentStreak > 0 ? (
          <View style={styles.streakBadge}>
            <Text style={styles.streakBadgeIcon}>{"\uD83D\uDD25"}</Text>
            <Text style={styles.streakBadgeText}>{currentStreak}d</Text>
          </View>
        ) : null}
      </View>

      <DailyVerse verse={dailyVerse} onShare={() => void handleShareInsight()} />

      <SubTabBar options={homeTabs} value={activeTab} onChange={setActiveTab} />

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={COLORS.accentSoft} size="small" />
          <View style={styles.loadingCopy}>
            <Text style={styles.loadingTitle}>{t("home.loadingTitle")}</Text>
            <Text style={styles.loadingText}>{t("common.loading")}</Text>
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {activeTab === "popular" ? (
        <BookRail
          title={t("home.weeklyBooks")}
          books={popularBooks}
          onPickBook={onPickBook}
          actionLabel={t("home.browse")}
          onAction={onRequestDiscover}
          pulseBooks={pulseBooks}
        />
      ) : null}

      {activeTab === "reviews" ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{t("home.featuredReviews")}</Text>
            <Pressable onPress={onRequestActivity}>
              <Text style={styles.linkText}>{t("home.activity")}</Text>
            </Pressable>
          </View>

          {reviewFeed.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t("home.emptyReviews")}</Text>
            </View>
          ) : (
            reviewFeed.map((item) => (
              <FeedEntryCard
                key={item.activityId}
                item={item}
                compact
                onOpenBook={onOpenFeedBook}
              />
            ))
          )}
        </>
      ) : null}

      {activeTab === "lists" ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{t("home.yourLists")}</Text>
            <Pressable onPress={onRequestProfile}>
              <Text style={styles.linkText}>{t("home.profile")}</Text>
            </Pressable>
          </View>

          <View style={styles.shelfGrid}>
            {shelfEntries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t("home.emptyLists")}</Text>
              </View>
            ) : (
              shelfEntries.map(([status, total]) => (
                <View key={status} style={styles.shelfCard}>
                  <Text style={styles.shelfValue}>{total}</Text>
                  <Text style={styles.shelfLabel}>{shelfLabels[status] ?? status}</Text>
                </View>
              ))
            )}
          </View>

          {stats?.topGenres?.length ? (
            <View style={styles.genrePanel}>
              <Text style={styles.genreTitle}>{t("shelf.genres")}</Text>
              {stats.topGenres.map((genre) => (
                <View key={genre.genre} style={styles.genreRow}>
                  <Text style={styles.genreName}>{genre.genre}</Text>
                  <Text style={styles.genreCount}>{genre.total}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {activeTab === "journal" ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{t("home.recentJournal")}</Text>
            <Pressable onPress={onRequestProfile}>
              <Text style={styles.linkText}>{t("home.diary")}</Text>
            </Pressable>
          </View>

          {journalFeed.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t("home.emptyJournal")}</Text>
            </View>
          ) : (
            journalFeed.map((item) => (
              <FeedEntryCard
                key={item.activityId}
                item={item}
                showUsername={false}
                compact
                onOpenBook={onOpenFeedBook}
              />
            ))
          )}
        </>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 22,
    paddingBottom: 28
  },
  topRow: {
    gap: 10
  },
  streakBadge: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "rgba(22, 26, 36, 0.78)",
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  streakBadgeIcon: {
    fontSize: 12
  },
  streakBadgeText: {
    color: COLORS.textSoft,
    fontSize: 11,
    fontWeight: "800"
  },
  loadingCard: {
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16
  },
  loadingCopy: {
    flex: 1,
    gap: 2
  },
  loadingTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800"
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  errorCard: {
    backgroundColor: COLORS.dangerTint,
    borderColor: "rgba(210, 115, 107, 0.24)",
    borderRadius: 22,
    borderWidth: 1,
    padding: 16
  },
  errorText: {
    color: "#ffd8d8",
    fontSize: 14,
    lineHeight: 20
  },
  verseCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.borderStrong,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20
  },
  verseHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 14
  },
  verseEyebrow: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  verseDivider: {
    backgroundColor: COLORS.border,
    flex: 1,
    height: 1
  },
  verseText: {
    color: COLORS.text,
    fontSize: 16,
    fontStyle: "italic",
    fontWeight: "600",
    lineHeight: 24,
    marginBottom: 10
  },
  verseSource: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: "500"
  },
  verseButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.panelMuted,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  verseButtonText: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: "700"
  },
  railSection: {
    gap: 16
  },
  sectionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  linkText: {
    color: COLORS.accentSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  popularRow: {
    gap: 12,
    paddingRight: 8
  },
  popularCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    width: 178
  },
  coverWrapper: {
    position: "relative"
  },
  popularCover: {
    borderRadius: 18,
    height: 220,
    width: "100%"
  },
  pulseBadge: {
    backgroundColor: "rgba(15, 17, 23, 0.92)",
    borderColor: COLORS.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    bottom: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "absolute",
    right: 8
  },
  pulseBadgeText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center"
  },
  popularTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 20
  },
  popularAuthor: {
    color: COLORS.textSoft,
    fontSize: 13
  },
  popularMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  emptyCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900"
  },
  shelfGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  shelfCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
    minWidth: 150,
    padding: 16
  },
  shelfValue: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900"
  },
  shelfLabel: {
    color: COLORS.textSoft,
    fontSize: 14,
    fontWeight: "700"
  },
  genrePanel: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  genreTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900"
  },
  genreRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  genreName: {
    color: COLORS.textSoft,
    flex: 1,
    fontSize: 14
  },
  genreCount: {
    color: COLORS.accentSoft,
    fontSize: 15,
    fontWeight: "900"
  }
});
