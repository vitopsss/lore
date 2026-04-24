import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { buildApiHeaders, getShareCardUrl } from "../api/client";
import i18n from "../i18n";

const createTempFileUri = (activityId: string) => {
  const writableDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

  if (!writableDirectory) {
    throw new Error(i18n.t("share.errors.directoryUnavailable"));
  }

  return `${writableDirectory}lore-share-${activityId}.png`;
};

export const shareActivityCard = async (activityId: string) => {
  const available = await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error(i18n.t("share.errors.unavailable"));
  }

  const targetUri = createTempFileUri(activityId);

  try {
    const result = await FileSystem.downloadAsync(getShareCardUrl(activityId), targetUri, {
      headers: buildApiHeaders()
    });

    if (result.status !== 200) {
      throw new Error(i18n.t("share.errors.downloadFailed"));
    }
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : i18n.t("share.errors.downloadFailed")
    );
  }

  try {
    await Sharing.shareAsync(targetUri, {
      dialogTitle: i18n.t("share.dialogTitle"),
      mimeType: "image/png",
      UTI: "public.png"
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : i18n.t("share.errors.nativeShareFailed")
    );
  }

  return targetUri;
};
