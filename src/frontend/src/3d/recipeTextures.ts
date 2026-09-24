import { SRGBColorSpace, CanvasTexture } from "three";

import { wrapLongLines } from "./utils/wrapLongLines.ts";

export function createRecipeTexture(
  title: string,
  accent: string,
  background: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, background);
  gradient.addColorStop(1, accent);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#4a331f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(canvas.width - 100, canvas.height / 2);
  ctx.rotate(Math.PI / 2);

  let fontSize = 35;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  while (ctx.measureText(title).width > canvas.height - 64 && fontSize > 24) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px serif`;
  }
  ctx.fillText(title, 0, 0);

  if (title) {
    ctx.font = "24px serif";
    ctx.fillStyle = "#5a442b";
    const lines = wrapLongLines(
      "ricetta: PALLE AL SUGO DEL DIOSBORRAAUSTRALOPITECOPATETICO",
    );

    ctx.textAlign = "center";
    const lineHeight = 30;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2 - 320, startY + index * lineHeight);
    });

    ctx.font = "italic 24px Georgia, serif";
    ctx.fillStyle = "#5a442b";
    ctx.textAlign = "left";
    ctx.fillText("firma dell'autore sconosciuto dio cane", -200, 480);
  }

  ctx.restore();
  ctx.strokeStyle = "#a58362";
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 15, canvas.width - 20, canvas.height - 30);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
