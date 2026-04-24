import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { loadFeed } from "../api/client";
import { FeedEntryCard } from "../components/FeedEntryCard";
import { SectionHeader } from "../components/SectionHeader";
import { SubTabBar } from "../components/SubTabBar";
import { COLORS } from "../theme";
import type { FeedItem, FeedScope } from "../types";

const scopeTabs: Array<{ key: FeedScope; label: string }> = [
  { key: "community", label: "Following" },
  { key: "self", label: "You" }
];

export const ActivityScreen = ({
  viewerId,
  onRequestCreateEntry,
  onOpenBook,
  refreshKey
}: {
  viewerId: string;
  onRequestCreateEntry: () => void;
  onOpenBook: (item: FeedItem) => void;
  refreshKey: number;
}) => {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [scope, setScope] = useState<FeedScope>("community");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (nextScope = scope) => {
    setLoading(true);
    setError(null);

    try {
      const payload = await loadFeed(viewerId, nextScope);
      setFeed(payload);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Não foi possível carregar a activity."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(scope);
  }, [refreshKey, scope, viewerId]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <SectionHeader eyebrow="Activity" title="Feed" />

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>
            {scope === "community" ? "Following activity" : "Your activity"}
          </Text>
          <Text style={styles.heroText}>
            {loading
              ? "Atualizando feed..."
              : scope === "community"
                ? `${feed.length} itens da sua rede`
                : `${feed.length} itens do seu histórico`}
          </Text>
        </View>

        <Pressable style={styles.heroAction} onPress={onRequestCreateEntry}>
          <Text style={styles.heroActionText}>Postar leitura</Text>
        </Pressable>
      </View>

      <SubTabBar options={scopeTabs} value={scope} onChange={setScope} />

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && feed.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {scope === "community"
              ? "Ainda não há atividade suficiente no feed que você segue."
              : "Você ainda não registrou leituras."}
          </Text>
        </View>
      ) : null}

      {feed.map((item) => (
        <FeedEntryCard
          key={item.activityId}
          item={item}
          showUsername={scope === "community"}
          onOpenBook={onOpenBook}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingBottom: 28
  },
  hero: {
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 18
  },
  heroCopy: {
    flex: 1,
    gap: 6
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900"
  },
  heroText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  heroAction: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    justifyContent: "center",
    minWidth: 122,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  heroActionText: {
    color: "#101013",
    fontSize: 13,
    fontWeight: "900"
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
    padding: 18
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900"
  }
});
