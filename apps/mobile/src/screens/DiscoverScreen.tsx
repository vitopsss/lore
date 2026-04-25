import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { loadFeaturedBooks, searchBooks } from "../api/client";
import { BookCover } from "../components/BookCover";
import { SectionHeader } from "../components/SectionHeader";
import { SubTabBar } from "../components/SubTabBar";
import { getPreferredCatalogLanguage } from "../lib/catalog-language";
import { COLORS } from "../theme";
import type { BookSearchResult, CatalogSearchFilters } from "../types";

type BrowseView = "home" | "release_decade" | "release_year" | "taxonomy" | "service" | "results";
type TaxonomyKey = "genre" | "country" | "language";
type ReleaseDecade = {
  label: string;
  startYear: number;
  endYear: number;
};

const SEARCH_DEBOUNCE_MS = 500;

const buildMetaLine = (
  book: BookSearchResult,
  labels: {
    pages: (count: number) => string;
    noMetadata: string;
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

export const DiscoverScreen = ({
  viewerId,
  onPickBook
}: {
  viewerId: string;
  onPickBook: (book: BookSearchResult) => void;
}) => {
  const { i18n, t } = useTranslation();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<BrowseView>("home");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [popularBooks, setPopularBooks] = useState<BookSearchResult[]>([]);
  const [anticipatedBooks, setAnticipatedBooks] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultsTitle, setResultsTitle] = useState(t("discover.results"));
  const [previousView, setPreviousView] = useState<BrowseView>("home");
  const [selectedDecade, setSelectedDecade] = useState<ReleaseDecade | null>(null);
  const [taxonomyTab, setTaxonomyTab] = useState<TaxonomyKey>("genre");
  const latestResultsRequestIdRef = useRef(0);
  const hasTypedQueryRef = useRef(false);
  const preferredLanguage = getPreferredCatalogLanguage();

  const genreOptions = useMemo(
    () => [
      t("discover.options.genre.romance"),
      t("discover.options.genre.fantasy"),
      t("discover.options.genre.thriller"),
      t("discover.options.genre.history"),
      t("discover.options.genre.nonFiction"),
      t("discover.options.genre.classics")
    ],
    [t]
  );

  const countryOptions = useMemo(
    () => [
      t("discover.options.country.brazil"),
      t("discover.options.country.unitedStates"),
      t("discover.options.country.japan"),
      t("discover.options.country.france"),
      t("discover.options.country.argentina"),
      t("discover.options.country.portugal")
    ],
    [t]
  );

  const languageOptions = useMemo(
    () => [
      { label: t("discover.options.language.portuguese"), value: "pt" },
      { label: t("discover.options.language.english"), value: "en" },
      { label: t("discover.options.language.spanish"), value: "es" },
      { label: t("discover.options.language.french"), value: "fr" }
    ],
    [t]
  );

  const serviceOptions = useMemo(
    () => [
      { label: t("discover.options.service.googleBooks"), value: "google" },
      { label: t("discover.options.service.openLibrary"), value: "open_library" }
    ],
    [t]
  );

  const taxonomyTabs = useMemo<Array<{ key: TaxonomyKey; label: string }>>(
    () => [
      { key: "genre", label: t("discover.taxonomy.genre") },
      { key: "country", label: t("discover.taxonomy.country") },
      { key: "language", label: t("discover.taxonomy.language") }
    ],
    [t]
  );

  const releaseDecades = useMemo<ReleaseDecade[]>(
    () => [
      { label: "2020s", startYear: 2020, endYear: 2026 },
      { label: "2010s", startYear: 2010, endYear: 2019 },
      { label: "2000s", startYear: 2000, endYear: 2009 },
      { label: "1990s", startYear: 1990, endYear: 1999 },
      { label: "1980s", startYear: 1980, endYear: 1989 }
    ],
    []
  );

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      setError(null);

      const [popularResult, anticipatedResult] = await Promise.allSettled([
        loadFeaturedBooks(viewerId, preferredLanguage, "popular"),
        loadFeaturedBooks(viewerId, preferredLanguage, "anticipated")
      ]);

      setPopularBooks(popularResult.status === "fulfilled" ? popularResult.value.slice(0, 12) : []);
      setAnticipatedBooks(
        anticipatedResult.status === "fulfilled" ? anticipatedResult.value.slice(0, 12) : []
      );

      if (popularResult.status === "rejected" && anticipatedResult.status === "rejected") {
        setError(t("discover.errors.loadBrowseFailed"));
      }

      setLoading(false);
    };

    void loadInitial();
  }, [i18n.language, preferredLanguage, viewerId]);

  const yearsForSelectedDecade = useMemo(() => {
    if (!selectedDecade) {
      return [];
    }

    return Array.from(
      { length: selectedDecade.endYear - selectedDecade.startYear + 1 },
      (_, index) => String(selectedDecade.endYear - index)
    );
  }, [selectedDecade]);

  const openResults = async ({
    dismissKeyboard = true,
    title,
    nextPreviousView,
    load
  }: {
    dismissKeyboard?: boolean;
    title: string;
    nextPreviousView: BrowseView;
    load: () => Promise<BookSearchResult[]> | BookSearchResult[];
  }) => {
    const requestId = latestResultsRequestIdRef.current + 1;
    latestResultsRequestIdRef.current = requestId;

    if (dismissKeyboard) {
      Keyboard.dismiss();
    }

    setLoading(true);
    setError(null);
    setResultsTitle(title);
    setPreviousView(nextPreviousView);
    setView("results");

    try {
      const payload = await load();

      if (requestId !== latestResultsRequestIdRef.current) {
        return;
      }

      setResults(payload);
    } catch (caughtError) {
      if (requestId !== latestResultsRequestIdRef.current) {
        return;
      }

      setResults([]);
      setError(
        caughtError instanceof Error ? caughtError.message : t("discover.errors.loadSelectionFailed")
      );
    } finally {
      if (requestId === latestResultsRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const performTextSearch = async () => {
    const normalizedQuery = query.trim();

    await openResults({
      title: normalizedQuery
        ? t("discover.searchResultsTitle", { query: normalizedQuery })
        : t("discover.searchResultsFallback"),
      nextPreviousView: "home",
      load: () => searchBooks(query, viewerId)
    });
  };

  useEffect(() => {
    if (!hasTypedQueryRef.current) {
      return;
    }

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      latestResultsRequestIdRef.current += 1;
      setResults([]);
      setError(null);
      setLoading(false);
      setResultsTitle(t("discover.results"));

      if (view === "results" && previousView === "home") {
        setView("home");
      }

      return;
    }

    const timeoutId = setTimeout(() => {
      void openResults({
        dismissKeyboard: false,
        title: t("discover.searchResultsTitle", { query: normalizedQuery }),
        nextPreviousView: "home",
        load: () => searchBooks(normalizedQuery, viewerId)
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [i18n.language, previousView, query, view, viewerId]);

  const openTaxonomyResults = async (key: TaxonomyKey, value: string, label: string) => {
    const filters: CatalogSearchFilters =
      key === "genre"
        ? { genre: value }
        : key === "country"
          ? { country: value }
          : { language: value };

    await openResults({
      title: label,
      nextPreviousView: "taxonomy",
      load: () => searchBooks("", viewerId, filters)
    });
  };

  const renderResults = () => (
    <>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{resultsTitle}</Text>
        <Text style={styles.resultsMeta}>
          {loading
            ? t("discover.resultsUpdating")
            : t("discover.resultsCount", { count: results.length })}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && results.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t("discover.noResults")}</Text>
        </View>
      ) : null}

      {results.map((book) => (
        <Pressable key={book.googleId} onPress={() => onPickBook(book)} style={styles.resultCard}>
          <View style={styles.resultTop}>
            <BookCover uri={book.coverUrl} style={styles.cover} />

            <View style={styles.resultBody}>
              <Text style={styles.resultTitle}>{book.title}</Text>
              <Text style={styles.resultAuthor}>{book.author}</Text>
              <Text style={styles.resultMeta}>
                {buildMetaLine(book, {
                  pages: (count) => t("discover.pages", { count }),
                  noMetadata: t("discover.noMetadata")
                })}
              </Text>
              {book.categories.length > 1 ? (
                <Text style={styles.genreText}>{book.categories.join(" / ")}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.resultFooter}>
            <Text style={styles.resultFooterText}>{t("discover.openDetails")}</Text>
          </View>
        </Pressable>
      ))}
    </>
  );

  const renderBrowseHome = () => (
    <>
      <View style={styles.searchPanel}>
        <Text style={styles.blockEyebrow}>{t("discover.searchTitle")}</Text>
        <TextInput
          value={query}
          onChangeText={(value) => {
            hasTypedQueryRef.current = true;
            setQuery(value);
          }}
          onSubmitEditing={() => void performTextSearch()}
          placeholder={t("discover.searchPlaceholder")}
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
          style={styles.searchInput}
        />
        <Pressable style={styles.searchButton} onPress={() => void performTextSearch()}>
          <Text style={styles.searchButtonText}>{t("discover.searchAction")}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{t("discover.browseTitle")}</Text>
      </View>

      <View style={styles.browseGrid}>
        <Pressable
          style={styles.browseCard}
          onPress={() =>
            void openResults({
              title: t("discover.cards.popular.title"),
              nextPreviousView: "home",
              load: () => popularBooks
            })
          }
        >
          <Text style={styles.browseTitle}>{t("discover.cards.popular.title")}</Text>
          <Text style={styles.browseText}>{t("discover.cards.popular.text")}</Text>
        </Pressable>

        <Pressable
          style={styles.browseCard}
          onPress={() =>
            void openResults({
              title: t("discover.cards.anticipated.title"),
              nextPreviousView: "home",
              load: () => anticipatedBooks
            })
          }
        >
          <Text style={styles.browseTitle}>{t("discover.cards.anticipated.title")}</Text>
          <Text style={styles.browseText}>{t("discover.cards.anticipated.text")}</Text>
        </Pressable>

        <Pressable style={styles.browseCard} onPress={() => setView("release_decade")}>
          <Text style={styles.browseTitle}>{t("discover.cards.release.title")}</Text>
          <Text style={styles.browseText}>{t("discover.cards.release.text")}</Text>
        </Pressable>

        <Pressable style={styles.browseCard} onPress={() => setView("taxonomy")}>
          <Text style={styles.browseTitle}>{t("discover.cards.taxonomy.title")}</Text>
          <Text style={styles.browseText}>{t("discover.cards.taxonomy.text")}</Text>
        </Pressable>

        <Pressable style={styles.browseCard} onPress={() => setView("service")}>
          <Text style={styles.browseTitle}>{t("discover.cards.service.title")}</Text>
          <Text style={styles.browseText}>{t("discover.cards.service.text")}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{t("home.weeklyBooks")}</Text>
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={styles.railRow}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
      >
        {popularBooks.map((book) => (
          <Pressable key={book.googleId} onPress={() => onPickBook(book)} style={styles.railCard}>
            <BookCover uri={book.coverUrl} style={styles.railCover} />
            <Text style={styles.railTitle} numberOfLines={2}>
              {book.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );

  const renderReleaseDecades = () => (
    <View style={styles.selectionGroup}>
      <Text style={styles.sectionTitle}>{t("discover.chooseDecade")}</Text>
      {releaseDecades.map((decade) => (
        <Pressable
          key={decade.label}
          style={styles.selectionCard}
          onPress={() => {
            setSelectedDecade(decade);
            setView("release_year");
          }}
        >
          <Text style={styles.selectionTitle}>{decade.label}</Text>
          <Text style={styles.selectionText}>
            {decade.startYear} - {decade.endYear}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const renderReleaseYears = () => (
    <View style={styles.selectionGroup}>
      <Text style={styles.sectionTitle}>{selectedDecade?.label}</Text>
      <View style={styles.yearGrid}>
        {yearsForSelectedDecade.map((year) => (
          <Pressable
            key={year}
            style={styles.yearCard}
            onPress={() =>
              void openResults({
                title: year,
                nextPreviousView: "release_year",
                load: () => searchBooks("", viewerId, { releaseDate: year })
              })
            }
          >
            <Text style={styles.yearText}>{year}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderTaxonomy = () => {
    const options =
      taxonomyTab === "genre"
        ? genreOptions.map((option) => ({ label: option, value: option }))
        : taxonomyTab === "country"
          ? countryOptions.map((option) => ({ label: option, value: option }))
          : languageOptions;

    return (
      <View style={styles.selectionGroup}>
        <SubTabBar options={taxonomyTabs} value={taxonomyTab} onChange={setTaxonomyTab} />
        {options.map((option) => (
          <Pressable
            key={option.value}
            style={styles.selectionCard}
            onPress={() => void openTaxonomyResults(taxonomyTab, option.value, option.label)}
          >
            <Text style={styles.selectionTitle}>{option.label}</Text>
            <Text style={styles.selectionText}>{t("discover.openRelated")}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderServices = () => (
    <View style={styles.selectionGroup}>
      <Text style={styles.sectionTitle}>{t("discover.chooseService")}</Text>
      {serviceOptions.map((option) => (
        <Pressable
          key={option.value}
          style={styles.selectionCard}
          onPress={() =>
            void openResults({
              title: option.label,
              nextPreviousView: "service",
              load: () => searchBooks("", viewerId, { service: option.value })
            })
          }
        >
          <Text style={styles.selectionTitle}>{option.label}</Text>
          <Text style={styles.selectionText}>{t("discover.openCatalog")}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader title={t("discover.title")} />

      {view !== "home" ? (
        <Pressable
          style={styles.backButton}
          onPress={() => {
            if (view === "results") {
              setView(previousView);
              return;
            }

            if (view === "release_year") {
              setView("release_decade");
              return;
            }

            setView("home");
          }}
        >
          <Text style={styles.backButtonText}>{t("discover.back")}</Text>
        </Pressable>
      ) : null}

      {view === "home" ? renderBrowseHome() : null}
      {view === "release_decade" ? renderReleaseDecades() : null}
      {view === "release_year" ? renderReleaseYears() : null}
      {view === "taxonomy" ? renderTaxonomy() : null}
      {view === "service" ? renderServices() : null}
      {view === "results" ? renderResults() : null}
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
  blockEyebrow: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
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
  backButton: {
    alignSelf: "flex-start",
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
  browseGrid: {
    gap: 12
  },
  browseCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 18
  },
  browseTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  browseText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  railRow: {
    gap: 12,
    paddingRight: 10
  },
  railCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 12,
    width: 156
  },
  railCover: {
    borderRadius: 16,
    height: 206,
    width: "100%"
  },
  railTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18
  },
  selectionGroup: {
    gap: 12
  },
  selectionCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 6,
    padding: 18
  },
  selectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900"
  },
  selectionText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  yearCard: {
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 96,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  yearText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900"
  },
  resultsMeta: {
    color: COLORS.textMuted,
    fontSize: 12
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
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 16
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
