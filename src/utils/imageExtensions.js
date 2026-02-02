const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif', '.ico', '.avif',
]);

function isImageFile(filename) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

module.exports = { IMAGE_EXTENSIONS, isImageFile };
