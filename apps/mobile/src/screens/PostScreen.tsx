import { useEffect, useState } from "react";
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

import { createActivity, searchBooks } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import { CARD_THEMES } from "../config";
import { shareActivityCard } from "../lib/share-card";
import { COLORS, getCardThemeMeta } from "../theme";
import type {
  ActivityType,
  BookSearchResult,
  CardThemeName,
  ShareCardResult,
  StreakSnapshot
} from "../types";

const statusButtonLabel: Record<ActivityType, string> = {
  quero_ler: "Quero ler",
  lendo: "Lendo",
  lido: "Terminei",
  abandonado: "Abandonei"
};

const ratingOptions = [1, 2, 3, 4, 5];

const previewUri = (card: ShareCardResult | null) =>
  card ? `data:image/png;base64,${card.base64}` : undefined;

const isValidReadDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const buildMetaLine = (book: BookSearchResult) => {
  const parts = [];

  if (book.pageCount) {
    parts.push(`${book.pageCount} páginas`);
  }

  if (book.categories[0]) {
    parts.push(book.categories[0]);
  }

  return parts.join("  /  ") || "Sem metadados";
};

const starsText = (rating: number) =>
  `${"\u2605".repeat(rating)}${"\u2606".repeat(5 - rating)}`;

const buildStreakMessage = (streak: StreakSnapshot) =>
  streak.currentStreak === 1
    ? "Ofensiva atual: 1 dia."
    : `Ofensiva atual: ${streak.currentStreak} dias.`;

