const MAX_SIDE = 1600;
const QUALITY = 0.85;

async function loadImage(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try {
      // EXIF 회전 반영
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* 일부 브라우저/형식은 아래 <img> 경로로 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 긴 변 1600px 이하로 줄여 JPEG(q=0.85) Blob 으로 */
export async function downsizeImage(file: Blob): Promise<Blob> {
  const src = await loadImage(file).catch(() => {
    throw new Error(
      '이 사진 형식은 이 브라우저에서 열 수 없어요. (아이폰 HEIC 사진은 아이폰에서 바로 찍거나 JPG로 올려 주세요)'
    );
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  if ('close' in src && typeof src.close === 'function') src.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', QUALITY)
  );
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}
