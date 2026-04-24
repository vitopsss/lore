import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { shareActivityCard } from "../lib/share-card";
import { COLORS, getCardThemeMeta } from "../theme";
import type { FeedItem } from "../types";

const activityLabels: Record<string, string> = {
  lendo: "está lendo",
  lido: "terminou",
  abandonado: "parou",
  quero_ler: "quer ler"
};

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

export const FeedEntryCard = ({
  item,
  showUsername = true,
  compact = false,
  onOpenBook
}: {
  item: FeedItem;
  showUsername?: boolean;
  compact?: boolean;
  onOpenBook?: (item: FeedItem) => void;
}) => {
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const themeMeta = getCardThemeMeta(item.cardTheme);

  const handleShare = async () => {
    setSharing(true);
    setShareError(null);

    try {
      await shareActivityCard(item.activityId);
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : "Não foi possível compartilhar este card."
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={[styles.accent, { backgroundColor: themeMeta.accent }]} />

      <View style={styles.header}>
        <View style={styles.userBlock}>
          {showUsername ? <Text style={styles.username}>@{item.username}</Text> : null}
          <Text style={styles.activityLine}>{activityLabels[item.type] ?? item.type}</Text>
        </View>

        <View style={styles.metaBlock}>
          <Text style={styles.date}>{formatDate(item.readAt ?? item.createdAt)}</Text>
          <Text style={[styles.themeTag, { color: themeMeta.accent }]}>{themeMeta.label}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={[styles.cover, compact && styles.coverCompact]} />
        ) : (
          <View style={[styles.cover, compact && styles.coverCompact, styles.coverFallback]}>
            <Text style={styles.coverFallbackText}>SEM CAPA</Text>
          </View>
        )}

        <View style={styles.copy}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.author}>{item.author}</Text>
          <Text style={[styles.rating, { color: themeMeta.accent }]}>{stars(item.rating)}</Text>
          {item.reviewText ? <Text style={styles.review}>{item.reviewText}</Text> : null}
          {item.amazonAffiliateLink ? <Text style={styles.signal}>Link de compra pronto</Text> : null}
        </View>
      </View>

      <View style={styles.actions}>
        {onOpenBook ? (
          <Pressable style={styles.secondaryAction} onPress={() => onOpenBook(item)}>
            <Text style={styles.secondaryActionText}>Abrir livro</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.primaryAction, sharing && styles.actionDisabled]}
          disabled={sharing}
          onPress={() => void handleShare()}
        >
          <Text style={styles.primaryActionText}>
            {sharing ? "Compartilhando..." : "Compartilhar no Instagram"}
          </Text>
        </Pressable>
      </View>

      {shareError ? <Text style={styles.errorText}>{shareError}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    overflow: "hidden",
    padding: 16,
    position: "relative"
  },
  cardCompact: {
    borderRadius: 22,
    gap: 12,
    padding: 14
  },
  accent: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 4
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginLeft: 4
  },
  userBlock: {
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
  metaBlock: {
    alignItems: "flex-end",
    gap: 4
  },
  date: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  themeTag: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  body: {
    flexDirection: "row",
    gap: 14
  },
  cover: {
    borderRadius: 18,
    height: 148,
    width: 100
  },
  coverCompact: {
    height: 126,
    width: 86
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
  copy: {
    flex: 1,
    gap: 8
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 25
  },
  author: {
    color: COLORS.textSoft,
    fontSize: 15
  },
  rating: {
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
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    minWidth: 228,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  primaryActionText: {
    color: "#101013",
    fontSize: 13,
    fontWeight: "900"
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 124,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  secondaryActionText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800"
  },
  actionDisabled: {
    opacity: 0.55
  },
  errorText: {
    color: "#ffd8d8",
    fontSize: 12,
    lineHeight: 18
  }
});
