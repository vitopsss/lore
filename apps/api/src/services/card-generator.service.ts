import { createCanvas, loadImage } from "@napi-rs/canvas";

import { CARD_THEMES, DEFAULT_CARD_THEME } from "../constants/card-themes";
import type { CardThemeName } from "../types/domain";

const WIDTH = 1080;
const HEIGHT = 1920;
const COVER_WIDTH = 430;
const COVER_HEIGHT = 640;
type Canvas2DContext = NonNullable<
  ReturnType<ReturnType<typeof createCanvas>["getContext"]>
>;
type LoadedImage = Awaited<ReturnType<typeof loadImage>>;

const sanitizeFileSegment = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "story";

const drawRoundedRect = (
  context: Canvas2DContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
};

const drawCoverImage = (
  context: Canvas2DContext,
  image: LoadedImage,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const ratio = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  const offsetX = x - (drawWidth - width) / 2;
  const offsetY = y - (drawHeight - height) / 2;

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
};

const buildLines = (
  context: Canvas2DContext,
  text: string,
  maxWidth: number,
  maxLines: number
) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  const trimmedLines = lines.slice(0, maxLines);

  if (lines.length > maxLines) {
    const lastLine = trimmedLines[maxLines - 1] ?? "";
    trimmedLines[maxLines - 1] = `${lastLine.replace(/[.,;:!?]?$/, "")}\u2026`;
  }

  return trimmedLines;
};

const drawCenteredTextBlock = (
  context: Canvas2DContext,
  text: string,
  {
    x,
    y,
    maxWidth,
    lineHeight,
    maxLines
  }: {
    x: number;
    y: number;
    maxWidth: number;
    lineHeight: number;
    maxLines: number;
  }
) => {
  const lines = buildLines(context, text, maxWidth, maxLines);

  lines.forEach((line, index) => {
    const metrics = context.measureText(line);
    context.fillText(line, x - metrics.width / 2, y + lineHeight * index);
  });
};

const drawStar = (
  context: Canvas2DContext,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number
) => {
  context.beginPath();

  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
};

const drawRatingRow = (context: Canvas2DContext, rating: number | null, accent: string) => {
  if (!rating) {
    context.fillStyle = "rgba(248, 244, 234, 0.55)";
    context.font = "600 26px Arial";
    const label = "Sem nota";
    context.fillText(label, WIDTH / 2 - context.measureText(label).width / 2, 980);
    return;
  }

  const safeRating = Math.max(1, Math.min(5, rating));
  const spacing = 70;
  const startX = WIDTH / 2 - ((5 - 1) * spacing) / 2;

  for (let index = 0; index < 5; index += 1) {
    const cx = startX + index * spacing;
    drawStar(context, cx, 952, 24, 10);
    context.fillStyle = index < safeRating ? accent : "rgba(255, 255, 255, 0.18)";
    context.fill();
  }
};

const toExcerpt = (text?: string | null) => {
  const normalized = text?.trim();

  if (!normalized) {
    return "Sem trecho destacado para este post.";
  }

  return normalized.length > 220 ? `${normalized.slice(0, 217).trimEnd()}\u2026` : normalized;
};

const createFallbackCover = (
  context: Canvas2DContext,
  title: string,
  accent: string,
  x: number,
  y: number
) => {
  drawRoundedRect(context, x, y, COVER_WIDTH, COVER_HEIGHT, 36);
  context.fillStyle = "rgba(255, 255, 255, 0.06)";
  context.fill();

  context.strokeStyle = "rgba(255, 255, 255, 0.12)";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = accent;
  context.font = "700 26px Arial";
  context.fillText("SEM CAPA", x + 44, y + 76);

  context.fillStyle = "#f4efe6";
  context.font = "700 42px Georgia";
  drawCenteredTextBlock(context, title, {
    x: x + COVER_WIDTH / 2,
    y: y + 200,
    maxWidth: COVER_WIDTH - 84,
    lineHeight: 54,
    maxLines: 5
  });
};

