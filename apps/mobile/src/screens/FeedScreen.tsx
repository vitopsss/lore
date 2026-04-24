import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { loadFeed } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import { COLORS, getCardThemeMeta } from "../theme";
import type { FeedItem, FeedScope } from "../types";

const activityLabels: Record<string, string> = {
  lendo: "esta lendo",
  lido: "terminou",
  abandonado: "parou",
  quero_ler: "colocou na lista"
};

const monthLabels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const stars = (rating: number | null) =>
  rating ? `${"\u2605".repeat(rating)}${"\u2606".repeat(5 - rating)}` : "Sem nota";

const formatDate = (value: string | null) => {
  if (!value) {
    return "hoje";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "recente";
  }

  return `${monthLabels[parsed.getMonth()]} ${parsed.getDate()}`;
};

export const FeedScreen = ({
  viewerId,
  viewerUsername,
  viewerPremium,
  onRequestCreateEntry,
  onRequestProfile
}: {
  viewerId: string;
  viewerUsername: string;
  viewerPremium: boolean;
  onRequestCreateEntry: () => void;
  onRequestProfile: () => void;
}) => {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [scope, setScope] = useState<FeedScope>("community");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await loadFeed(viewerId, scope);
      setFeed(payload);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Nao foi possivel carregar o mural."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [viewerId, scope]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <SectionHeader
        eyebrow="Inicio"
        title="Veja o que esta acontecendo e publique sua proxima leitura"
        subtitle="O fluxo agora parte do mural: criar registro, revisar atividade recente e entrar no perfil sem precisar adivinhar o proximo passo."
      />

      <View style={styles.heroCard}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>perfil ativo</Text>
          <Text style={styles.heroTitle}>@{viewerUsername}</Text>
          <Text style={styles.heroText}>
            {viewerPremium
              ? "Clube ativo com analise e visuais extras liberados."
              : "Plano basico pronto para registrar, publicar e acompanhar o mural."}
          </Text>
        </View>

        <View style={styles.heroActions}>
          <Pressable style={styles.primaryAction} onPress={onRequestCreateEntry}>
            <Text style={styles.primaryActionText}>Novo post</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={onRequestProfile}>
            <Text style={styles.secondaryActionText}>Abrir perfil</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.scopeRow}>
        <Pressable
          onPress={() => setScope("community")}
          style={[styles.scopeButton, scope === "community" && styles.scopeButtonActive]}
        >
          <Text style={[styles.scopeHint, scope === "community" && styles.scopeHintActive]}>
            fluxo
          </Text>
          <Text style={[styles.scopeText, scope === "community" && styles.scopeTextActive]}>
            Comunidade
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setScope("self")}
          style={[styles.scopeButton, scope === "self" && styles.scopeButtonActive]}
        >
          <Text style={[styles.scopeHint, scope === "self" && styles.scopeHintActive]}>
            foco
          </Text>
          <Text style={[styles.scopeText, scope === "self" && styles.scopeTextActive]}>
            Meus posts
          </Text>
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <View>
          <Text style={styles.toolbarTitle}>
            {scope === "community" ? "Mural de leitura" : "Sua linha do tempo"}
          </Text>
          <Text style={styles.toolbarMeta}>
            {loading ? "Atualizando entradas..." : `${feed.length} entradas carregadas`}
          </Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={refresh}>
          <Text style={styles.refreshButtonText}>{loading ? "..." : "Atualizar"}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && feed.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {scope === "community" ? "O mural ainda esta vazio" : "Voce ainda nao publicou nada"}
          </Text>
          <Text style={styles.emptyText}>
            {scope === "community"
              ? "Seu proprio registro agora tambem entra no mural. Use o botao Novo post para começar."
              : "Escolha um livro, escreva uma nota curta e publique para ver o registro aqui."}
          </Text>
        </View>
      ) : null}

      {feed.map((item) => {
        const themeMeta = getCardThemeMeta(item.cardTheme);

        return (
          <View key={item.activityId} style={styles.entryCard}>
            <View style={[styles.entryAccent, { backgroundColor: themeMeta.accent }]} />

            <View style={styles.entryHeader}>
              <View style={styles.entryUserBlock}>
                <Text style={styles.username}>@{item.username}</Text>
                <Text style={styles.activityLine}>
                  {activityLabels[item.type] ?? item.type}
                </Text>
              </View>

              <View style={styles.entryMetaBlock}>
                <Text style={styles.entryDate}>{formatDate(item.readAt ?? item.createdAt)}</Text>
                <Text style={[styles.themeTag, { color: themeMeta.accent }]}>
                  {themeMeta.label}
                </Text>
              </View>
            </View>

            <View style={styles.entryBody}>
              {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverFallback]}>
                  <Text style={styles.coverFallbackText}>SEM CAPA</Text>
                </View>
              )}

              <View style={styles.entryCopy}>
                <Text style={styles.bookTitle}>{item.title}</Text>
                <Text style={styles.bookAuthor}>{item.author}</Text>
                <Text style={[styles.ratingLine, { color: themeMeta.accent }]}>
                  {stars(item.rating)}
                </Text>
                {item.reviewText ? <Text style={styles.review}>{item.reviewText}</Text> : null}
                {item.amazonAffiliateLink ? (
                  <Text style={styles.signal}>Link de compra pronto</Text>
                ) : null}
              </View>
            </View>
          </View>
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
  heroCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 18
  },
  heroCopy: {
    gap: 6
  },
  heroEyebrow: {
    color: COLORS.accentSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900"
  },
  heroText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  heroActions: {
    flexDirection: "row",
    gap: 10
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    flex: 1,
    paddingVertical: 14
  },
  primaryActionText: {
    color: "#101013",
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14
  },
  secondaryActionText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800"
  },
  scopeRow: {
    flexDirection: "row",
    gap: 10
  },
  scopeButton: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  scopeButtonActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong
  },
  scopeHint: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  scopeHintActive: {
    color: COLORS.accentSoft
  },
  scopeText: {
    color: COLORS.textSoft,
    fontSize: 15,
    fontWeight: "900"
  },
  scopeTextActive: {
    color: "#ffffff"
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  toolbarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  toolbarMeta: {
    color: COLORS.textMuted,
    fontSize: 12
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  refreshButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800"
  },
  errorCard: {
    backgroundColor: COLORS.dangerTint,
    borderColor: "rgba(210, 115, 107, 0.28)",
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
    gap: 6,
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
  entryCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    overflow: "hidden",
    padding: 16,
    position: "relative"
  },
  entryAccent: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 4
  },
  entryHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginLeft: 4
  },
  entryUserBlock: {
    gap: 4
  },
  username: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900"
  },
  activityLine: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  entryMetaBlock: {
    alignItems: "flex-end",
    gap: 4
  },
  entryDate: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  themeTag: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  entryBody: {
    flexDirection: "row",
    gap: 14
  },
  cover: {
    borderRadius: 18,
    height: 148,
    width: 100
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
  entryCopy: {
    flex: 1,
    gap: 8
  },
  bookTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 25
  },
  bookAuthor: {
    color: COLORS.textSoft,
    fontSize: 15
  },
  ratingLine: {
    fontSize: 18,
    fontWeight: "800"
  },
  review: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20
  },
  signal: {
    color: COLORS.accentSoft,
    fontSize: 12,
    fontWeight: "700"
  }
});
