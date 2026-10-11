export async function optimizedUpload(file: File) {
  if (file.size > 30000000) throw new Error('Choose an image under 30 MB.');
  const image = await createImageBitmap(file);
  if (image.width * image.height > 40000000) {
    image.close();
    throw new Error('Choose an image under 40 megapixels.');
  }
  const ratio = Math.min(1, 1800 / image.width, 3600 / image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    image.close();
    throw new Error('Image preparation failed.');
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error('Image preparation failed.')),
      'image/webp',
      0.85,
    ),
  );
  if (blob.size > 4000000) throw new Error('Choose a smaller image.');
  return new File([blob], 'image.webp', { type: blob.type });
}