const drawBackground = (context: Canvas2DContext, accent: string) => {
  const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#05070d");
  gradient.addColorStop(1, "#101521");
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.globalAlpha = 0.14;
  context.fillStyle = accent;
  context.beginPath();
  context.arc(220, 260, 260, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(900, 1540, 300, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
};

export interface ShareCardRenderInput {
  activityId: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  rating: number | null;
  excerpt?: string | null;
  theme?: CardThemeName;
  showExcerpt?: boolean;
}

export interface GeneratedStoryCard {
  width: number;
  height: number;
  theme: CardThemeName;
  base64: string;
  cloudinaryUrl: string | null;
  sharePath: string;
}

export interface GeneratedStoryCardImage {
  width: number;
  height: number;
  theme: CardThemeName;
  fileName: string;
  contentType: "image/png";
  buffer: Buffer;
}

const renderStoryCard = async (
  input: ShareCardRenderInput
): Promise<GeneratedStoryCardImage> => {
  const theme = input.theme ?? DEFAULT_CARD_THEME;
  const accent = CARD_THEMES[theme].accent;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const context = canvas.getContext("2d");
  const excerpt = toExcerpt(input.excerpt);
  const showExcerpt = input.showExcerpt ?? true;

  drawBackground(context, accent);

  drawRoundedRect(context, 54, 54, WIDTH - 108, HEIGHT - 108, 52);
  context.fillStyle = "rgba(7, 10, 16, 0.82)";
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.lineWidth = 2;
  context.stroke();

  const coverX = (WIDTH - COVER_WIDTH) / 2;
  const coverY = 240;

  if (input.coverUrl) {
    try {
      const cover = await loadImage(input.coverUrl);
      context.save();
      drawRoundedRect(context, coverX, coverY, COVER_WIDTH, COVER_HEIGHT, 36);
      context.clip();
      drawCoverImage(context, cover, coverX, coverY, COVER_WIDTH, COVER_HEIGHT);
      context.restore();

      context.strokeStyle = "rgba(255, 255, 255, 0.12)";
      context.lineWidth = 2;
      drawRoundedRect(context, coverX, coverY, COVER_WIDTH, COVER_HEIGHT, 36);
      context.stroke();
    } catch {
      createFallbackCover(context, input.title, accent, coverX, coverY);
    }
  } else {
    createFallbackCover(context, input.title, accent, coverX, coverY);
  }

  drawRatingRow(context, input.rating, accent);

  context.fillStyle = "#f8f4ea";
  context.font = "700 70px Georgia";
  drawCenteredTextBlock(context, input.title, {
    x: WIDTH / 2,
    y: 1088,
    maxWidth: 820,
    lineHeight: 82,
    maxLines: 3
  });

  context.fillStyle = "rgba(248, 244, 234, 0.72)";
  context.font = "500 34px Arial";
  drawCenteredTextBlock(context, input.author, {
    x: WIDTH / 2,
    y: showExcerpt ? 1340 : 1428,
    maxWidth: 760,
    lineHeight: 42,
    maxLines: 2
  });

  if (showExcerpt) {
    drawRoundedRect(context, 112, 1440, 856, 262, 34);
    context.fillStyle = "rgba(255, 255, 255, 0.05)";
    context.fill();

    context.fillStyle = "rgba(255, 255, 255, 0.52)";
    context.font = "700 24px Arial";
    context.fillText("TRECHO", 154, 1496);

    context.fillStyle = "#f1ebdd";
    context.font = "500 42px Arial";
    const excerptLines = buildLines(context, excerpt, 760, 4);
    excerptLines.forEach((line, index) => {
      context.fillText(line, 154, 1578 + index * 52);
    });
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(124, HEIGHT - 178);
  context.lineTo(WIDTH - 124, HEIGHT - 178);
  context.stroke();

  context.fillStyle = "rgba(255, 255, 255, 0.68)";
  context.font = "600 28px Arial";
  const watermark = "Gerado no Book-Boxd";
  context.fillText(
    watermark,
    WIDTH / 2 - context.measureText(watermark).width / 2,
    HEIGHT - 118
  );

  const buffer = Buffer.from(await canvas.encode("png"));
  const fileName = `bookboxd-story-${sanitizeFileSegment(input.title)}.png`;

  return {
    width: WIDTH,
    height: HEIGHT,
    theme,
    fileName,
    contentType: "image/png",
    buffer
  };
};

export const buildStoryCardPreview = async (
  input: ShareCardRenderInput
): Promise<GeneratedStoryCard> => {
  const image = await renderStoryCard(input);

  return {
    width: image.width,
    height: image.height,
    theme: image.theme,
    base64: image.buffer.toString("base64"),
    cloudinaryUrl: null,
    sharePath: `/api/share/${input.activityId}`
  };
};

export const buildStoryCardImage = (input: ShareCardRenderInput) => renderStoryCard(input);
