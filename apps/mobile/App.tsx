import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { createUser, loadUsers } from "./src/api/client";
import { ActivityScreen } from "./src/screens/ActivityScreen";
import { BookDetailScreen } from "./src/screens/BookDetailScreen";
import { DiscoverScreen } from "./src/screens/DiscoverScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PostScreen } from "./src/screens/PostScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { BRAND_NAME, COLORS } from "./src/theme";
import type { AppUser, BookSearchResult, FeedItem, StreakSnapshot } from "./src/types";

type TabKey = "home" | "discover" | "post" | "activity" | "profile";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "discover", label: "Buscar" },
  { key: "post", label: "Postar" },
  { key: "activity", label: "Activity" },
  { key: "profile", label: "Perfil" }
];

const DEMO_USER_IDS = new Set([
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002"
]);

const planLabel = (viewer: AppUser) => (viewer.premiumStatus ? "Clube" : "Básico");
const streakLabel = (viewer: AppUser) =>
  viewer.currentStreak <= 0 ? "Sem ofensiva" : `${viewer.currentStreak}d de ofensiva`;

const feedItemToBook = (item: FeedItem): BookSearchResult => ({
  googleId: item.googleId,
  title: item.title,
  author: item.author,
  coverUrl: item.coverUrl,
  isbn: item.isbn,
  pageCount: null,
  categories: [],
  amazonAffiliateLink: item.amazonAffiliateLink
});

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [composerSeed, setComposerSeed] = useState<BookSearchResult | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);

  const loadViewerOptions = async () => {
    setLoadingUsers(true);
    setUsersError(null);

    try {
      const payload = await loadUsers();
      setUsers(payload);
      const realUser = payload.find((user) => !DEMO_USER_IDS.has(user.id));
      setViewerId((current) =>
        current && payload.some((user) => user.id === current) ? current : realUser?.id ?? null
      );
    } catch (error) {
      setUsersError(
        error instanceof Error ? error.message : "Não foi possível carregar o app."
      );
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadViewerOptions();
  }, []);

  useEffect(() => {
    setComposerSeed(null);
    setSelectedBook(null);
  }, [viewerId]);

  const viewer = users.find((user) => user.id === viewerId) ?? null;
  const viewerInitial = viewer?.username.charAt(0).toUpperCase() ?? "?";

  const openBookDetail = (book: BookSearchResult) => {
    setSelectedBook(book);
  };

  const openBookDetailFromFeed = (item: FeedItem) => {
    openBookDetail(feedItemToBook(item));
  };

  const openComposerWithBook = (book: BookSearchResult) => {
    setComposerSeed(book);
    setSelectedBook(null);
    setActiveTab("post");
  };

  const handlePostCreated = (nextStreak: StreakSnapshot) => {
    if (viewerId) {
      setUsers((current) =>
        current.map((user) =>
          user.id === viewerId
            ? {
                ...user,
                currentStreak: nextStreak.currentStreak,
                lastReadDate: nextStreak.lastReadDate
              }
            : user
        )
      );
    }

    setRefreshKey((current) => current + 1);
  };

  const handleCreateUser = async () => {
    const username = usernameInput.trim().toLowerCase();

    if (username.length < 3) {
      setUsersError("Escolha um username com pelo menos 3 caracteres.");
      return;
    }

    setCreatingUser(true);
    setUsersError(null);

    try {
      const createdUser = await createUser({
        username
      });
      setUsers((current) => [createdUser, ...current.filter((user) => user.id !== createdUser.id)]);
      setViewerId(createdUser.id);
      setUsernameInput("");
    } catch (error) {
      setUsersError(
        error instanceof Error ? error.message : "Não foi possível criar sua conta."
      );
    } finally {
      setCreatingUser(false);
    }
  };

  const renderContent = () => {
    if (!viewer) {
      return null;
    }

    if (selectedBook && activeTab !== "post") {
      return (
        <BookDetailScreen
          viewerId={viewer.id}
          book={selectedBook}
          onBack={() => setSelectedBook(null)}
          onOpenBook={openBookDetail}
          onLogBook={openComposerWithBook}
        />
      );
    }

    if (activeTab === "home") {
      return (
        <HomeScreen
          viewerId={viewer.id}
          viewerUsername={viewer.username}
          onRequestDiscover={() => setActiveTab("discover")}
          onRequestActivity={() => setActiveTab("activity")}
          onRequestProfile={() => setActiveTab("profile")}
          onPickBook={openBookDetail}
          onOpenFeedBook={openBookDetailFromFeed}
          refreshKey={refreshKey}
        />
      );
    }

    if (activeTab === "discover") {
      return <DiscoverScreen viewerId={viewer.id} onPickBook={openBookDetail} />;
    }

    if (activeTab === "post") {
      return (
        <PostScreen
          viewerId={viewer.id}
          viewerPremium={viewer.premiumStatus}
          initialBook={composerSeed}
          onPostCreated={handlePostCreated}
          onRequestActivity={() => setActiveTab("activity")}
        />
      );
    }

    if (activeTab === "activity") {
      return (
        <ActivityScreen
          viewerId={viewer.id}
          onRequestCreateEntry={() => setActiveTab("post")}
          onOpenBook={openBookDetailFromFeed}
          refreshKey={refreshKey}
        />
      );
    }

    return (
      <ProfileScreen
        viewerId={viewer.id}
        viewerPremium={viewer.premiumStatus}
        viewerUsername={viewer.username}
        onRequestDiscover={() => setActiveTab("discover")}
        onRequestPost={() => setActiveTab("post")}
        onOpenBook={openBookDetailFromFeed}
        refreshKey={refreshKey}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.shell}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View pointerEvents="none" style={styles.ambient}>
          <View style={[styles.blob, styles.blobWarm]} />
          <View style={[styles.blob, styles.blobCool]} />
          <View style={[styles.blob, styles.blobShadow]} />
        </View>

        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <View style={[styles.bookSpine, styles.bookSpineTall]} />
              <View style={[styles.bookSpine, styles.bookSpineWarm]} />
              <View style={[styles.bookSpine, styles.bookSpineCool]} />
            </View>

            <View style={styles.brandCopy}>
              <Text style={styles.brandText}>{BRAND_NAME}</Text>
            </View>
          </View>

          <View style={styles.sessionBadge}>
            <View style={styles.sessionDot} />
            <Text style={styles.sessionText}>api live</Text>
          </View>
        </View>

        {loadingUsers ? (
          <View style={styles.bannerCard}>
            <Text style={styles.bannerTitle}>Abrindo app</Text>
          </View>
        ) : viewer ? (
          <>
            {activeTab !== "profile" ? (
              <View style={styles.viewerBar}>
                <View style={styles.viewerSummary}>
                  {viewer.avatar ? (
                    <Image source={{ uri: viewer.avatar }} style={styles.viewerAvatar} />
                  ) : (
                    <View style={[styles.viewerAvatar, styles.viewerAvatarFallback]}>
                      <Text style={styles.viewerAvatarText}>{viewerInitial}</Text>
                    </View>
                  )}

                  <View style={styles.viewerCopy}>
                    <Text style={styles.viewerName}>@{viewer.username}</Text>
                    <Text style={styles.viewerMeta}>{planLabel(viewer)}</Text>
                  </View>
                </View>

                <View style={styles.viewerStreak}>
                  <Text style={styles.viewerStreakValue}>{streakLabel(viewer)}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.content}>{renderContent()}</View>
          </>
        ) : (
          <View style={styles.bannerCard}>
            <Text style={styles.bannerTitle}>Criar conta</Text>
            <TextInput
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="seu_username"
              placeholderTextColor={COLORS.textMuted}
              style={styles.usernameInput}
            />
            {usersError ? <Text style={styles.bannerText}>{usersError}</Text> : null}
            <Pressable style={styles.bannerAction} onPress={handleCreateUser}>
              <Text style={styles.bannerActionText}>
                {creatingUser ? "Criando..." : "Entrar no app"}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const active = tab.key === activeTab;

            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  setSelectedBook(null);
                  setActiveTab(tab.key);
                }}
                style={[styles.tabButton, active && styles.tabButtonActive]}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.background,
    flex: 1
  },
  shell: {
    flex: 1,
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  ambient: {
    ...StyleSheet.absoluteFillObject
  },
  blob: {
    borderRadius: 999,
    position: "absolute"
  },
  blobWarm: {
    backgroundColor: "rgba(197, 139, 91, 0.18)",
    height: 220,
    left: -40,
    top: 8,
    width: 220
  },
  blobCool: {
    backgroundColor: "rgba(124, 167, 185, 0.12)",
    height: 180,
    right: -40,
    top: 240,
    width: 180
  },
  blobShadow: {
    backgroundColor: "rgba(245, 241, 232, 0.05)",
    bottom: 100,
    height: 160,
    left: 100,
    width: 160
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "rgba(245, 241, 232, 0.06)",
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    height: 42,
    justifyContent: "center",
    paddingHorizontal: 10
  },
  bookSpine: {
    borderRadius: 6,
    width: 8
  },
  bookSpineTall: {
    backgroundColor: COLORS.textSoft,
    height: 22
  },
  bookSpineWarm: {
    backgroundColor: COLORS.accent,
    height: 26
  },
  bookSpineCool: {
    backgroundColor: COLORS.accentCool,
    height: 18
  },
  brandCopy: {
    gap: 0
  },
  brandText: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1
  },
  sessionBadge: {
    alignItems: "center",
    backgroundColor: "rgba(20, 24, 33, 0.9)",
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  sessionDot: {
    backgroundColor: COLORS.accentCool,
    borderRadius: 999,
    height: 8,
    width: 8
  },
  sessionText: {
    color: COLORS.textSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  viewerBar: {
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  viewerSummary: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10
  },
  viewerAvatar: {
    borderRadius: 999,
    height: 40,
    width: 40
  },
  viewerAvatarFallback: {
    alignItems: "center",
    backgroundColor: COLORS.backgroundRaised,
    justifyContent: "center"
  },
  viewerAvatarText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900"
  },
  viewerCopy: {
    flex: 1,
    gap: 2
  },
  viewerName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900"
  },
  viewerMeta: {
    color: COLORS.textMuted,
    fontSize: 12
  },
  viewerStreak: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  viewerStreakValue: {
    color: COLORS.accentSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  content: {
    flex: 1,
    minHeight: 0
  },
  bannerCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 18
  },
  bannerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  usernameInput: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  bannerText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  bannerAction: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  bannerActionText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800"
  },
  tabBar: {
    backgroundColor: "rgba(14, 17, 24, 0.96)",
    borderColor: COLORS.border,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    padding: 8
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 20,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 6,
    paddingVertical: 10
  },
  tabButtonActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderWidth: 1
  },
  tabLabel: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: "800"
  },
  tabLabelActive: {
    color: "#ffffff"
  }
});
