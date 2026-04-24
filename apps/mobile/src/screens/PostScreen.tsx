import { useEffect, useMemo, useState } from "react";
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

import { createActivity, searchBooks, updateActivity } from "../api/client";
import { BookCover } from "../components/BookCover";
import { SectionHeader } from "../components/SectionHeader";
import { CARD_THEMES } from "../config";
import { shareActivityCard } from "../lib/share-card";
import { COLORS, getCardThemeMeta } from "../theme";
import type {
  ActivityType,
  BookSearchResult,
  CardThemeName,
  ShareCardResult,
  StreakSnapshot,
  ViewerBookActivity
} from "../types";

const ratingOptions = [1, 2, 3, 4, 5];

const previewUri = (card: ShareCardResult | null) =>
  card ? `data:image/png;base64,${card.base64}` : undefined;

const isValidReadDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const buildMetaLine = (
  book: BookSearchResult,
  labels: {
    noMetadata: string;
    pages: (count: number) => string;
  }
) => {
  const parts: string[] = [];

  if (book.pageCount) {
    parts.push(labels.pages(book.pageCount));
  }

  if (book.categories[0]) {
    parts.push(book.categories[0]);
  }

  return parts.join("  /  ") || labels.noMetadata;
};

const starsText = (rating: number) =>
  `${"\u2605".repeat(rating)}${"\u2606".repeat(5 - rating)}`;

const buildStreakMessage = (
  streak: StreakSnapshot,
  labels: {
    single: string;
    many: (count: number) => string;
  }
) =>
  streak.currentStreak === 1 ? labels.single : labels.many(streak.currentStreak);

