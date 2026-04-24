import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { loadFeed, loadFeaturedBooks, loadStats } from "../api/client";
import { FeedEntryCard } from "../components/FeedEntryCard";
import { SectionHeader } from "../components/SectionHeader";
import { SubTabBar } from "../components/SubTabBar";
import { getPreferredCatalogLanguage } from "../lib/catalog-language";
import { COLORS } from "../theme";
import type { BookSearchResult, FeedItem, StatsPayload } from "../types";

type HomeTab = "popular" | "reviews" | "lists" | "journal";

const homeTabs: Array<{ key: HomeTab; label: string }> = [
  { key: "popular", label: "Popular" },
  { key: "reviews", label: "Reviews" },
  { key: "lists", label: "Lists" },
  { key: "journal", label: "Journal" }
];

const shelfLabels: Record<string, string> = {
  quero_ler: "Watchlist",
  lendo: "Em andamento",
  lido: "Concluídos",
  abandonado: "Abandonados"
};

const BookRail = ({
  title,
  books,
  onPickBook,
  actionLabel,
  onAction
}: {
  title: string;
  books: BookSearchResult[];
  onPickBook: (book: BookSearchResult) => void;
  actionLabel?: string;
  onAction?: () => void;
}) => (
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
      showsHorizontalScrollIndicator={false}
    >
      {books.map((book) => (
        <Pressable
          key={book.googleId}
          onPress={() => onPickBook(book)}
          style={styles.popularCard}
        >
          {book.coverUrl ? (
            <Image source={{ uri: book.coverUrl }} style={styles.popularCover} />
          ) : (
            <View style={[styles.popularCover, styles.coverFallback]}>
              <Text style={styles.coverFallbackText}>SEM CAPA</Text>
            </View>
          )}
          <Text style={styles.popularTitle} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={styles.popularAuthor} numberOfLines={1}>
            {book.author}
          </Text>
          <Text style={styles.popularMeta} numberOfLines={2}>
            {book.categories.slice(0, 2).join(" / ") || "Abrir livro"}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  </View>
);

export const HomeScreen = ({
  viewerId,
  viewerUsername,
  onRequestDiscover,
  onRequestActivity,
  onRequestProfile,
  onPickBook,
  onOpenFeedBook,
  refreshKey
}: {
  viewerId: string;
  viewerUsername: string;
  onRequestDiscover: () => void;
  onRequestActivity: () => void;
  onRequestProfile: () => void;
  onPickBook: (book: BookSearchResult) => void;
  onOpenFeedBook: (item: FeedItem) => void;
  refreshKey: number;
}) => {
  const [activeTab, setActiveTab] = useState<HomeTab>("popular");
  const [popularBooks, setPopularBooks] = useState<BookSearchResult[]>([]);
  const [communityFeed, setCommunityFeed] = useState<FeedItem[]>([]);
  const [selfFeed, setSelfFeed] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const preferredLanguage = getPreferredCatalogLanguage();

  const refresh = async () => {
    setLoading(true);
    setError(null);

    const [popularResult, communityResult, selfResult, statsResult] =
      await Promise.allSettled([
        loadFeaturedBooks(viewerId, preferredLanguage, "popular"),
        loadFeed(viewerId, "community"),
        loadFeed(viewerId, "self"),
        loadStats(viewerId, viewerId, false)
      ]);

    setPopularBooks(popularResult.status === "fulfilled" ? popularResult.value.slice(0, 12) : []);
    setCommunityFeed(communityResult.status === "fulfilled" ? communityResult.value : []);
    setSelfFeed(selfResult.status === "fulfilled" ? selfResult.value : []);
    setStats(statsResult.status === "fulfilled" ? statsResult.value : null);

    if (
      popularResult.status === "rejected" &&
      communityResult.status === "rejected" &&
      selfResult.status === "rejected" &&
      statsResult.status === "rejected"
    ) {
      setError("Não foi possível montar a home agora.");
    }

    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [preferredLanguage, refreshKey, viewerId]);

  const reviewFeed = communityFeed.filter((item) => Boolean(item.reviewText)).slice(0, 6);
  const journalFeed = selfFeed.filter((item) => item.type !== "quero_ler").slice(0, 6);
  const shelfEntries = Object.entries(stats?.statuses ?? {}).sort((left, right) => right[1] - left[1]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <SectionHeader eyebrow="Home" title={`Em alta para @${viewerUsername}`} />

      <SubTabBar options={homeTabs} value={activeTab} onChange={setActiveTab} />

      {loading ? <Text style={styles.loadingText}>Montando a home...</Text> : null}
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {activeTab === "popular" ? (
        <BookRail
          title="Livros da semana"
          books={popularBooks}
          onPickBook={onPickBook}
          actionLabel="browse"
          onAction={onRequestDiscover}
        />
      ) : null}

      {activeTab === "reviews" ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Reviews em destaque</Text>
            <Pressable onPress={onRequestActivity}>
              <Text style={styles.linkText}>activity</Text>
            </Pressable>
          </View>

          {reviewFeed.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sem reviews em destaque ainda.</Text>
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
            <Text style={styles.sectionTitle}>Suas listas e estantes</Text>
            <Pressable onPress={onRequestProfile}>
              <Text style={styles.linkText}>perfil</Text>
            </Pressable>
          </View>

          <View style={styles.shelfGrid}>
            {shelfEntries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Sem listas ainda.</Text>
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
              <Text style={styles.genreTitle}>Gêneros do perfil</Text>
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
            <Text style={styles.sectionTitle}>Seu journal recente</Text>
            <Pressable onPress={onRequestProfile}>
              <Text style={styles.linkText}>diary</Text>
            </Pressable>
          </View>

          {journalFeed.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sem journal ainda.</Text>
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
    gap: 18,
    paddingBottom: 28
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 13
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
  railSection: {
    gap: 12
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
  popularCover: {
    borderRadius: 18,
    height: 220,
    width: "100%"
  },
  coverFallback: {
    alignItems: "center",
    backgroundColor: COLORS.panelMuted,
    justifyContent: "center"
  },
  coverFallbackText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1
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
