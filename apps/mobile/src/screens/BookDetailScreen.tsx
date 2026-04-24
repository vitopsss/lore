import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { loadBookDetail } from "../api/client";
import { BookCover } from "../components/BookCover";
import { SectionHeader } from "../components/SectionHeader";
import { SubTabBar } from "../components/SubTabBar";
import { COLORS } from "../theme";
import type { BookDetailPayload, BookSearchResult } from "../types";

type DetailTab = "overview" | "reviews" | "similar";

const detailTabs: Array<{ key: DetailTab; label: string }> = [
  { key: "overview", label: "Visão geral" },
  { key: "reviews", label: "Reviews" },
  { key: "similar", label: "Similares" }
];

const monthLabels = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez"
];

const SYNOPSIS_PREVIEW_LIMIT = 420;

const starsText = (rating: number | null) => {
  if (!rating) {
    return "Sem nota";
  }

  const rounded = Math.max(1, Math.min(5, Math.round(rating)));
  return `${"\u2605".repeat(rounded)}${"\u2606".repeat(5 - rounded)}`;
};

const formatLogDate = (value: string | null) => {
  if (!value) {
    return "recente";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "recente";
  }

  return `${monthLabels[parsed.getMonth()]} ${parsed.getDate()}`;
};

const formatAverage = (value: number | null) =>
  value === null ? "-" : value.toFixed(1).replace(/\.0$/, "");

const buildHeroMeta = (payload: BookDetailPayload | null) => {
  if (!payload) {
    return [];
  }

  const items = [];

  if (payload.book.pageCount) {
    items.push(`${payload.book.pageCount} páginas`);
  }

  if (payload.book.publishedDate) {
    items.push(payload.book.publishedDate.slice(0, 4));
  }

  if (payload.book.language) {
    items.push(payload.book.language.toUpperCase());
  }

  return items;
};

const buildSynopsisPreview = (text: string, limit = SYNOPSIS_PREVIEW_LIMIT) => {
  const normalizedText = text.trim();

  if (normalizedText.length <= limit) {
    return {
      isTruncated: false,
      text: normalizedText
    };
  }

  const rawPreview = normalizedText.slice(0, limit + 1);
  const lastBreak = Math.max(rawPreview.lastIndexOf(" "), rawPreview.lastIndexOf("\n"));
  const safeCutoff = lastBreak > limit * 0.65 ? lastBreak : limit;

  return {
    isTruncated: true,
    text: `${rawPreview.slice(0, safeCutoff).trimEnd()}…`
  };
};

