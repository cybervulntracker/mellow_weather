// Centre-crops any picture to a square and shrinks it, so what we upload
// (and store in the database) is a ~30 KB JPEG instead of a 6 MB phone photo.
export async function fileToAvatarDataUrl(file, size = 256) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error("Please choose a PNG, JPG or WebP image.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("That image is larger than 10 MB.");

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("We couldn't read that image."));
      el.src = url;
    });

    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // flatten transparency for JPEG
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}
