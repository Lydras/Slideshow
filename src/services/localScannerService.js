const fs = require('fs');
const path = require('path');
const { isImageFile } = require('../utils/imageExtensions');

function scanDirectory(dirPath, includeSubfolders = true) {
  const images = [];

  function scan(currentPath) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (err) {
      console.warn(`Skipping directory ${currentPath}:`, err.message);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory() && includeSubfolders) {
        scan(fullPath);
      } else if (entry.isFile() && isImageFile(entry.name)) {
        images.push({
          file_path: fullPath,
          file_name: entry.name,
        });
      }
    }
  }

  scan(dirPath);
  return images;
}

module.exports = { scanDirectory };
