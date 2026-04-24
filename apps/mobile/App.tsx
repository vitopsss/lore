import "react-native-url-polyfill/auto";

import "./src/i18n";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { ActivityScreen } from "./src/screens/ActivityScreen";
import { BookDetailScreen } from "./src/screens/BookDetailScreen";
import { DiscoverScreen } from "./src/screens/DiscoverScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { PostScreen } from "./src/screens/PostScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { RegisterScreen } from "./src/screens/RegisterScreen";
import { BRAND_NAME, COLORS } from "./src/theme";
import type { BookSearchResult, FeedItem, StreakSnapshot } from "./src/types";

type TabKey = "home" | "discover" | "post" | "activity" | "profile";
type AuthScreenMode = "login" | "register";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "discover", label: "Buscar" },
  { key: "post", label: "Postar" },
  { key: "activity", label: "Activity" },
  { key: "profile", label: "Perfil" }
];

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

const AppShell = () => {
  const {
    authUser,
    error: authError,
    isReady: authReady,
    profile,
    refreshProfile
  } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [authMode, setAuthMode] = useState<AuthScreenMode>("login");
  const [refreshKey, setRefreshKey] = useState(0);
  const [composerSeed, setComposerSeed] = useState<BookSearchResult | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);

  useEffect(() => {
    if (authUser) {
      setAuthMode("login");
    }
  }, [authUser]);

  useEffect(() => {
    setComposerSeed(null);
    setSelectedBook(null);
    setActiveTab("home");
  }, [profile?.id]);

  const viewer = profile;

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

  const handlePostCreated = (_nextStreak: StreakSnapshot) => {
    setRefreshKey((current) => current + 1);
  };

  const renderTabBar = () => (
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
  );

  const renderShellBody = () => {
    if (!authReady) {
      return (
        <View style={styles.bannerCard}>
          <ActivityIndicator color={COLORS.accentSoft} size="small" />
          <Text style={styles.bannerTitle}>Abrindo app</Text>
          <Text style={styles.bannerText}>Validando sessão e preparando a experiência.</Text>
        </View>
      );
    }

    if (!authUser) {
      return authMode === "register" ? (
        <RegisterScreen onOpenLogin={() => setAuthMode("login")} />
      ) : (
        <LoginScreen onOpenRegister={() => setAuthMode("register")} />
      );
    }

    if (!viewer) {
      return (
        <View style={styles.bannerCard}>
          <ActivityIndicator color={COLORS.accentSoft} size="small" />
          <Text style={styles.bannerTitle}>Sincronizando perfil</Text>
          <Text style={styles.bannerText}>
            {authError ?? "Buscando seu perfil na API antes de liberar as rotas."}
          </Text>
          <Pressable style={styles.bannerAction} onPress={() => void refreshProfile()}>
            <Text style={styles.bannerActionText}>Tentar novamente</Text>
          </Pressable>
        </View>
      );
    }

    if (selectedBook && activeTab !== "post") {
      return (
        <>
          <View style={styles.content}>
            <BookDetailScreen
              viewerId={viewer.id}
              book={selectedBook}
              onBack={() => setSelectedBook(null)}
              onOpenBook={openBookDetail}
              onLogBook={openComposerWithBook}
            />
          </View>
          {renderTabBar()}
        </>
      );
    }

    const renderContent = () => {
      if (activeTab === "home") {
        return (
          <HomeScreen
            currentStreak={viewer.currentStreak}
            viewerId={viewer.id}
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
          currentStreak={viewer.currentStreak}
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
      <>
        <View style={styles.content}>{renderContent()}</View>
        {renderTabBar()}
      </>
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
            <Text style={styles.sessionText}>{authUser ? "auth live" : "guest"}</Text>
          </View>
        </View>

        {renderShellBody()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
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
  content: {
    flex: 1,
    minHeight: 0
  },
  bannerCard: {
    alignItems: "flex-start",
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
