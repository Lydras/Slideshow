const fs = require('fs');
const path = require('path');
const os = require('os');
const { isImageFile } = require('../utils/imageExtensions');

// Blocked system paths (Windows)
const BLOCKED_PATHS_WIN = [
  'windows', 'program files', 'program files (x86)', '$recycle.bin',
  'system volume information', 'programdata', 'recovery',
];

function isBlockedPath(name) {
  if (process.platform === 'win32') {
    return BLOCKED_PATHS_WIN.includes(name.toLowerCase());
  }
  return false;
}

function isHiddenEntry(name) {
  if (name.startsWith('.')) return true;
  if (name.startsWith('$')) return true;
  return false;
}

function listDrives() {
  // On Windows, list available drive letters
  const drives = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const drivePath = `${letter}:\\`;
    try {
      fs.accessSync(drivePath, fs.constants.R_OK);
      drives.push({
        name: `${letter}:`,
        path: drivePath,
        type: 'directory',
      });
    } catch {
      // Drive not available
    }
  }
  return drives;
}

function browseLocal(requestedPath, page = 1, limit = 100) {
  // On Windows with no path: list drives
  if (!requestedPath && process.platform === 'win32') {
    const drives = listDrives();
    return {
      entries: drives,
      path: '',
      parent: null,
      total: drives.length,
      page: 1,
      pages: 1,
    };
  }

  const browsePath = requestedPath || os.homedir();
  const resolvedPath = path.resolve(browsePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error('Path does not exist');
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error('Path is not a directory');
  }

  let entries;
  try {
    entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
  } catch (err) {
    throw new Error('Cannot read directory: ' + err.message);
  }

  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (isHiddenEntry(entry.name)) continue;
    if (isBlockedPath(entry.name)) continue;

    const entryPath = path.join(resolvedPath, entry.name);

    if (entry.isDirectory()) {
      dirs.push({
        name: entry.name,
        path: entryPath,
        type: 'directory',
      });
    } else if (entry.isFile() && isImageFile(entry.name)) {
      files.push({
        name: entry.name,
        path: entryPath,
        type: 'file',
      });
    }
  }

  // Sort alphabetically
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  // Directories first, then image files
  const allEntries = [...dirs, ...files];
  const total = allEntries.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.max(1, Math.min(page, pages));
  const start = (clampedPage - 1) * limit;
  const pageEntries = allEntries.slice(start, start + limit);

  // Calculate parent path
  const parentPath = path.dirname(resolvedPath);
  const parent = parentPath !== resolvedPath ? parentPath : null;

  return {
    entries: pageEntries,
    path: resolvedPath,
    parent,
    total,
    page: clampedPage,
    pages,
    imageCount: files.length,
    dirCount: dirs.length,
  };
}

module.exports = { browseLocal };
