const path = require('path');

function normalizePath(p) {
  return path.resolve(p);
}

function isSubPath(parent, child) {
  const resolvedParent = path.resolve(parent) + path.sep;
  const resolvedChild = path.resolve(child);
  return resolvedChild.startsWith(resolvedParent) || resolvedChild === path.resolve(parent);
}

module.exports = { normalizePath, isSubPath };
