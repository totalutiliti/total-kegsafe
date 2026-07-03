/**
 * Validação de assinatura (magic bytes) de arquivos de imagem.
 *
 * NÃO confia no Content-Type declarado pelo cliente (facilmente spoofável) —
 * inspeciona os primeiros bytes do conteúdo real. Usado para impedir que um
 * arquivo malicioso (HTML/SVG/executável) seja gravado disfarçado de imagem.
 */
export interface DetectedImage {
  mime: string;
  ext: string;
}

/** Retorna o tipo detectado se o buffer for uma imagem suportada, ou null. */
export function detectImage(buffer: Buffer): DetectedImage | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }

  // GIF: "GIF87a" ou "GIF89a"
  const head6 = buffer.toString('ascii', 0, 6);
  if (head6 === 'GIF87a' || head6 === 'GIF89a') {
    return { mime: 'image/gif', ext: '.gif' };
  }

  // WebP: "RIFF"...."WEBP"
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }

  return null;
}
