const { getCredential, storeCredential } = require('./credentialService');

// For API/metadata requests (expects JSON responses)
async function plexFetch(serverUrl, path, token) {
  const url = `${serverUrl.replace(/\/$/, '')}${path}`;
  const response = await fetch(url, {
    headers: {
      'X-Plex-Token': token,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Plex API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

// For binary/media downloads (no Accept: application/json, token in query string)
async function plexDownload(serverUrl, path, token) {
  const base = `${serverUrl.replace(/\/$/, '')}${path}`;
  const separator = base.includes('?') ? '&' : '?';
  const url = `${base}${separator}X-Plex-Token=${encodeURIComponent(token)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Plex download error: ${response.status} ${response.statusText}`);
  }

  return response;
}

async function connect(serverUrl, token) {
  // Verify connection by fetching server identity
  const response = await plexFetch(serverUrl, '/', token);
  const data = await response.json();

  const serverName = data.MediaContainer?.friendlyName || 'Plex Server';

  // Store server_url alongside token so it can be recalled later
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
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');
  return cred.decrypted_data.server_url || null;
}

async function getLibraries(credentialId, serverUrl) {
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');

  if (!serverUrl) {
    throw new Error('Server URL is required');
  }

  const response = await plexFetch(serverUrl, '/library/sections', cred.decrypted_data.token);
  const data = await response.json();

  const sections = data.MediaContainer?.Directory || [];
  return sections
    .filter(s => s.type === 'photo')
    .map(s => ({
      key: s.key,
      title: s.title,
      type: s.type,
      count: s.leafCount || 0,
    }));
}

async function getLibraryItems(credentialId, serverUrl, sectionId) {
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');

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
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');
  const token = cred.decrypted_data.token;

  // Support album-scoped paths: "sectionId/album/ratingKey"
  let sectionId = sourcePath;
  let albumKey = null;
  if (sourcePath.includes('/album/')) {
    const parts = sourcePath.split('/album/');
    sectionId = parts[0];
    albumKey = parts[1];
  }

  const photos = [];

  function extractPhotos(items) {
    for (const item of items) {
      if (item.Media) {
        for (const media of item.Media) {
          for (const part of media.Part || []) {
            photos.push({
              file_path: part.key || item.thumb,
              file_name: item.title || 'Unknown',
            });
          }
        }
      } else if (item.thumb) {
        photos.push({
          file_path: item.thumb,
          file_name: item.title || 'Unknown',
        });
      }
    }
  }

  if (albumKey) {
    // Album-scoped: only scan this specific album and its children
    await collectPhotosFromContainer(serverUrl, token, albumKey, extractPhotos);
  } else {
    // Full section scan
    // 1. Get direct photos at library root (type=13)
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

    // 2. Get all albums/collections (type=14) and traverse into each
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

    // Separate photos from nested albums
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

    // Recurse into nested albums
    for (const nested of nestedAlbums) {
      await collectPhotosFromContainer(serverUrl, token, nested.ratingKey, extractPhotos);
    }
  } catch (err) {
    console.error(`Error fetching children for ${ratingKey}:`, err.message);
  }
}

async function getSectionContents(credentialId, serverUrl, sectionId) {
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');
  const token = cred.decrypted_data.token;

  const albums = [];
  const photos = [];

  // Get albums (type=14)
  try {
    const albumResponse = await plexFetch(serverUrl, `/library/sections/${sectionId}/all?type=14`, token);
    const albumData = await albumResponse.json();
    for (const album of albumData.MediaContainer?.Metadata || []) {
      albums.push({
        title: album.title,
        ratingKey: album.ratingKey,
        thumb: album.thumb,
        leafCount: album.leafCount || 0,
      });
    }
  } catch (err) {
    console.error('Error fetching section albums:', err.message);
  }

  // Get direct photos (type=13)
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
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');
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
        leafCount: child.leafCount || 0,
      });
    }
  }

  return { albums, photos };
}

async function downloadPhoto(credentialId, serverUrl, photoKey) {
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');

  // Use the photo transcode endpoint with large dimensions to get full-quality image.
  // Direct /library/parts/ downloads return 503 on some Plex servers,
  // but the transcode endpoint reliably serves photos at any requested size.
  const transcodeUrl = `/photo/:/transcode?width=7680&height=4320&minSize=1&url=${encodeURIComponent(photoKey)}`;
  const response = await plexDownload(serverUrl, transcodeUrl, cred.decrypted_data.token);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());

  return { buffer, contentType };
}

async function getThumbnail(credentialId, serverUrl, photoKey) {
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');

  try {
    const transcodeUrl = `/photo/:/transcode?width=200&height=200&minSize=1&url=${encodeURIComponent(photoKey)}`;
    const response = await plexDownload(serverUrl, transcodeUrl, cred.decrypted_data.token);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, contentType };
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
  getThumbnail,
};