export const PostScreen = ({
  viewerId,
  viewerPremium,
  initialBook,
  initialActivity,
  onPostCreated,
  onRequestActivity
}: {
  viewerId: string;
  viewerPremium: boolean;
  initialBook?: BookSearchResult | null;
  initialActivity?: ViewerBookActivity | null;
  onPostCreated: (streak: StreakSnapshot) => void;
  onRequestActivity: () => void;
}) => {
  const { t } = useTranslation();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [query, setQuery] = useState(initialBook?.title ?? "");
  const [results, setResults] = useState<BookSearchResult[]>(initialBook ? [initialBook] : []);
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(initialBook ?? null);
  const [selectedTheme, setSelectedTheme] = useState<CardThemeName>(
    initialActivity?.cardTheme ?? "classic"
  );
  const [selectedStatus, setSelectedStatus] = useState<ActivityType>(
    initialActivity?.type ?? "lido"
  );
  const [selectedRating, setSelectedRating] = useState(initialActivity?.rating ?? 4);
  const [reviewText, setReviewText] = useState(initialActivity?.reviewText ?? "");
  const [showExcerptOnCard, setShowExcerptOnCard] = useState(
    initialActivity?.showExcerpt ?? true
  );
  const [readAt, setReadAt] = useState(initialActivity?.readAt?.slice(0, 10) ?? today);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [submittingBookId, setSubmittingBookId] = useState<string | null>(null);
  const [shareCard, setShareCard] = useState<ShareCardResult | null>(null);
  const [shareActivityId, setShareActivityId] = useState<string | null>(
    initialActivity?.activityId ?? null
  );
  const [streak, setStreak] = useState<StreakSnapshot | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(!initialBook);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(
    initialActivity?.activityId ?? null
  );

  const isEditing = Boolean(editingActivityId);
  const activeTheme = CARD_THEMES.find((theme) => theme.key === selectedTheme);
  const activeThemeMeta = getCardThemeMeta(selectedTheme);
  const isFinishedLog = selectedStatus === "lido";
  const statusButtonLabel: Record<ActivityType, string> = {
    quero_ler: t("post.status.wantToRead"),
    lendo: t("post.status.reading"),
    lido: t("post.status.finished"),
    abandonado: t("post.status.abandoned")
  };

  useEffect(() => {
    const nextBook = initialBook ?? null;
    const nextActivity = initialActivity ?? null;

    setQuery(nextBook?.title ?? "");
    setResults(nextBook ? [nextBook] : []);
    setSelectedBook(nextBook);
    setSelectedTheme(nextActivity?.cardTheme ?? "classic");
    setSelectedStatus(nextActivity?.type ?? "lido");
    setSelectedRating(nextActivity?.rating ?? 4);
    setReviewText(nextActivity?.reviewText ?? "");
    setShowExcerptOnCard(nextActivity?.showExcerpt ?? true);
    setReadAt(nextActivity?.readAt?.slice(0, 10) ?? today);
    setShareActivityId(nextActivity?.activityId ?? null);
    setEditingActivityId(nextActivity?.activityId ?? null);
    setShowSearchResults(!nextBook);
    setFeedback(null);
    setShareCard(null);
    setStreak(null);
    setShareError(null);
  }, [initialActivity?.activityId, initialBook?.googleId, today]);

  const resetShareState = () => {
    setFeedback(null);
    setShareCard(null);
    setShareActivityId(editingActivityId);
    setStreak(null);
    setShareError(null);
  };

  const handleSearch = async () => {
    Keyboard.dismiss();
    setSearching(true);
    resetShareState();

    try {
      const books = await searchBooks(query, viewerId);
      setResults(books);
      setShowSearchResults(true);

      if (books.length === 0) {
        setSelectedBook(null);
        setFeedback(t("post.errors.noResults"));
        return;
      }

      setSelectedBook((current) =>
        current && books.some((book) => book.googleId === current.googleId) ? current : books[0]
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t("post.errors.searchFailed"));
    } finally {
      setSearching(false);
    }
  };

  const submitActivity = async () => {
    if (!selectedBook) {
      setFeedback(t("post.errors.bookRequired"));
      return;
    }

    const normalizedReview = reviewText.trim();
    const normalizedReadAt = readAt.trim();

    Keyboard.dismiss();

    if (isFinishedLog && normalizedReadAt && !isValidReadDate(normalizedReadAt)) {
      setFeedback(t("post.errors.invalidDate"));
      return;
    }

    setSubmittingBookId(selectedBook.googleId);
    setFeedback(null);
    setShareError(null);

    try {
      const payload = {
        book: selectedBook,
        type: selectedStatus,
        rating: isFinishedLog ? selectedRating : null,
        cardTheme: selectedTheme,
        showExcerpt: showExcerptOnCard,
        reviewText: normalizedReview || undefined,
        readAt: isFinishedLog ? normalizedReadAt || undefined : undefined
      };

      const response =
        isEditing && editingActivityId
          ? await updateActivity(viewerId, editingActivityId, payload)
          : await createActivity(viewerId, payload);

      setEditingActivityId(response.activity.id);
      setShareCard(response.shareCard);
      setShareActivityId(response.activity.id);
      setStreak(response.streak);
      setFeedback(t(isEditing ? "post.feedback.updated" : "post.feedback.created"));
      onPostCreated(response.streak);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t("post.errors.saveFailed"));
    } finally {
      setSubmittingBookId(null);
    }
  };

  const handleInstagramShare = async () => {
    if (!shareActivityId) {
      return;
    }

    setSharing(true);
    setShareError(null);

    try {
      await shareActivityCard(shareActivityId);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : t("post.errors.shareFailed"));
    } finally {
      setSharing(false);
    }
  };

  const selectBook = (book: BookSearchResult) => {
    setSelectedBook(book);
    setShowSearchResults(false);
    resetShareState();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        eyebrow={t("post.eyebrow")}
        title={isEditing ? t("post.titleEdit") : t("post.titleCreate")}
      />

      <View style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>{t("post.stepOne")}</Text>
          <Text style={styles.stepTitle}>{t("post.pickBookTitle")}</Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder={t("post.searchPlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="search"
            style={styles.searchInput}
          />
          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>
              {searching ? t("post.searching") : t("post.searchAction")}
            </Text>
          </Pressable>
        </View>

        {selectedBook ? (
          <View style={styles.selectedBookCard}>
            <BookCover uri={selectedBook.coverUrl} style={styles.selectedCover} />

            <View style={styles.selectedBookCopy}>
              <Text style={styles.selectedBookTitle}>{selectedBook.title}</Text>
              <Text style={styles.selectedBookAuthor}>{selectedBook.author}</Text>
              <Text style={styles.selectedBookMeta}>
                {buildMetaLine(selectedBook, {
                  noMetadata: t("post.noMetadata"),
                  pages: (count) => t("post.pages", { count })
                })}
              </Text>
              <Pressable
                style={styles.changeBookButton}
                onPress={() => setShowSearchResults((current) => !current)}
              >
                <Text style={styles.changeBookButtonText}>
                  {showSearchResults ? t("post.hideResults") : t("post.changeBook")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={styles.helpText}>{t("post.searchHelp")}</Text>
        )}

        {showSearchResults ? (
          <View style={styles.resultsBlock}>
            <Text style={styles.resultsLabel}>
              {results.length > 0
                ? t("post.resultCount", { count: results.length })
                : t("post.noResultsYet")}
            </Text>

            {results.map((book) => {
              const active = selectedBook?.googleId === book.googleId;

              return (
                <Pressable
                  key={book.googleId}
                  onPress={() => selectBook(book)}
                  style={[styles.resultCard, active && styles.resultCardActive]}
                >
                  <View style={styles.resultTop}>
                    <BookCover uri={book.coverUrl} style={styles.resultCover} />

                    <View style={styles.resultCopy}>
                      <Text style={styles.resultTitle}>{book.title}</Text>
                      <Text style={styles.resultAuthor}>{book.author}</Text>
                      <Text style={styles.resultMeta}>
                        {buildMetaLine(book, {
                          noMetadata: t("post.noMetadata"),
                          pages: (count) => t("post.pages", { count })
                        })}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {selectedBook ? (
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepNumber}>{t("post.stepTwo")}</Text>
            <Text style={styles.stepTitle}>
              {isEditing ? t("post.editActivityTitle") : t("post.recordActivityTitle")}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>{t("post.fields.status")}</Text>
          <View style={styles.segmentRow}>
            {(Object.keys(statusButtonLabel) as ActivityType[]).map((status) => {
              const active = status === selectedStatus;

              return (
                <Pressable
                  key={status}
                  onPress={() => setSelectedStatus(status)}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {statusButtonLabel[status]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isFinishedLog ? (
            <>
              <Text style={styles.fieldLabel}>{t("post.fields.rating")}</Text>
              <View style={styles.ratingRow}>
                {ratingOptions.map((rating) => {
                  const active = rating === selectedRating;

                  return (
                    <Pressable
                      key={rating}
                      onPress={() => setSelectedRating(rating)}
                      style={[styles.ratingButton, active && styles.ratingButtonActive]}
                    >
                      <Text style={[styles.ratingStars, active && styles.ratingStarsActive]}>
                        {starsText(rating)}
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
            placeholder={t("post.reviewPlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            style={styles.multilineInput}
          />

          <Pressable
            onPress={() => setShowExcerptOnCard((current) => !current)}
            style={[styles.toggleCard, showExcerptOnCard && styles.toggleCardActive]}
          >
            <View style={[styles.toggleDot, showExcerptOnCard && styles.toggleDotActive]} />
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>{t("post.excerptTitle")}</Text>
              <Text style={styles.toggleText}>
                {showExcerptOnCard ? t("post.excerptOn") : t("post.excerptOff")}
              </Text>
            </View>
          </Pressable>

          {isFinishedLog ? (
            <>
              <Text style={styles.fieldLabel}>{t("post.fields.date")}</Text>
              <TextInput
                value={readAt}
                onChangeText={setReadAt}
                onSubmitEditing={Keyboard.dismiss}
                placeholder="2026-04-20"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="done"
                style={styles.dateInput}
              />
            </>
          ) : null}

          <Text style={styles.fieldLabel}>{t("post.fields.theme")}</Text>
          <View style={styles.themeRow}>
            {CARD_THEMES.map((theme) => {
              const active = theme.key === selectedTheme;

              return (
                <Pressable
                  key={theme.key}
                  onPress={() => setSelectedTheme(theme.key)}
                  style={[
                    styles.themeChip,
                    active && styles.themeChipActive,
                    theme.premium && styles.themeChipPremium
                  ]}
                >
                  <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                    {theme.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t("post.summaryTitle")}</Text>
            <Text style={styles.summaryText}>
              {t("post.summaryStatus", { status: statusButtonLabel[selectedStatus] })}
            </Text>
            <Text style={styles.summaryText}>
              {t("post.summaryCard", {
                theme: activeThemeMeta.label,
                rating: isFinishedLog ? `${selectedRating}/5` : t("post.summaryNoRating")
              })}
            </Text>
          </View>

          {!viewerPremium && activeTheme?.premium ? (
            <Text style={styles.warningText}>{t("post.premiumWarning")}</Text>
          ) : null}

          <Pressable
            style={[
              styles.publishButton,
              submittingBookId === selectedBook.googleId && styles.publishButtonDisabled
            ]}
            disabled={submittingBookId === selectedBook.googleId}
            onPress={submitActivity}
          >
            <Text style={styles.publishButtonText}>
              {submittingBookId === selectedBook.googleId
                ? t("post.saving")
                : isEditing
                  ? t("post.saveChanges")
                  : t("post.publish")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {feedback ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackText}>{feedback}</Text>
          {streak ? (
            <Text style={styles.feedbackSubtext}>
              {buildStreakMessage(streak, {
                single: t("post.streak.single"),
                many: (count) => t("post.streak.many", { count })
              })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {shareCard && shareActivityId ? (
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepNumber}>{t("post.stepThree")}</Text>
            <Text style={styles.stepTitle}>{t("post.shareTitle")}</Text>
          </View>

          <Text style={styles.helpText}>{t("post.shareHelp")}</Text>

          <View style={styles.shareActions}>
            <Pressable
              style={[styles.storyButton, sharing && styles.shareButtonDisabled]}
              disabled={sharing}
              onPress={() => void handleInstagramShare()}
            >
              <Text style={styles.storyButtonText}>
                {sharing ? t("post.sharing") : t("post.shareInstagram")}
              </Text>
            </Pressable>
            <Pressable style={styles.shareButton} onPress={onRequestActivity}>
              <Text style={styles.shareButtonText}>{t("post.viewActivity")}</Text>
            </Pressable>
          </View>

          {shareError ? <Text style={styles.errorText}>{shareError}</Text> : null}

          <View style={styles.previewPanel}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>{t("post.previewTitle")}</Text>
              <Text style={styles.previewHint}>1080 x 1920</Text>
            </View>
            <Image source={{ uri: previewUri(shareCard) }} style={styles.storyPreview} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingBottom: 28
  },
  stepCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 18
  },
  stepHeader: {
    gap: 4
  },
  stepNumber: {
    color: COLORS.accentSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900"
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
  searchButtonText: {
    color: "#101013",
    fontSize: 15,
    fontWeight: "900"
  },
  helpText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  selectedBookCard: {
    flexDirection: "row",
    gap: 14
  },
  selectedCover: {
    borderRadius: 18,
    height: 148,
    width: 102
  },
  selectedBookCopy: {
    flex: 1,
    gap: 8
  },
  selectedBookTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26
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
  changeBookButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  changeBookButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800"
  },
  resultsBlock: {
    gap: 12
  },
  resultsLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  resultCard: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14
  },
  resultCardActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong
  },
  resultTop: {
    flexDirection: "row",
    gap: 12
  },
  resultCover: {
    borderRadius: 16,
    height: 122,
    width: 82
  },
  resultCopy: {
    flex: 1,
    gap: 8
  },
  resultTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22
  },
  resultAuthor: {
    color: COLORS.textSoft,
    fontSize: 14
  },
  resultMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  fieldLabel: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  segmentButton: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  segmentButtonActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong
  },
  segmentText: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: "#ffffff"
  },
  ratingRow: {
    gap: 10
  },
  ratingButton: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  ratingButtonActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.accent
  },
  ratingStars: {
    color: COLORS.textMuted,
    fontSize: 18,
    fontWeight: "800"
  },
  ratingStarsActive: {
    color: COLORS.accentSoft
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
  toggleCard: {
    alignItems: "center",
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  toggleCardActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong
  },
  toggleDot: {
    backgroundColor: COLORS.panelMuted,
    borderRadius: 999,
    height: 14,
    width: 14
  },
  toggleDotActive: {
    backgroundColor: COLORS.accent
  },
  toggleCopy: {
    flex: 1,
    gap: 4
  },
  toggleTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900"
  },
  toggleText: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18
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
  themeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  themeChip: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  themeChipActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong
  },
  themeChipPremium: {
    borderColor: "rgba(216, 160, 95, 0.35)"
  },
  themeChipText: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: "800"
  },
  themeChipTextActive: {
    color: "#ffffff"
  },
  summaryCard: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    padding: 14
  },
  summaryTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900"
  },
  summaryText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18
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
    padding: 16
  },
  feedbackText: {
    color: "#dff8e7",
    fontSize: 14,
    lineHeight: 20
  },
  feedbackSubtext: {
    color: "#bfe8cb",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8
  },
  shareActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  storyButton: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    minWidth: 228,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  storyButtonText: {
    color: "#101013",
    fontSize: 13,
    fontWeight: "900"
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 118,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  shareButtonDisabled: {
    opacity: 0.55
  },
  shareButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800"
  },
  errorText: {
    color: "#ffd8d8",
    fontSize: 13,
    lineHeight: 19
  },
  previewPanel: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  previewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  previewTitle: {
    color: COLORS.text,
    fontSize: 17,
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
  }
});
