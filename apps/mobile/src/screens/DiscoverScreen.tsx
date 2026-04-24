import { useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { loadFeaturedBooks, searchBooks } from "../api/client";
import { BookCover } from "../components/BookCover";
import { SectionHeader } from "../components/SectionHeader";
import { SubTabBar } from "../components/SubTabBar";
import { getPreferredCatalogLanguage } from "../lib/catalog-language";
import { COLORS } from "../theme";
import type { BookSearchResult, CatalogSearchFilters } from "../types";

type BrowseView = "home" | "release_decade" | "release_year" | "taxonomy" | "service" | "results";
type TaxonomyKey = "genre" | "country" | "language";

const genreOptions = ["Romance", "Fantasia", "Thriller", "História", "Não ficção", "Clássicos"];
const countryOptions = ["Brasil", "Estados Unidos", "Japão", "França", "Argentina", "Portugal"];
const languageOptions = [
  { label: "Português", value: "pt" },
  { label: "English", value: "en" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" }
];
const serviceOptions = [
  { label: "Google Books", value: "google" },
  { label: "Open Library", value: "open library" }
];
const taxonomyTabs: Array<{ key: TaxonomyKey; label: string }> = [
  { key: "genre", label: "Genre" },
  { key: "country", label: "Country" },
  { key: "language", label: "Language" }
];
const releaseDecades = [
  { label: "2020s", startYear: 2020, endYear: 2026 },
  { label: "2010s", startYear: 2010, endYear: 2019 },
  { label: "2000s", startYear: 2000, endYear: 2009 },
  { label: "1990s", startYear: 1990, endYear: 1999 },
  { label: "1980s", startYear: 1980, endYear: 1989 }
];

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

export const DiscoverScreen = ({
  viewerId,
  onPickBook
}: {
  viewerId: string;
  onPickBook: (book: BookSearchResult) => void;
}) => {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<BrowseView>("home");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [popularBooks, setPopularBooks] = useState<BookSearchResult[]>([]);
  const [anticipatedBooks, setAnticipatedBooks] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultsTitle, setResultsTitle] = useState("Resultados");
  const [previousView, setPreviousView] = useState<BrowseView>("home");
  const [selectedDecade, setSelectedDecade] = useState<(typeof releaseDecades)[number] | null>(null);
  const [taxonomyTab, setTaxonomyTab] = useState<TaxonomyKey>("genre");
  const preferredLanguage = getPreferredCatalogLanguage();

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
        setError("Não foi possível carregar o browse agora.");
      }

      setLoading(false);
    };

    void loadInitial();
  }, [preferredLanguage, viewerId]);

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
    title,
    nextPreviousView,
    load
  }: {
    title: string;
    nextPreviousView: BrowseView;
    load: () => Promise<BookSearchResult[]> | BookSearchResult[];
  }) => {
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setResultsTitle(title);
    setPreviousView(nextPreviousView);
    setView("results");

    try {
      const payload = await load();
      setResults(payload);
    } catch (caughtError) {
      setResults([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar esta seleção."
      );
    } finally {
      setLoading(false);
    }
  };

  const performTextSearch = async () => {
    await openResults({
      title: query.trim() ? `Busca por "${query.trim()}"` : "Busca",
      nextPreviousView: "home",
      load: () => searchBooks(query, viewerId)
    });
  };

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
          {loading ? "atualizando..." : `${results.length} livros`}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && results.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nenhum livro encontrado.</Text>
        </View>
      ) : null}

      {results.map((book) => (
        <Pressable key={book.googleId} onPress={() => onPickBook(book)} style={styles.resultCard}>
          <View style={styles.resultTop}>
            <BookCover uri={book.coverUrl} style={styles.cover} />

            <View style={styles.resultBody}>
              <Text style={styles.resultTitle}>{book.title}</Text>
              <Text style={styles.resultAuthor}>{book.author}</Text>
              <Text style={styles.resultMeta}>{buildMetaLine(book)}</Text>
              {book.categories.length > 1 ? (
                <Text style={styles.genreText}>{book.categories.join(" / ")}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.resultFooter}>
            <Text style={styles.resultFooterText}>Abrir ficha do livro</Text>
          </View>
        </Pressable>
      ))}
    </>
  );

  const renderBrowseHome = () => (
    <>
      <View style={styles.searchPanel}>
        <Text style={styles.blockEyebrow}>Buscar</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void performTextSearch()}
          placeholder="Título, autor ou ISBN"
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
          style={styles.searchInput}
        />
        <Pressable style={styles.searchButton} onPress={() => void performTextSearch()}>
          <Text style={styles.searchButtonText}>Buscar</Text>
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Browse</Text>
      </View>

      <View style={styles.browseGrid}>
        <Pressable
          style={styles.browseCard}
          onPress={() =>
            void openResults({
              title: "Most Popular",
              nextPreviousView: "home",
              load: () => popularBooks
            })
          }
        >
          <Text style={styles.browseTitle}>Most Popular</Text>
          <Text style={styles.browseText}>Destaques da semana.</Text>
        </Pressable>

        <Pressable
          style={styles.browseCard}
          onPress={() =>
            void openResults({
              title: "Most Anticipated",
              nextPreviousView: "home",
              load: () => anticipatedBooks
            })
          }
        >
          <Text style={styles.browseTitle}>Most Anticipated</Text>
          <Text style={styles.browseText}>Novidades e lançamentos.</Text>
        </Pressable>

        <Pressable style={styles.browseCard} onPress={() => setView("release_decade")}>
          <Text style={styles.browseTitle}>Release Date</Text>
          <Text style={styles.browseText}>Década e ano.</Text>
        </Pressable>

        <Pressable style={styles.browseCard} onPress={() => setView("taxonomy")}>
          <Text style={styles.browseTitle}>Genre / Country / Language</Text>
          <Text style={styles.browseText}>Filtrar catálogo.</Text>
        </Pressable>

        <Pressable style={styles.browseCard} onPress={() => setView("service")}>
          <Text style={styles.browseTitle}>Service</Text>
          <Text style={styles.browseText}>Escolher fonte.</Text>
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Livros da semana</Text>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.railRow} showsHorizontalScrollIndicator={false}>
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
      <Text style={styles.sectionTitle}>Escolha a década</Text>
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
            {decade.startYear} a {decade.endYear}
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
            <Text style={styles.selectionText}>Abrir livros relacionados</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderServices = () => (
    <View style={styles.selectionGroup}>
      <Text style={styles.sectionTitle}>Escolha o service</Text>
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
          <Text style={styles.selectionText}>Abrir livros desse catálogo</Text>
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
      <SectionHeader eyebrow="Buscar" title="Browse" />

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
          <Text style={styles.backButtonText}>Voltar</Text>
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
