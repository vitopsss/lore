import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { getShareCardUrl } from "../api/client";

const createTempFileUri = (activityId: string) => {
  const writableDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

  if (!writableDirectory) {
    throw new Error("Não foi possível preparar um diretório local para compartilhar o card.");
  }

  return `${writableDirectory}lore-share-${activityId}.png`;
};

export const shareActivityCard = async (activityId: string) => {
  const available = await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error("O compartilhamento nativo não está disponível neste dispositivo.");
  }

  const targetUri = createTempFileUri(activityId);

  try {
    await FileSystem.downloadAsync(getShareCardUrl(activityId), targetUri);
  } catch {
    throw new Error("Não foi possível baixar o card para compartilhar.");
  }

  await Sharing.shareAsync(targetUri, {
    dialogTitle: "Compartilhar no Instagram",
    mimeType: "image/png",
    UTI: "public.png"
  });

  return targetUri;
};
