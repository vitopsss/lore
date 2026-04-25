import { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { createActivity, searchBooks } from "../api/client";
import { BookCover } from "../components/BookCover";
import { SectionHeader } from "../components/SectionHeader";
import { CARD_THEMES } from "../config";
import { COLORS, getCardThemeMeta } from "../theme";
import type {
  ActivityType,
  BookSearchResult,
  CardThemeName,
  ShareCardResult
} from "../types";

const previewUri = (card: ShareCardResult | null) =>
  card ? `data:image/png;base64,${card.base64}` : undefined;

const ratingOptions = [1, 2, 3, 4, 5];
const SEARCH_DEBOUNCE_MS = 800;

const isValidReadDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const buildMetaLine = (book: BookSearchResult) => {
  const parts = [];

  if (book.pageCount) {
    parts.push(`${book.pageCount} paginas`);
  }

  if (book.categories[0]) {
    parts.push(book.categories[0]);
  }

  return parts.join("  /  ") || "Sem metadados";
};

export const SearchScreen = ({
  viewerId,
  viewerPremium,
  onPostCreated
}: {
  viewerId: string;
  viewerPremium: boolean;
  onPostCreated: () => void;
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [hasFocus, setHasFocus] = useState(false);
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<CardThemeName>("classic");
  const [selectedStatus, setSelectedStatus] = useState<ActivityType>("lido");
  const [selectedRating, setSelectedRating] = useState(4);
  const [reviewText, setReviewText] = useState("");
  const [readAt, setReadAt] = useState(new Date().toISOString().slice(0, 10));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [submittingBookId, setSubmittingBookId] = useState<string | null>(null);
  const [shareCard, setShareCard] = useState<ShareCardResult | null>(null);
  const inputRef = useRef<TextInput>(null);
  const latestSearchIdRef = useRef(0);

  const activeTheme = CARD_THEMES.find((theme) => theme.key === selectedTheme);
  const activeThemeMeta = getCardThemeMeta(selectedTheme);
  const isFinishedLog = selectedStatus === "lido";

  const runSearch = async (rawQuery: string, dismissKeyboard = false) => {
    const normalizedQuery = rawQuery.trim();

    if (!normalizedQuery) {
      latestSearchIdRef.current += 1;
      setResults([]);
      setSelectedBook(null);
      setSearching(false);
      setFeedback(null);
      setShareCard(null);
      return;
    }

    const requestId = latestSearchIdRef.current + 1;
    latestSearchIdRef.current = requestId;

    if (dismissKeyboard) {
      Keyboard.dismiss();
    }

    setSearching(true);
    setFeedback(null);
    setShareCard(null);

    try {
      const books = await searchBooks(normalizedQuery, viewerId);

      if (requestId !== latestSearchIdRef.current) {
        return;
      }

      setResults(books);

      setSelectedBook((current) => {
        if (books.length === 0) {
          return null;
        }

        return current && books.some((book) => book.googleId === current.googleId)
          ? current
          : books[0];
      });

      if (books.length === 0) {
        setFeedback("Nenhum livro apareceu nessa busca.");
      }
    } catch (error) {
      if (requestId !== latestSearchIdRef.current) {
        return;
      }

      setFeedback(
        error instanceof Error ? error.message : "Nao foi possivel buscar livros agora."
      );
    } finally {
      if (requestId === latestSearchIdRef.current) {
        setSearching(false);
        if (hasFocus) {
          inputRef.current?.focus();
        }
      }
    }
  };

  useEffect(() => {
    if (!query || !hasFocus) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void runSearch(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query, hasFocus]);

  const registerActivity = async () => {
    if (!selectedBook) {
      setFeedback("Escolha um livro antes de publicar no mural.");
      return;
    }

    const normalizedReview = reviewText.trim();
    const normalizedReadAt = readAt.trim();

    Keyboard.dismiss();

    if (isFinishedLog && normalizedReadAt && !isValidReadDate(normalizedReadAt)) {
      setFeedback("Use a data no formato YYYY-MM-DD ao registrar uma leitura concluida.");
      return;
    }

    setSubmittingBookId(selectedBook.googleId);
    setFeedback(null);

    try {
      const response = await createActivity(viewerId, {
        book: selectedBook,
        type: selectedStatus,
        rating: isFinishedLog ? selectedRating : null,
        cardTheme: selectedTheme,
        reviewText: normalizedReview || undefined,
        readAt: isFinishedLog ? normalizedReadAt || undefined : undefined
      });

      setShareCard(response.shareCard);
      setFeedback(
        response.shareCard.cloudinaryUrl
          ? "Post publicado no mural e card enviado para Cloudinary."
          : "Post publicado no mural e card gerado localmente."
      );
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Nao foi possivel salvar a atividade."
      );
    } finally {
      setSubmittingBookId(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        title={t("search.title")}
      />

      <View style={styles.searchPanel}>
        <Text style={styles.panelLabel}>{t("search.searchRow")}</Text>
        <View style={styles.searchRow}>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setHasFocus(true)}
            onBlur={() => setHasFocus(false)}
            onSubmitEditing={() => void runSearch(query, true)}
            placeholder={t("search.searchPlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="search"
            style={styles.searchInput}
          />
          <Pressable
            style={[styles.searchButton, searching && styles.searchButtonDisabled]}
            disabled={searching || !query.trim()}
            onPress={() => void runSearch(query, false)}
          >
            <Text style={[styles.searchButtonText, searching && styles.searchButtonTextDisabled]}>
              {searching ? t("common.loading") : t("search.searchAction")}
            </Text>
          </Pressable>
        </View>
        <View style={styles.liveRow}>
          <Text style={styles.liveText}>{t("search.cardTheme")}: {activeThemeMeta.label}</Text>
          <Text style={styles.liveText}>
            {t("search.publishStatus")}: {t(`post.status.${selectedStatus}`)}
          </Text>
        </View>
      </View>

      {selectedBook ? (
        <View style={styles.composerPanel}>
          <View style={styles.composerHeader}>
            <Text style={styles.composerTitle}>{t("search.composeTitle")}</Text>
            <Text style={styles.composerHint}>{t("search.selectedBook")}</Text>
          </View>

          <View style={styles.selectedBookCard}>
            <BookCover uri={selectedBook.coverUrl} style={styles.selectedCover} />

            <View style={styles.selectedBookCopy}>
              <Text style={styles.selectedBookTitle}>{selectedBook.title}</Text>
              <Text style={styles.selectedBookAuthor}>{selectedBook.author}</Text>
              <Text style={styles.selectedBookMeta}>{t("search.noMetadata")}</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>{t("search.publishToWall")}</Text>
          <View style={styles.pillRow}>
            {(() => {
              const statusLabels = t("post.status", { returnObjects: true }) as Record<ActivityType, string>;
              return (Object.keys(statusLabels) as ActivityType[]).map((status) => {
                const active = status === selectedStatus;
                return (
                  <Pressable
                    key={status}
                    onPress={() => setSelectedStatus(status)}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {statusLabels[status]}
                    </Text>
                  </Pressable>
                );
              });
            })()}
          </View>

          {isFinishedLog ? (
            <>
              <Text style={styles.fieldLabel}>{t("search.rating")}</Text>
              <View style={styles.pillRow}>
                {ratingOptions.map((rating) => {
                  const active = rating === selectedRating;
                  return (
                    <Pressable
                      key={rating}
                      onPress={() => setSelectedRating(rating)}
                      style={[styles.ratingPill, active && styles.ratingPillActive]}
                    >
                      <Text
                        style={[
                          styles.ratingPillText,
                          active && styles.ratingPillTextActive
                        ]}
                      >
                        {rating}/5
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>{t("post.fields.review")}</Text>
          <TextInput
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            numberOfLines={4}
            placeholder={t("search.reviewPlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            style={styles.multilineInput}
          />

          {isFinishedLog ? (
            <>
              <Text style={styles.fieldLabel}>{t("search.finishDate")}</Text>
              <TextInput
                value={readAt}
                onChangeText={setReadAt}
                onSubmitEditing={Keyboard.dismiss}
                placeholder={t("search.datePlaceholder")}
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="done"
                style={styles.dateInput}
              />
            </>
          ) : null}

          <Text style={styles.fieldLabel}>{t("search.themeLabel")}</Text>
          <View style={styles.pillRow}>
            {CARD_THEMES.map((theme) => {
              const active = theme.key === selectedTheme;
              return (
                <Pressable
                  key={theme.key}
                  onPress={() => setSelectedTheme(theme.key)}
                  style={[
                    styles.pill,
                    active && styles.pillActive,
                    theme.premium && styles.pillPremium
                  ]}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {theme.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!viewerPremium && activeTheme?.premium ? (
            <Text style={styles.warningText}>
              {t("post.premiumWarning")}
            </Text>
          ) : null}

          <Pressable
            style={[
              styles.publishButton,
              submittingBookId === selectedBook.googleId && styles.publishButtonDisabled
            ]}
            disabled={submittingBookId === selectedBook.googleId}
            onPress={registerActivity}
          >
            <Text style={styles.publishButtonText}>
              {submittingBookId === selectedBook.googleId
                ? t("search.composeButtonLoading")
                : t("search.composeButton")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {feedback ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackText}>{feedback}</Text>
          {shareCard ? (
            <Pressable style={styles.feedbackAction} onPress={onPostCreated}>
              <Text style={styles.feedbackActionText}>{t("search.openWall")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {shareCard ? (
        <View style={styles.previewPanel}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>{t("search.previewTitle")}</Text>
            <Text style={styles.previewHint}>1080 x 1920</Text>
          </View>
          <Image source={{ uri: previewUri(shareCard) }} style={styles.storyPreview} />
        </View>
      ) : null}

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>{t("search.resultsTitle")}</Text>
        <Text style={styles.resultsMeta}>
          {results.length > 0
            ? t("search.resultsMeta", { count: results.length })
            : t("search.resultsEmpty")}
        </Text>
      </View>

      {results.map((book) => {
        const selected = selectedBook?.googleId === book.googleId;

        return (
          <Pressable
            key={book.googleId}
            onPress={() => {
              setSelectedBook(book);
              setFeedback(null);
              setShareCard(null);
            }}
            style={[styles.resultCard, selected && styles.resultCardSelected]}
          >
            <View style={styles.resultTop}>
              <BookCover uri={book.coverUrl} style={styles.cover} />

              <View style={styles.resultBody}>
                <Text style={styles.resultTitle}>{book.title}</Text>
                <Text style={styles.resultAuthor}>{book.author}</Text>
                <Text style={styles.resultMeta}>
                  {book.pageCount ? t("search.resultMeta", { count: book.pageCount }) : t("search.noMetadata")}
                  {book.categories[0] ? ` / ${book.categories[0]}` : ""}
                </Text>

                {book.amazonAffiliateLink ? (
                  <Text style={styles.resultSignal}>{t("feedEntry.purchaseLinkReady")}</Text>
                ) : null}

                {book.categories.length > 1 ? (
                  <Text style={styles.genreText}>{book.categories.join(" / ")}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.resultFooter}>
              <Text style={styles.resultFooterText}>
                {selected ? t("search.selectedToPublish") : t("search.touchToSelect")}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingBottom: 28
  },
  searchPanel: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  panelLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  searchRow: {
    gap: 10
  },
  searchInput: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  searchButton: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    paddingVertical: 14
  },
  searchButtonDisabled: {
    opacity: 0.5
  },
  searchButtonText: {
    color: "#101013",
    fontSize: 15,
    fontWeight: "900"
  },
  searchButtonTextDisabled: {
    color: COLORS.textMuted
  },
  liveRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
  },
  liveText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  composerPanel: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.borderStrong,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  composerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  composerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900"
  },
  composerHint: {
    color: COLORS.accentSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  selectedBookCard: {
    flexDirection: "row",
    gap: 14
  },
  selectedCover: {
    borderRadius: 18,
    height: 140,
    width: 96
  },
  selectedBookCopy: {
    flex: 1,
    gap: 8
  },
  selectedBookTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 25
  },
  selectedBookAuthor: {
    color: COLORS.textSoft,
    fontSize: 15
  },
  selectedBookMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  fieldLabel: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  pill: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  pillActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong
  },
  pillPremium: {
    borderColor: "rgba(216, 160, 95, 0.35)"
  },
  pillText: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: "800"
  },
  pillTextActive: {
    color: "#ffffff"
  },
  ratingPill: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  ratingPillActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.accentCool
  },
  ratingPillText: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: "800"
  },
  ratingPillTextActive: {
    color: "#ffffff"
  },
  multilineInput: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 15,
    minHeight: 112,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlignVertical: "top"
  },
  dateInput: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  warningText: {
    color: COLORS.warning,
    fontSize: 13,
    lineHeight: 18
  },
  publishButton: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    marginTop: 4,
    paddingVertical: 15
  },
  publishButtonDisabled: {
    opacity: 0.55
  },
  publishButtonText: {
    color: "#101013",
    fontSize: 15,
    fontWeight: "900"
  },
  feedbackCard: {
    backgroundColor: COLORS.successTint,
    borderColor: "rgba(122, 182, 133, 0.24)",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  feedbackText: {
    color: "#dff8e7",
    fontSize: 14,
    lineHeight: 20
  },
  feedbackAction: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(223, 248, 231, 0.24)",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  feedbackActionText: {
    color: "#f2fff5",
    fontSize: 13,
    fontWeight: "800"
  },
  previewPanel: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  previewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  previewTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  previewHint: {
    color: COLORS.textMuted,
    fontSize: 12
  },
  storyPreview: {
    alignSelf: "center",
    aspectRatio: 1080 / 1920,
    borderRadius: 22,
    height: 320,
    width: 180
  },
  resultsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  resultsTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  resultsMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    maxWidth: "58%",
    textAlign: "right"
  },
  resultCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  resultCardSelected: {
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.backgroundRaised
  },
  resultTop: {
    flexDirection: "row",
    gap: 14
  },
  cover: {
    borderRadius: 18,
    height: 154,
    width: 104
  },
  resultBody: {
    flex: 1,
    gap: 8
  },
  resultTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 25
  },
  resultAuthor: {
    color: COLORS.textSoft,
    fontSize: 15
  },
  resultMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  resultSignal: {
    color: COLORS.accentSoft,
    fontSize: 12,
    fontWeight: "700"
  },
  genreText: {
    color: COLORS.accentCool,
    fontSize: 12,
    lineHeight: 18
  },
  resultFooter: {
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: 12
  },
  resultFooterText: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: "800"
  }
});
