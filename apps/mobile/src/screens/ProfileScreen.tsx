import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { loadFeed, loadStats } from "../api/client";
import { FeedEntryCard } from "../components/FeedEntryCard";
import { SectionHeader } from "../components/SectionHeader";
import { SubTabBar } from "../components/SubTabBar";
import { COLORS } from "../theme";
import type { FeedItem, StatsPayload } from "../types";

type ProfileTab = "profile" | "diary" | "lists" | "watchlist";

export const ProfileScreen = ({
  currentStreak,
  viewerId,
  viewerPremium,
  viewerUsername,
  onRequestDiscover,
  onRequestPost,
  onOpenBook,
  refreshKey
}: {
  currentStreak: number;
  viewerId: string;
  viewerPremium: boolean;
  viewerUsername: string;
  onRequestDiscover: () => void;
  onRequestPost: () => void;
  onOpenBook: (item: FeedItem) => void;
  refreshKey: number;
}) => {
  const { i18n, t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [selfFeed, setSelfFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profileTabs = useMemo<Array<{ key: ProfileTab; label: string }>>(
    () => [
      { key: "profile", label: t("profile.tabs.profile") },
      { key: "diary", label: t("profile.tabs.diary") },
      { key: "lists", label: t("profile.tabs.lists") },
      { key: "watchlist", label: t("profile.tabs.watchlist") }
    ],
    [t]
  );

  const statusLabelMap: Record<string, string> = useMemo(
    () => ({
      lendo: t("profile.status.reading"),
      lido: t("profile.status.finished"),
      abandonado: t("profile.status.abandoned"),
      quero_ler: t("profile.status.queued")
    }),
    [t]
  );

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
        setError(t("profile.errors.loadFailed"));
      } else if (statsResult.status === "rejected") {
        setError(t("profile.errors.statsFailed"));
      } else if (feedResult.status === "rejected") {
        setError(t("profile.errors.diaryFailed"));
      }

      setLoading(false);
    };

    void fetchProfile();
  }, [i18n.language, mode, refreshKey, viewerId]);

  const maxGenreCount = Math.max(...(stats?.topGenres.map((genre) => genre.total) ?? [1]));
  const viewerInitial = viewerUsername.charAt(0).toUpperCase();
  const diaryEntries = selfFeed.filter((item) => item.type !== "quero_ler");
  const watchlistEntries = selfFeed.filter((item) => item.type === "quero_ler");
  const listEntries = Object.entries(stats?.statuses ?? {}).sort((left, right) => right[1] - left[1]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <SectionHeader title={t("profile.title")} />

      <View style={styles.profileHero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{viewerInitial}</Text>
        </View>

        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>@{viewerUsername}</Text>
          <Text style={styles.profileMeta}>
            {viewerPremium ? t("profile.membership.premium") : t("profile.membership.basic")}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>
                {currentStreak > 0
                  ? t("profile.streak.active", { count: currentStreak })
                  : t("profile.streak.inactive")}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <SubTabBar options={profileTabs} value={activeTab} onChange={setActiveTab} />

      {loading ? <Text style={styles.loadingText}>{t("profile.loading")}</Text> : null}
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
                {t("profile.mode.basicHint")}
              </Text>
              <Text style={[styles.modeButtonText, mode === "basic" && styles.modeButtonTextActive]}>
                {t("profile.mode.basicTitle")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("advanced")}
              style={[styles.modeButton, mode === "advanced" && styles.modeButtonActive]}
            >
              <Text
                style={[styles.modeButtonHint, mode === "advanced" && styles.modeButtonHintActive]}
              >
                {t("profile.mode.advancedHint")}
              </Text>
              <Text
                style={[styles.modeButtonText, mode === "advanced" && styles.modeButtonTextActive]}
              >
                {t("profile.mode.advancedTitle")}
              </Text>
            </Pressable>
          </View>

          {!viewerPremium && mode === "advanced" ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningText}>{t("profile.premiumUnavailable")}</Text>
            </View>
          ) : null}

          {stats ? (
            <>
              <View style={styles.metricRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{stats.summary.booksRead}</Text>
                  <Text style={styles.metricLabel}>{t("profile.metrics.booksRead")}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{stats.summary.pagesRead}</Text>
                  <Text style={styles.metricLabel}>{t("profile.metrics.pagesRead")}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{stats.summary.averageDaysToFinish || "-"}</Text>
                  <Text style={styles.metricLabel}>{t("profile.metrics.averageDays")}</Text>
                </View>
              </View>

              {stats.advanced ? (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>{t("profile.premiumLayer")}</Text>
                  <View style={styles.advancedGrid}>
                    <View style={styles.advancedCard}>
                      <Text style={styles.advancedValue}>{stats.advanced.averageRating}</Text>
                      <Text style={styles.advancedLabel}>{t("profile.advanced.averageRating")}</Text>
                    </View>
                    <View style={styles.advancedCard}>
                      <Text style={styles.advancedValue}>{stats.advanced.completionRate}%</Text>
                      <Text style={styles.advancedLabel}>{t("profile.advanced.completionRate")}</Text>
                    </View>
                    <View style={styles.advancedCard}>
                      <Text style={styles.advancedValue}>{stats.advanced.monthlyPace}</Text>
                      <Text style={styles.advancedLabel}>{t("profile.advanced.monthlyPace")}</Text>
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
            <Text style={styles.emptyTitle}>{t("profile.emptyDiary")}</Text>
            <Pressable style={styles.emptyAction} onPress={onRequestPost}>
              <Text style={styles.emptyActionText}>{t("profile.postReading")}</Text>
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
            <Text style={styles.panelTitle}>{t("profile.shelfStates")}</Text>
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
            <Text style={styles.panelTitle}>{t("profile.topGenres")}</Text>
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
              <Text style={styles.emptyText}>{t("profile.noGenres")}</Text>
            )}
          </View>
        </>
      ) : null}

      {activeTab === "watchlist" ? (
        watchlistEntries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t("profile.emptyWatchlist")}</Text>
            <Pressable style={styles.emptyAction} onPress={onRequestDiscover}>
              <Text style={styles.emptyActionText}>{t("profile.openSearch")}</Text>
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
  metaRow: {
    flexDirection: "row",
    marginTop: 6
  },
  metaChip: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  metaChipText: {
    color: COLORS.textSoft,
    fontSize: 11,
    fontWeight: "800"
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
