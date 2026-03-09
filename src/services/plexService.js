const { getCredential, storeCredential } = require('./credentialService');

function requireCredential(credentialId) {
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');
  return cred;
}

function getPlexCount(entry) {
  const candidates = [entry?.leafCount, entry?.totalSize, entry?.count];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function getPlexHeaders(token, accept = 'application/json') {
  return {
    'X-Plex-Token': token,
    Accept: accept,
    'X-Plex-Client-Identifier': 'slideshow-app',
    'X-Plex-Product': 'Slideshow',
    'X-Plex-Version': '1.0.0',
    'X-Plex-Platform': 'Node.js',
    'X-Plex-Platform-Version': process.version,
    'X-Plex-Device': 'Server',
    'X-Plex-Device-Name': 'Slideshow Server',
  };
}

function withQueryParams(requestPath, params) {
  const separator = requestPath.includes('?') ? '&' : '?';
  return requestPath + separator + params;
}

async function plexFetch(serverUrl, requestPath, token) {
  const url = `${serverUrl.replace(/\/$/, '')}${requestPath}`;
  const response = await fetch(url, {
    headers: getPlexHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Plex API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

async function plexDownload(serverUrl, requestPath, token, options = {}) {
  const requestWithParams = options.query ? withQueryParams(requestPath, options.query) : requestPath;
  const url = `${serverUrl.replace(/\/$/, '')}${requestWithParams}`;
  const response = await fetch(url, {
    headers: getPlexHeaders(token, options.accept || '*/*'),
  });

  if (!response.ok) {
    throw new Error(`Plex download error: ${response.status} ${response.statusText}`);
  }

  return response;
}

async function downloadDirectResource(serverUrl, resourcePath, token, accept = "*/*") {
  const response = await plexDownload(serverUrl, resourcePath, token, { accept });
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}

async function connect(serverUrl, token) {
  const response = await plexFetch(serverUrl, '/', token);
  const data = await response.json();
  const serverName = data.MediaContainer?.friendlyName || 'Plex Server';

  const credentialId = storeCredential('plex', `Plex: ${serverName}`, {
    token,
    server_url: serverUrl,
  });

  return {
    credential_id: credentialId,
    server_name: serverName,
  };
}

function getServerUrl(credentialId) {
  const cred = requireCredential(credentialId);
  return cred.decrypted_data.server_url || null;
}

async function getLibraries(credentialId, serverUrl) {
  const cred = requireCredential(credentialId);

  if (!serverUrl) {
    throw new Error('Server URL is required');
  }

  const response = await plexFetch(serverUrl, '/library/sections', cred.decrypted_data.token);
  const data = await response.json();

  const sections = data.MediaContainer?.Directory || [];
  return sections
    .filter(section => section.type === 'photo')
    .map(section => {
      const count = getPlexCount(section);
      return {
        key: section.key,
        title: section.title,
        type: section.type,
        count,
        count_label: count === null ? 'Browse to inspect' : `${count} item${count === 1 ? '' : 's'}`,
      };
    });
}

async function getLibraryItems(credentialId, serverUrl, sectionId) {
  const cred = requireCredential(credentialId);

  const response = await plexFetch(
    serverUrl,
    `/library/sections/${sectionId}/all?type=13`,
    cred.decrypted_data.token
  );
  const data = await response.json();

  const items = data.MediaContainer?.Metadata || [];
  return items.map(item => ({
    title: item.title,
    key: item.key,
    thumb: item.thumb,
  }));
}

async function listPhotos(credentialId, serverUrl, sourcePath) {
  const cred = requireCredential(credentialId);
  const token = cred.decrypted_data.token;

  let sectionId = sourcePath;
  let albumKey = null;
  if (sourcePath.includes('/album/')) {
    const parts = sourcePath.split('/album/');
    sectionId = parts[0];
    albumKey = parts[1];
  }

  const photos = [];

  function pushPhoto(item, part) {
    photos.push({
      file_path: part?.key || item.key || item.thumb,
      file_name: item.title || 'Unknown',
      thumbnail_path: item.thumb || buildDerivedThumbPath(item) || item.key || part?.key || null,
    });
  }

  function extractPhotos(items) {
    for (const item of items) {
      if (item.Media) {
        for (const media of item.Media) {
          for (const part of media.Part || []) {
            pushPhoto(item, part);
          }
        }
      } else if (item.thumb || item.key) {
        pushPhoto(item, null);
      }
    }
  }

  if (albumKey) {
    await collectPhotosFromContainer(serverUrl, token, albumKey, extractPhotos);
  } else {
    try {
      const photoResponse = await plexFetch(
        serverUrl,
        `/library/sections/${sectionId}/all?type=13`,
        token
      );
      const photoData = await photoResponse.json();
      extractPhotos(photoData.MediaContainer?.Metadata || []);
    } catch (err) {
      console.error('Error fetching direct photos:', err.message);
    }

    try {
      const albumResponse = await plexFetch(
        serverUrl,
        `/library/sections/${sectionId}/all?type=14`,
        token
      );
      const albumData = await albumResponse.json();
      const albums = albumData.MediaContainer?.Metadata || [];

      for (const album of albums) {
        await collectPhotosFromContainer(serverUrl, token, album.ratingKey, extractPhotos);
      }
    } catch (err) {
      console.error('Error fetching albums:', err.message);
    }
  }

  return photos;
}

async function collectPhotosFromContainer(serverUrl, token, ratingKey, extractPhotos) {
  try {
    const response = await plexFetch(
      serverUrl,
      `/library/metadata/${ratingKey}/children`,
      token
    );
    const data = await response.json();
    const children = data.MediaContainer?.Metadata || [];

    const nestedAlbums = [];
    const photoItems = [];

    for (const child of children) {
      if (child.type === 'photo') {
        photoItems.push(child);
      } else if (child.type === 'photoAlbum' || child.type === 'clip') {
        nestedAlbums.push(child);
      }
    }

    extractPhotos(photoItems);

    for (const nested of nestedAlbums) {
      await collectPhotosFromContainer(serverUrl, token, nested.ratingKey, extractPhotos);
    }
  } catch (err) {
    console.error(`Error fetching children for ${ratingKey}:`, err.message);
  }
}

async function getSectionContents(credentialId, serverUrl, sectionId) {
  const cred = requireCredential(credentialId);
  const token = cred.decrypted_data.token;

  const albums = [];
  const photos = [];

  try {
    const albumResponse = await plexFetch(serverUrl, `/library/sections/${sectionId}/all?type=14`, token);
    const albumData = await albumResponse.json();
    for (const album of albumData.MediaContainer?.Metadata || []) {
      albums.push({
        title: album.title,
        ratingKey: album.ratingKey,
        thumb: album.thumb,
        leafCount: getPlexCount(album),
      });
    }
  } catch (err) {
    console.error('Error fetching section albums:', err.message);
  }

  try {
    const photoResponse = await plexFetch(serverUrl, `/library/sections/${sectionId}/all?type=13`, token);
    const photoData = await photoResponse.json();
    for (const photo of photoData.MediaContainer?.Metadata || []) {
      photos.push({
        title: photo.title,
        key: photo.key,
        thumb: photo.thumb,
      });
    }
  } catch (err) {
    console.error('Error fetching section photos:', err.message);
  }

  return { albums, photos };
}

async function getContainerChildren(credentialId, serverUrl, ratingKey) {
  const cred = requireCredential(credentialId);
  const token = cred.decrypted_data.token;

  const response = await plexFetch(serverUrl, `/library/metadata/${ratingKey}/children`, token);
  const data = await response.json();
  const children = data.MediaContainer?.Metadata || [];

  const albums = [];
  const photos = [];

  for (const child of children) {
    if (child.type === 'photo') {
      photos.push({
        title: child.title,
        key: child.key,
        thumb: child.thumb,
      });
    } else if (child.type === 'photoAlbum' || child.type === 'clip') {
      albums.push({
        title: child.title,
        ratingKey: child.ratingKey,
        thumb: child.thumb,
        leafCount: getPlexCount(child),
      });
    }
  }

  return { albums, photos };
}

async function getMetadataItem(serverUrl, token, ratingKey) {
  const response = await plexFetch(serverUrl, `/library/metadata/${ratingKey}`, token);
  const data = await response.json();
  return data.MediaContainer?.Metadata?.[0] || null;
}

function isThumbPath(photoKey) {
  return /\/thumb(?:\/|$)/.test(photoKey || '');
}

function buildDerivedThumbPath(item) {
  const ratingKey = item?.ratingKey || extractRatingKey(item?.key);
  const revision = item?.updatedAt || item?.addedAt;
  if (!ratingKey || !revision) return null;
  return `/library/metadata/${ratingKey}/thumb/${revision}`;
}
function getBestMetadataRenderPath(metadata) {
  const candidates = [metadata?.thumb, buildDerivedThumbPath(metadata), metadata?.parentThumb, metadata?.grandparentThumb, metadata?.art];
  return candidates.find(value => typeof value === 'string' && value.startsWith('/')) || null;
}

async function resolveTranscodeSource(serverUrl, token, photoKey) {
  if (!photoKey) return null;
  if (isThumbPath(photoKey)) return photoKey;

  const ratingKey = extractRatingKey(photoKey);
  if (!ratingKey) return photoKey;

  try {
    const metadata = await getMetadataItem(serverUrl, token, ratingKey);
    return getBestMetadataRenderPath(metadata) || photoKey;
  } catch (err) {
    console.error(`Error resolving Plex transcode source for ${photoKey}:`, err.message);
    return photoKey;
  }
}
function extractRatingKey(photoKey) {
  const match = /^\/library\/metadata\/(\d+)/.exec(photoKey || '');
  return match ? match[1] : null;
}

function isDirectPhotoPath(photoKey) {
  return /^\/library\/parts\//.test(photoKey || '');
}

async function resolveDownloadKey(serverUrl, token, photoKey) {
  const ratingKey = extractRatingKey(photoKey);
  if (!ratingKey) {
    return photoKey;
  }

  try {
    const response = await plexFetch(serverUrl, `/library/metadata/${ratingKey}`, token);
    const data = await response.json();
    const metadata = data.MediaContainer?.Metadata?.[0];

    for (const media of metadata?.Media || []) {
      for (const part of media.Part || []) {
        if (part?.key) {
          return part.key;
        }
      }
    }
  } catch (err) {
    console.error(`Error resolving Plex download key for ${photoKey}:`, err.message);
  }

  return photoKey;
}

async function downloadTranscodedPhoto(credentialId, serverUrl, photoKey, dimensions = {}) {
  const cred = requireCredential(credentialId);
  const width = dimensions.width || 7680;
  const height = dimensions.height || 4320;
  const token = cred.decrypted_data.token;
  const resolvedPhotoKey = await resolveTranscodeSource(serverUrl, token, photoKey);

  if (isThumbPath(resolvedPhotoKey)) {
    try {
      return await downloadDirectResource(serverUrl, resolvedPhotoKey, token);
    } catch (err) {
      console.error('Direct Plex thumb download failed for ' + resolvedPhotoKey + ':', err.message);
    }
  }

  const transcodeUrl = `/photo/:/transcode?width=${width}&height=${height}&minSize=1&upscale=1&url=${encodeURIComponent(resolvedPhotoKey)}`;
  const response = await plexDownload(serverUrl, transcodeUrl, token);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}

async function downloadBestPhoto(credentialId, serverUrl, image) {
  const transcodedSource = image?.thumbnail_path || image?.file_path;

  if (transcodedSource) {
    try {
      return await downloadTranscodedPhoto(credentialId, serverUrl, transcodedSource);
    } catch (err) {
      console.error(`Plex transcoded photo failed for ${transcodedSource}:`, err.message);
    }
  }

  return downloadPhoto(credentialId, serverUrl, image.file_path);
}

async function downloadPhoto(credentialId, serverUrl, photoKey) {
  const cred = requireCredential(credentialId);
  const token = cred.decrypted_data.token;
  const resolvedPhotoKey = await resolveDownloadKey(serverUrl, token, photoKey);

  const response = isDirectPhotoPath(resolvedPhotoKey)
    ? await plexDownload(serverUrl, resolvedPhotoKey, token, { query: 'download=1' })
    : await plexDownload(
      serverUrl,
      `/photo/:/transcode?width=7680&height=4320&minSize=1&url=${encodeURIComponent(resolvedPhotoKey)}`,
      token
    );
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());

  return { buffer, contentType };
}

async function getThumbnail(credentialId, serverUrl, photoKey) {
  const cred = requireCredential(credentialId);

  try {
    return await downloadTranscodedPhoto(credentialId, serverUrl, photoKey, { width: 200, height: 200 });
  } catch (err) {
    console.error(`Plex thumbnail failed for ${photoKey}:`, err.message);
    return null;
  }
}

module.exports = {
  connect,
  getServerUrl,
  getLibraries,
  getLibraryItems,
  getSectionContents,
  getContainerChildren,
  listPhotos,
  downloadPhoto,
  downloadBestPhoto,
  getThumbnail,
};