export const PostScreen = ({
  viewerId,
  viewerPremium,
  initialBook,
  onPostCreated,
  onRequestActivity
}: {
  viewerId: string;
  viewerPremium: boolean;
  initialBook?: BookSearchResult | null;
  onPostCreated: (streak: StreakSnapshot) => void;
  onRequestActivity: () => void;
}) => {
  const [query, setQuery] = useState(initialBook?.title ?? "Dom Casmurro");
  const [results, setResults] = useState<BookSearchResult[]>(initialBook ? [initialBook] : []);
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(initialBook ?? null);
  const [selectedTheme, setSelectedTheme] = useState<CardThemeName>("classic");
  const [selectedStatus, setSelectedStatus] = useState<ActivityType>("lido");
  const [selectedRating, setSelectedRating] = useState(4);
  const [reviewText, setReviewText] = useState("");
  const [showExcerptOnCard, setShowExcerptOnCard] = useState(true);
  const [readAt, setReadAt] = useState(new Date().toISOString().slice(0, 10));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [submittingBookId, setSubmittingBookId] = useState<string | null>(null);
  const [shareCard, setShareCard] = useState<ShareCardResult | null>(null);
  const [shareActivityId, setShareActivityId] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakSnapshot | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(!initialBook);

  const activeTheme = CARD_THEMES.find((theme) => theme.key === selectedTheme);
  const activeThemeMeta = getCardThemeMeta(selectedTheme);
  const isFinishedLog = selectedStatus === "lido";

  useEffect(() => {
    if (!initialBook) {
      return;
    }

    setQuery(initialBook.title);
    setSelectedBook(initialBook);
    setShowSearchResults(false);
    setResults((current) => {
      if (current.some((book) => book.googleId === initialBook.googleId)) {
        return current;
      }

      return [initialBook, ...current];
    });
  }, [initialBook]);

  const resetShareState = () => {
    setFeedback(null);
    setShareCard(null);
    setShareActivityId(null);
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
        setFeedback("Nenhum livro apareceu nessa busca.");
        return;
      }

      setSelectedBook((current) =>
        current && books.some((book) => book.googleId === current.googleId) ? current : books[0]
      );
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível buscar livros agora."
      );
    } finally {
      setSearching(false);
    }
  };

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
    setShareError(null);

    try {
      const response = await createActivity(viewerId, {
        book: selectedBook,
        type: selectedStatus,
        rating: isFinishedLog ? selectedRating : null,
        cardTheme: selectedTheme,
        showExcerpt: showExcerptOnCard,
        reviewText: normalizedReview || undefined,
        readAt: isFinishedLog ? normalizedReadAt || undefined : undefined
      });

      setShareCard(response.shareCard);
      setShareActivityId(response.activity.id);
      setStreak(response.streak);
      setFeedback(`Leitura publicada. ${buildStreakMessage(response.streak)}`);
      onPostCreated(response.streak);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível salvar a atividade."
      );
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
      setShareError(
        error instanceof Error ? error.message : "Não foi possível compartilhar o card."
      );
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
      <SectionHeader eyebrow="Postar" title="Avaliar livro" />

      <View style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>Passo 1</Text>
          <Text style={styles.stepTitle}>Escolha o livro</Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="Título, autor ou ISBN"
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="search"
            style={styles.searchInput}
          />
          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>{searching ? "Buscando..." : "Buscar"}</Text>
          </Pressable>
        </View>

        {selectedBook ? (
          <View style={styles.selectedBookCard}>
            {selectedBook.coverUrl ? (
              <Image source={{ uri: selectedBook.coverUrl }} style={styles.selectedCover} />
            ) : (
              <View style={[styles.selectedCover, styles.coverFallback]}>
                <Text style={styles.coverFallbackText}>SEM CAPA</Text>
              </View>
            )}

            <View style={styles.selectedBookCopy}>
              <Text style={styles.selectedBookTitle}>{selectedBook.title}</Text>
              <Text style={styles.selectedBookAuthor}>{selectedBook.author}</Text>
              <Text style={styles.selectedBookMeta}>{buildMetaLine(selectedBook)}</Text>
              <Pressable
                style={styles.changeBookButton}
                onPress={() => setShowSearchResults((current) => !current)}
              >
                <Text style={styles.changeBookButtonText}>
                  {showSearchResults ? "Esconder resultados" : "Trocar livro"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={styles.helpText}>Busque um livro.</Text>
        )}

        {showSearchResults ? (
          <View style={styles.resultsBlock}>
            <Text style={styles.resultsLabel}>
              {results.length > 0
                ? `${results.length} resultados para escolher`
                : "Nenhum resultado carregado ainda"}
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
                    {book.coverUrl ? (
                      <Image source={{ uri: book.coverUrl }} style={styles.resultCover} />
                    ) : (
                      <View style={[styles.resultCover, styles.coverFallback]}>
                        <Text style={styles.coverFallbackText}>SEM CAPA</Text>
                      </View>
                    )}

                    <View style={styles.resultCopy}>
                      <Text style={styles.resultTitle}>{book.title}</Text>
                      <Text style={styles.resultAuthor}>{book.author}</Text>
                      <Text style={styles.resultMeta}>{buildMetaLine(book)}</Text>
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
            <Text style={styles.stepNumber}>Passo 2</Text>
            <Text style={styles.stepTitle}>Registre a leitura</Text>
          </View>

          <Text style={styles.fieldLabel}>Status</Text>
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
              <Text style={styles.fieldLabel}>Nota</Text>
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

          <Text style={styles.fieldLabel}>Review</Text>
          <TextInput
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            numberOfLines={4}
            placeholder="Escreva sua impressao curta ou deixe sem review."
            placeholderTextColor={COLORS.textMuted}
            style={styles.multilineInput}
          />

          <Pressable
            onPress={() => setShowExcerptOnCard((current) => !current)}
            style={[styles.toggleCard, showExcerptOnCard && styles.toggleCardActive]}
          >
            <View style={[styles.toggleDot, showExcerptOnCard && styles.toggleDotActive]} />
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Mostrar trecho no card</Text>
              <Text style={styles.toggleText}>
                {showExcerptOnCard
                  ? "O bloco TRECHO vai aparecer no story."
                  : "O story sai mais limpo, sem o bloco TRECHO."}
              </Text>
            </View>
          </Pressable>

          {isFinishedLog ? (
            <>
              <Text style={styles.fieldLabel}>Data</Text>
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

          <Text style={styles.fieldLabel}>Tema do card</Text>
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
            <Text style={styles.summaryTitle}>Resumo do post</Text>
            <Text style={styles.summaryText}>Status: {statusButtonLabel[selectedStatus]}</Text>
            <Text style={styles.summaryText}>
              Card: {activeThemeMeta.label}
              {isFinishedLog ? `  /  Nota: ${selectedRating}/5` : ""}
            </Text>
          </View>

          {!viewerPremium && activeTheme?.premium ? (
            <Text style={styles.warningText}>
              Os temas premium continuam bloqueados para perfis basicos.
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
                ? "Publicando..."
                : "Salvar avaliação e publicar"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {feedback ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackText}>{feedback}</Text>
          {streak ? <Text style={styles.feedbackSubtext}>{buildStreakMessage(streak)}</Text> : null}
        </View>
      ) : null}

      {shareCard && shareActivityId ? (
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepNumber}>Passo 3</Text>
            <Text style={styles.stepTitle}>Compartilhe o card</Text>
          </View>

          <Text style={styles.helpText}>O card foi gerado e esta pronto para o share nativo.</Text>

          <View style={styles.shareActions}>
            <Pressable
              style={[styles.storyButton, sharing && styles.shareButtonDisabled]}
              disabled={sharing}
              onPress={() => void handleInstagramShare()}
            >
              <Text style={styles.storyButtonText}>
                {sharing ? "Compartilhando..." : "Compartilhar no Instagram"}
              </Text>
            </Pressable>
            <Pressable style={styles.shareButton} onPress={onRequestActivity}>
              <Text style={styles.shareButtonText}>Ver no mural</Text>
            </Pressable>
          </View>

          {shareError ? <Text style={styles.errorText}>{shareError}</Text> : null}

          <View style={styles.previewPanel}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Preview do story</Text>
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
