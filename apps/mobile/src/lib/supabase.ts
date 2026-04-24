import { AppState, Platform } from "react-native";
import type { SupportedStorage } from "@supabase/auth-js";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import "react-native-url-polyfill/auto";

import {
  HAS_SUPABASE_AUTH_CONFIG,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL
} from "../config";

const secureStoreStorage: SupportedStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
  setItem: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    })
};

export const supabase = HAS_SUPABASE_AUTH_CONFIG
  ? createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        ...(Platform.OS !== "web" ? { storage: secureStoreStorage } : {}),
        autoRefreshToken: true,
        detectSessionInUrl: false,
        lock: processLock,
        persistSession: true
      }
    })
  : null;

if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      supabase.auth.startAutoRefresh();
      return;
    }

    supabase.auth.stopAutoRefresh();
  });
}
