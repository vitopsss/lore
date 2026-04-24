import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { BookCover } from "./BookCover";
import { shareActivityCard } from "../lib/share-card";
import { COLORS, getCardThemeMeta } from "../theme";
import type { FeedItem } from "../types";

const formatDate = (value: string | null, locale: string) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short"
  }).format(parsed);
};

const stars = (rating: number | null) =>
  rating ? `${"\u2605".repeat(rating)}${"\u2606".repeat(5 - rating)}` : null;

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
  const { i18n, t } = useTranslation();
  const formattedDate = formatDate(item.readAt ?? item.createdAt, i18n.language);
  const ratingText = stars(item.rating) ?? t("feedEntry.noRating");

  const handleShare = async () => {
    setSharing(true);
    setShareError(null);

    try {
      await shareActivityCard(item.activityId);
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : t("share.errors.nativeShareFailed")
      );
    } finally {
      setSharing(false);
    }
  };

  const content = (
    <>
      <View style={[styles.accent, { backgroundColor: themeMeta.accent }]} />

      <View style={styles.header}>
        <View style={styles.userBlock}>
          {showUsername ? <Text style={styles.username}>@{item.username}</Text> : null}
          <Text style={styles.activityLine}>{t(`feedEntry.activity.${item.type}`)}</Text>
        </View>

        <View style={styles.metaBlock}>
          <Text style={styles.date}>{formattedDate ?? t("feedEntry.recent")}</Text>
          <Text style={[styles.themeTag, { color: themeMeta.accent }]}>{themeMeta.label}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <BookCover uri={item.coverUrl} style={[styles.cover, compact && styles.coverCompact]} />

        <View style={styles.copy}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.author}>{item.author}</Text>
          <Text style={[styles.rating, { color: themeMeta.accent }]}>{ratingText}</Text>
          {item.reviewText ? <Text style={styles.review}>{item.reviewText}</Text> : null}
          {item.amazonAffiliateLink ? (
            <Text style={styles.signal}>{t("feedEntry.purchaseLinkReady")}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryAction, sharing && styles.actionDisabled]}
          disabled={sharing}
          onPress={(event) => {
            event.stopPropagation();
            void handleShare();
          }}
        >
          <Text style={styles.primaryActionText}>
            {sharing ? t("feedEntry.sharing") : t("feedEntry.share")}
          </Text>
        </Pressable>
      </View>

      {shareError ? <Text style={styles.errorText}>{shareError}</Text> : null}
    </>
  );

  if (onOpenBook) {
    return (
      <Pressable
        onPress={() => onOpenBook(item)}
        style={[styles.card, compact && styles.cardCompact]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.card, compact && styles.cardCompact]}>{content}</View>;
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
  actionDisabled: {
    opacity: 0.55
  },
  errorText: {
    color: "#ffd8d8",
    fontSize: 12,
    lineHeight: 18
  }
});