export const BookDetailScreen = ({
  viewerId,
  book,
  onBack,
  onOpenBook,
  onLogBook
}: {
  viewerId: string;
  book: BookSearchResult;
  onBack: () => void;
  onOpenBook: (book: BookSearchResult) => void;
  onLogBook: (book: BookSearchResult) => void;
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [detail, setDetail] = useState<BookDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      setLoading(true);
      setError(null);

      try {
        const payload = await loadBookDetail(viewerId, book.googleId);
        setDetail(payload);
      } catch (caughtError) {
        setDetail(null);
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível abrir este livro agora."
        );
      } finally {
        setLoading(false);
      }
    };

    void refresh();
  }, [book.googleId, viewerId]);

  useEffect(() => {
    setShowFullSynopsis(false);
  }, [book.googleId]);

  const heroMeta = useMemo(() => buildHeroMeta(detail), [detail]);
  const summaryBook = detail?.book ?? book;
  const overviewSimilar = detail?.similarBooks.slice(0, 6) ?? [];
  const synopsis =
    detail?.book.description?.trim() || "Sem sinopse disponível para esta edição.";
  const synopsisPreview = buildSynopsisPreview(synopsis);
  const synopsisText =
    showFullSynopsis || !synopsisPreview.isTruncated ? synopsis : synopsisPreview.text;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </View>

      <SectionHeader eyebrow="Livro" title={summaryBook.title} subtitle={summaryBook.author} />

      <View style={styles.hero}>
        <BookCover uri={summaryBook.coverUrl} style={styles.cover} />

        <View style={styles.heroCopy}>
          <View style={styles.heroStats}>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>
                {formatAverage(detail?.ratings.communityAverageRating ?? null)}
              </Text>
              <Text style={styles.statLabel}>média</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{detail?.ratings.communityReviewsCount ?? 0}</Text>
              <Text style={styles.statLabel}>reviews</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{detail?.ratings.communityLogsCount ?? 0}</Text>
              <Text style={styles.statLabel}>logs</Text>
            </View>
          </View>

          {heroMeta.length ? (
            <View style={styles.metaRow}>
              {heroMeta.map((item) => (
                <View key={item} style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {summaryBook.categories.length ? (
            <Text style={styles.categoryText}>
              {summaryBook.categories.slice(0, 3).join(" / ")}
            </Text>
          ) : null}

          <View style={styles.ctaRow}>
            <Pressable style={styles.primaryButton} onPress={() => onLogBook(summaryBook)}>
              <Text style={styles.primaryButtonText}>Avaliar / registrar</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <SubTabBar options={detailTabs} value={activeTab} onChange={setActiveTab} />

      {loading ? <Text style={styles.loadingText}>Carregando ficha do livro...</Text> : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error && activeTab === "overview" ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Sinopse</Text>
            <Text style={styles.bodyText}>{synopsisText}</Text>
            {synopsisPreview.isTruncated ? (
              <Pressable onPress={() => setShowFullSynopsis((current) => !current)}>
                <Text style={styles.synopsisLinkText}>
                  {showFullSynopsis ? "Mostrar menos" : "Ler mais..."}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {starsText(detail?.ratings.communityAverageRating ?? null)}
              </Text>
              <Text style={styles.metricLabel}>
                Comunidade · {detail?.ratings.communityRatingsCount ?? 0} notas
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {starsText(detail?.ratings.externalAverageRating ?? null)}
              </Text>
              <Text style={styles.metricLabel}>
                Catálogo · {detail?.ratings.externalRatingsCount ?? 0} avaliações
              </Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Mais desta edição</Text>
            <View style={styles.detailRows}>
              {detail?.book.publisher ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Editora</Text>
                  <Text style={styles.detailValue}>{detail.book.publisher}</Text>
                </View>
              ) : null}

              {detail?.book.isbn ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>ISBN</Text>
                  <Text style={styles.detailValue}>{detail.book.isbn}</Text>
                </View>
              ) : null}

              {detail?.book.pageCount ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Páginas</Text>
                  <Text style={styles.detailValue}>{detail.book.pageCount}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionRow}>
              <Text style={styles.panelTitle}>Livros similares</Text>
              <Pressable onPress={() => setActiveTab("similar")}>
                <Text style={styles.linkText}>ver todos</Text>
              </Pressable>
            </View>

            {overviewSimilar.length === 0 ? (
              <Text style={styles.bodyText}>Sem similares suficientes por enquanto.</Text>
            ) : (
              <ScrollView
                horizontal
                contentContainerStyle={styles.similarRow}
                showsHorizontalScrollIndicator={false}
              >
                {overviewSimilar.map((item) => (
                  <Pressable
                    key={item.googleId}
                    onPress={() => onOpenBook(item)}
                    style={styles.similarCard}
                  >
                    <BookCover uri={item.coverUrl} style={styles.similarCover} />
                    <Text style={styles.similarTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.similarAuthor} numberOfLines={1}>
                      {item.author}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </>
      ) : null}

      {!loading && !error && activeTab === "reviews" ? (
        detail?.reviews.length ? (
          detail.reviews.map((review) => (
            <View key={review.activityId} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View>
                  <Text style={styles.reviewUser}>@{review.username}</Text>
                  <Text style={styles.reviewDate}>
                    {formatLogDate(review.readAt ?? review.createdAt)}
                  </Text>
                </View>
                <Text style={styles.reviewStars}>{starsText(review.rating)}</Text>
              </View>
              {review.reviewText ? (
                <Text style={styles.reviewText}>{review.reviewText}</Text>
              ) : (
                <Text style={styles.reviewMuted}>Sem texto, só nota.</Text>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Ainda não existem reviews desse livro no app.</Text>
          </View>
        )
      ) : null}

      {!loading && !error && activeTab === "similar" ? (
        detail?.similarBooks.length ? (
          detail.similarBooks.map((item) => (
            <Pressable
              key={item.googleId}
              onPress={() => onOpenBook(item)}
              style={styles.resultCard}
            >
              <BookCover uri={item.coverUrl} style={styles.resultCover} />

              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle}>{item.title}</Text>
                <Text style={styles.resultAuthor}>{item.author}</Text>
                {item.categories.length ? (
                  <Text style={styles.resultMeta}>{item.categories.slice(0, 2).join(" / ")}</Text>
                ) : null}
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Ainda não encontrei similares fortes para este livro.
            </Text>
          </View>
        )
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingBottom: 28
  },
  topRow: {
    alignItems: "flex-start"
  },
  backButton: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800"
  },
  hero: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16
  },
  cover: {
    borderRadius: 22,
    height: 224,
    width: 148
  },
  heroCopy: {
    flex: 1,
    gap: 14
  },
  heroStats: {
    flexDirection: "row",
    gap: 8
  },
  statChip: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 12
  },
  statValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
    textTransform: "uppercase"
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metaPill: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  metaPillText: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: "800"
  },
  categoryText: {
    color: COLORS.accentCool,
    fontSize: 13,
    lineHeight: 19
  },
  ctaRow: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: "#101013",
    fontSize: 13,
    fontWeight: "900"
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
  panel: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 26,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  panelTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  bodyText: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 22
  },
  metricsGrid: {
    gap: 12
  },
  metricCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 6,
    padding: 18
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900"
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 13
  },
  detailRows: {
    gap: 12
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  detailLabel: {
    color: COLORS.textMuted,
    fontSize: 13
  },
  detailValue: {
    color: COLORS.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 16,
    textAlign: "right"
  },
  sectionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  linkText: {
    color: COLORS.accentSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  synopsisLinkText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800"
  },
  similarRow: {
    gap: 12,
    paddingRight: 6
  },
  similarCard: {
    width: 140
  },
  similarCover: {
    borderRadius: 18,
    height: 190,
    marginBottom: 10,
    width: 140
  },
  similarTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18
  },
  similarAuthor: {
    color: COLORS.textSoft,
    fontSize: 12,
    marginTop: 4
  },
  reviewCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  reviewUser: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900"
  },
  reviewDate: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4
  },
  reviewStars: {
    color: COLORS.accentSoft,
    fontSize: 16,
    fontWeight: "800"
  },
  reviewText: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 21
  },
  reviewMuted: {
    color: COLORS.textMuted,
    fontSize: 13
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
  resultCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 14
  },
  resultCover: {
    borderRadius: 18,
    height: 144,
    width: 96
  },
  resultCopy: {
    flex: 1,
    gap: 8
  },
  resultTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24
  },
  resultAuthor: {
    color: COLORS.textSoft,
    fontSize: 14
  },
  resultMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18
  }
});
