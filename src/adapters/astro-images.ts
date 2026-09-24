import type { ImageMetadata } from "astro";

/** Every build-time image, keyed by its path below src/assets/ ("profile/face.png"). */
const images = import.meta.glob<{ default: ImageMetadata }>("/src/assets/**/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG,WEBP,AVIF}", {
  eager: true,
});

/** Resolves a validated content image path to the metadata Astro's `<Picture>` optimizes. */
export function imageAt(imagePath: string): ImageMetadata {
  const image = images[`/src/assets/${imagePath}`];
  if (!image) throw new Error(`Image "src/assets/${imagePath}" is not bundled; the loader should have rejected it.`);
  return image.default;
}
