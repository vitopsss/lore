import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { loadFeed, loadStats } from "../api/client";
import { FeedEntryCard } from "../components/FeedEntryCard";
import { SectionHeader } from "../components/SectionHeader";
import { SubTabBar } from "../components/SubTabBar";
import { COLORS } from "../theme";
import type { FeedItem, StatsPayload } from "../types";

type ProfileTab = "profile" | "diary" | "lists" | "watchlist";

const profileTabs: Array<{ key: ProfileTab; label: string }> = [
  { key: "profile", label: "Profile" },
  { key: "diary", label: "Diary" },
  { key: "lists", label: "Lists" },
  { key: "watchlist", label: "Watchlist" }
];

const statusLabelMap: Record<string, string> = {
  lendo: "Lendo",
  lido: "Finalizados",
  abandonado: "Abandonados",
  quero_ler: "Na fila"
};

export const ProfileScreen = ({
  viewerId,
  viewerPremium,
  viewerUsername,
  onRequestDiscover,
  onRequestPost,
  onOpenBook,
  refreshKey
}: {
  viewerId: string;
  viewerPremium: boolean;
  viewerUsername: string;
  onRequestDiscover: () => void;
  onRequestPost: () => void;
  onOpenBook: (item: FeedItem) => void;
  refreshKey: number;
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [selfFeed, setSelfFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);

      const [statsResult, feedResult] = await Promise.allSettled([
        loadStats(viewerId, viewerId, mode === "advanced"),
        loadFeed(viewerId, "self")
      ]);

      setStats(statsResult.status === "fulfilled" ? statsResult.value : null);
      setSelfFeed(feedResult.status === "fulfilled" ? feedResult.value : []);

      if (statsResult.status === "rejected" && feedResult.status === "rejected") {
        setError("Não foi possível carregar o perfil.");
      } else if (statsResult.status === "rejected") {
        setError("As métricas do perfil falharam ao carregar.");
      } else if (feedResult.status === "rejected") {
        setError("O diário do perfil falhou ao carregar.");
      }

      setLoading(false);
    };

    void fetchProfile();
  }, [mode, refreshKey, viewerId]);

  const maxGenreCount = Math.max(...(stats?.topGenres.map((genre) => genre.total) ?? [1]));
  const viewerInitial = viewerUsername.charAt(0).toUpperCase();
  const diaryEntries = selfFeed.filter((item) => item.type !== "quero_ler");
  const watchlistEntries = selfFeed.filter((item) => item.type === "quero_ler");
  const listEntries = Object.entries(stats?.statuses ?? {}).sort((left, right) => right[1] - left[1]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <SectionHeader eyebrow="Perfil" title="Seu perfil" subtitle={`@${viewerUsername}`} />

      <View style={styles.profileHero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{viewerInitial}</Text>
        </View>

        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>@{viewerUsername}</Text>
          <Text style={styles.profileMeta}>
            {viewerPremium ? "Membro do Clube" : "Plano Básico"}
          </Text>
        </View>
      </View>

      <SubTabBar options={profileTabs} value={activeTab} onChange={setActiveTab} />

      {loading ? <Text style={styles.loadingText}>Carregando perfil...</Text> : null}
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {activeTab === "profile" ? (
        <>
          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setMode("basic")}
              style={[styles.modeButton, mode === "basic" && styles.modeButtonActive]}
            >
              <Text style={[styles.modeButtonHint, mode === "basic" && styles.modeButtonHintActive]}>
                visão
              </Text>
              <Text style={[styles.modeButtonText, mode === "basic" && styles.modeButtonTextActive]}>
                Resumo
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("advanced")}
              style={[styles.modeButton, mode === "advanced" && styles.modeButtonActive]}
            >
              <Text
                style={[styles.modeButtonHint, mode === "advanced" && styles.modeButtonHintActive]}
              >
                premium
              </Text>
              <Text
                style={[styles.modeButtonText, mode === "advanced" && styles.modeButtonTextActive]}
              >
                Análise
              </Text>
            </Pressable>
          </View>

          {!viewerPremium && mode === "advanced" ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningText}>Premium indisponível</Text>
            </View>
          ) : null}

          {stats ? (
            <>
              <View style={styles.metricRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{stats.summary.booksRead}</Text>
                  <Text style={styles.metricLabel}>livros lidos</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{stats.summary.pagesRead}</Text>
                  <Text style={styles.metricLabel}>páginas</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{stats.summary.averageDaysToFinish || "-"}</Text>
                  <Text style={styles.metricLabel}>média de dias</Text>
                </View>
              </View>

              {stats.advanced ? (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>Camada premium</Text>
                  <View style={styles.advancedGrid}>
                    <View style={styles.advancedCard}>
                      <Text style={styles.advancedValue}>{stats.advanced.averageRating}</Text>
                      <Text style={styles.advancedLabel}>nota média</Text>
                    </View>
                    <View style={styles.advancedCard}>
                      <Text style={styles.advancedValue}>{stats.advanced.completionRate}%</Text>
                      <Text style={styles.advancedLabel}>conclusão</Text>
                    </View>
                    <View style={styles.advancedCard}>
                      <Text style={styles.advancedValue}>{stats.advanced.monthlyPace}</Text>
                      <Text style={styles.advancedLabel}>últimos 30 dias</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {activeTab === "diary" ? (
        diaryEntries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sem diary</Text>
            <Pressable style={styles.emptyAction} onPress={onRequestPost}>
              <Text style={styles.emptyActionText}>Postar leitura</Text>
            </Pressable>
          </View>
        ) : (
          diaryEntries.map((item) => (
            <FeedEntryCard
              key={item.activityId}
              item={item}
              showUsername={false}
              compact
              onOpenBook={onOpenBook}
            />
          ))
        )
      ) : null}

      {activeTab === "lists" ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Estados da estante</Text>
            <View style={styles.stateRow}>
              {listEntries.map(([status, total]) => (
                <View key={status} style={styles.stateCard}>
                  <Text style={styles.stateValue}>{total}</Text>
                  <Text style={styles.stateLabel}>{statusLabelMap[status] ?? status}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Gêneros que puxam o perfil</Text>
            {stats?.topGenres.length ? (
              stats.topGenres.map((genre) => (
                <View key={genre.genre} style={styles.genreRow}>
                  <View style={styles.genreCopy}>
                    <Text style={styles.genreName}>{genre.genre}</Text>
                    <View style={styles.genreTrack}>
                      <View
                        style={[
                          styles.genreFill,
                          { width: `${(genre.total / maxGenreCount) * 100}%` }
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.genreCount}>{genre.total}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhum gênero consolidado ainda.</Text>
            )}
          </View>
        </>
      ) : null}

      {activeTab === "watchlist" ? (
        watchlistEntries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sem watchlist</Text>
            <Pressable style={styles.emptyAction} onPress={onRequestDiscover}>
              <Text style={styles.emptyActionText}>Abrir busca</Text>
            </Pressable>
          </View>
        ) : (
          watchlistEntries.map((item) => (
            <FeedEntryCard
              key={item.activityId}
              item={item}
              showUsername={false}
              compact
              onOpenBook={onOpenBook}
            />
          ))
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
  profileHero: {
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 18
  },
  avatar: {
    alignItems: "center",
    backgroundColor: COLORS.backgroundRaised,
    borderRadius: 999,
    height: 54,
    justifyContent: "center",
    width: 54
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900"
  },
  profileCopy: {
    flex: 1,
    gap: 4
  },
  profileName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900"
  },
  profileMeta: {
    color: COLORS.textMuted,
    fontSize: 13
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14
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
  toggleRow: {
    flexDirection: "row",
    gap: 10
  },
  modeButton: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  modeButtonActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong
  },
  modeButtonHint: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  modeButtonHintActive: {
    color: COLORS.accentSoft
  },
  modeButtonText: {
    color: COLORS.textSoft,
    fontSize: 15,
    fontWeight: "900"
  },
  modeButtonTextActive: {
    color: "#ffffff"
  },
  warningCard: {
    backgroundColor: COLORS.warningTint,
    borderColor: "rgba(216, 160, 95, 0.24)",
    borderRadius: 22,
    borderWidth: 1,
    padding: 16
  },
  warningText: {
    color: "#ffd3a3",
    fontSize: 14,
    lineHeight: 20
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  metricCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    minWidth: 104,
    padding: 16
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900"
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4
  },
  panel: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  panelTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  advancedGrid: {
    gap: 10
  },
  advancedCard: {
    alignItems: "baseline",
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  advancedValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900"
  },
  advancedLabel: {
    color: COLORS.textMuted,
    fontSize: 13
  },
  stateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  stateCard: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 100,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  stateValue: {
    color: COLORS.accentSoft,
    fontSize: 20,
    fontWeight: "900"
  },
  stateLabel: {
    color: COLORS.textSoft,
    fontSize: 13,
    marginTop: 2
  },
  genreRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  genreCopy: {
    flex: 1,
    gap: 8
  },
  genreName: {
    color: COLORS.textSoft,
    fontSize: 14,
    fontWeight: "800"
  },
  genreTrack: {
    backgroundColor: COLORS.field,
    borderRadius: 999,
    height: 8,
    overflow: "hidden"
  },
  genreFill: {
    backgroundColor: COLORS.accentCool,
    borderRadius: 999,
    height: "100%"
  },
  genreCount: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    minWidth: 24,
    textAlign: "right"
  },
  emptyCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 18
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900"
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  emptyAction: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  emptyActionText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800"
  }
});
