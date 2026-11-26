const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// The request starts before fetching or decoding. A later choice owns the UI.
export function createImageLoader({ decode, onLoad, onLoading, onError }) {
  let generation = 0;
  return async function load(read, name, isSample = false) {
    const token = ++generation;
    onLoading(true);
    try {
      const blob = await read();
      if (token !== generation) return;
      if (blob.size > 20 * 1024 * 1024)
        throw new Error("Choose a file smaller than 20 MB.");
      if (!IMAGE_TYPES.has(blob.type))
        throw new Error("Choose a JPEG, PNG or WebP photograph.");
      const bitmap = await decode(blob);
      if (token !== generation) {
        bitmap.close();
        return;
      }
      if (
        bitmap.width * bitmap.height > 12_000_000 ||
        bitmap.width > 16000 ||
        bitmap.height > 16000
      ) {
        bitmap.close();
        throw new Error(
          "Choose an image of 12 megapixels or less (maximum edge 16,000 pixels).",
        );
      }
      await onLoad(bitmap, blob, name, isSample);
    } catch (error) {
      if (token === generation) onError(error);
    } finally {
      if (token === generation) onLoading(false);
    }
  };
}
