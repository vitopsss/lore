import { env } from "../config/env";

export const buildAmazonAffiliateLink = (
  isbn?: string | null,
  originalUrl?: string | null
) => {
  if (originalUrl) {
    try {
      const normalizedUrl = new URL(originalUrl);
      normalizedUrl.searchParams.set("tag", env.AMAZON_ASSOCIATE_TAG);
      return normalizedUrl.toString();
    } catch {
      // Falls back to an ISBN search URL when manual payloads send an invalid link.
    }
  }

  if (!isbn) {
    return null;
  }

  const amazonUrl = new URL("https://www.amazon.com.br/s");
  amazonUrl.searchParams.set("k", isbn);
  amazonUrl.searchParams.set("tag", env.AMAZON_ASSOCIATE_TAG);
  return amazonUrl.toString();
};
