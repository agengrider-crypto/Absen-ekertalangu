// Resize an image File to a max dimension (default 320px), return a JPEG/PNG data URL.
export function resizeImageFile(file, maxSize = 320, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Tidak ada berkas"));
    const okTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!okTypes.includes(file.type)) {
      return reject(new Error("Format harus JPG atau PNG"));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === "image/png";
        const out = isPng
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", quality);
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
