import type { APIRoute } from 'astro';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { env, validMutation } from '../../../lib/auth';
import { localStudio } from '../../../lib/db';
export const POST: APIRoute = async ({ request }) => {
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  if (!validMutation(request))
    return json({ error: 'Invalid request origin' }, 403);
  if (Number(request.headers.get('content-length')) > 4200000)
    return json({ error: 'Choose an image under 4 MB' }, 413);
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      file.size > 4000000 ||
      !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(
        file.type,
      )
    )
      return json(
        { error: 'Choose a JPEG, PNG, WebP or AVIF image under 4 MB' },
        400,
      );
    const bytes = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const source = sharp(bytes, { limitInputPixels: 40000000 }).rotate();
    const files = await Promise.all(
      [480, 960, 1800].map(async (width) => {
        const { data, info } = await source
          .clone()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer({ resolveWithObject: true });
        const filename = `media/${id}-${width}.webp`;
        let url: string;
        if (localStudio()) {
          await mkdir('public/media', { recursive: true });
          await writeFile(`public/${filename}`, data);
          url = `/${filename}`;
        } else {
          if (!env('BLOB_READ_WRITE_TOKEN'))
            throw new Error('Image storage has not been connected');
          const blob = await put(filename, data, {
            access: 'public',
            contentType: 'image/webp',
            token: env('BLOB_READ_WRITE_TOKEN'),
            addRandomSuffix: false,
          });
          url = blob.url;
        }
        return { url, width: info.width, height: info.height };
      }),
    );
    const full = files[2];
    const unique = files.filter(
      (file, index) =>
        files.findIndex((other) => other.width === file.width) === index,
    );
    return json({
      url: full.url,
      image: {
        src: full.url,
        srcset: unique.map((file) => `${file.url} ${file.width}w`).join(', '),
        width: full.width,
        height: full.height,
      },
    });
  } catch {
    return json({ error: 'Image upload failed. Please try again.' }, 400);
  }
};
