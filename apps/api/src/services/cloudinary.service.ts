import { v2 as cloudinary } from "cloudinary";

import { env } from "../config/env";

const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET
  });
}

export const uploadGeneratedCard = async (buffer: Buffer, publicId: string) => {
  if (!isCloudinaryConfigured) {
    return null;
  }

  const base64Payload = `data:image/png;base64,${buffer.toString("base64")}`;
  const uploadResult = await cloudinary.uploader.upload(base64Payload, {
    folder: "margem/cards",
    public_id: publicId,
    overwrite: true,
    resource_type: "image"
  });

  return uploadResult.secure_url;
};
