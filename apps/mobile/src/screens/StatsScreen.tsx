import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { loadStats } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import { COLORS } from "../theme";
import type { StatsPayload } from "../types";

const statusLabelMap: Record<string, string> = {
  lendo: "Lendo",
  lido: "Finalizados",
  abandonado: "Abandonados",
  quero_ler: "Na fila"
};

export const StatsScreen = ({
  viewerId,
  viewerPremium,
  viewerUsername
}: {
  viewerId: string;
  viewerPremium: boolean;
  viewerUsername: string;
}) => {
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const payload = await loadStats(viewerId, viewerId, mode === "advanced");
        setStats(payload);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : "Nao foi possivel carregar o perfil."
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, [mode, viewerId]);

  const maxGenreCount = Math.max(...(stats?.topGenres.map((genre) => genre.total) ?? [1]));
  const viewerInitial = viewerUsername.charAt(0).toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <SectionHeader
        eyebrow="Perfil"
        title="Ritmo de leitura, estantes e metricas do perfil"
        subtitle="Aqui a estrutura vira painel pessoal: resumo da estante, generos dominantes e a camada premium para avaliacao media, conclusao e pace."
      />

      <View style={styles.profileHero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{viewerInitial}</Text>
        </View>

        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>@{viewerUsername}</Text>
          <Text style={styles.profileMeta}>
            {viewerPremium ? "Membro do Clube" : "Plano Basico"}
          </Text>
        </View>

        <View style={[styles.planBadge, viewerPremium && styles.planBadgePremium]}>
          <Text style={[styles.planBadgeText, viewerPremium && styles.planBadgeTextPremium]}>
            {viewerPremium ? "Clube" : "Basico"}
          </Text>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => setMode("basic")}
          style={[styles.modeButton, mode === "basic" && styles.modeButtonActive]}
        >
          <Text style={[styles.modeButtonHint, mode === "basic" && styles.modeButtonHintActive]}>
            visao
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
            Analise
          </Text>
        </Pressable>
      </View>

      {!viewerPremium && mode === "advanced" ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            Este perfil nao libera a camada premium; a API deve responder
            {" "}
            <Text style={styles.warningCode}>premium_required</Text>.
          </Text>
        </View>
      ) : null}

      {loading ? <Text style={styles.loadingText}>Carregando perfil...</Text> : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
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
              <Text style={styles.metricLabel}>paginas</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {stats.summary.averageDaysToFinish || "-"}
              </Text>
              <Text style={styles.metricLabel}>media de dias</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Estados da estante</Text>
            <View style={styles.stateRow}>
              {Object.entries(stats.statuses).map(([status, total]) => (
                <View key={status} style={styles.stateCard}>
                  <Text style={styles.stateValue}>{total}</Text>
                  <Text style={styles.stateLabel}>{statusLabelMap[status] ?? status}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Generos que puxam o perfil</Text>
            {stats.topGenres.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum livro concluido ainda.</Text>
            ) : (
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
            )}
          </View>

          {stats.advanced ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Camada premium</Text>
              <View style={styles.advancedGrid}>
                <View style={styles.advancedCard}>
                  <Text style={styles.advancedValue}>{stats.advanced.averageRating}</Text>
                  <Text style={styles.advancedLabel}>nota media</Text>
                </View>
                <View style={styles.advancedCard}>
                  <Text style={styles.advancedValue}>{stats.advanced.completionRate}%</Text>
                  <Text style={styles.advancedLabel}>conclusao</Text>
                </View>
                <View style={styles.advancedCard}>
                  <Text style={styles.advancedValue}>{stats.advanced.monthlyPace}</Text>
                  <Text style={styles.advancedLabel}>ultimos 30 dias</Text>
                </View>
              </View>
            </View>
          ) : null}
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
  planBadge: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  planBadgePremium: {
    borderColor: COLORS.borderStrong
  },
  planBadgeText: {
    color: COLORS.textSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  planBadgeTextPremium: {
    color: COLORS.accentSoft
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
  warningCode: {
    color: "#fff1d9",
    fontWeight: "800"
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
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20
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
  }
});
