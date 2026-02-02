const BASE_URL = '/api';

function getAuthToken() {
  return localStorage.getItem('auth_token');
}

function setAuthToken(token) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    headers,
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export { setAuthToken, getAuthToken };

export const api = {
  // Auth
  getAuthStatus: () => request('/auth/status'),
  login: (password) => request('/auth/login', { method: 'POST', body: { password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  setPassword: (password, currentPassword) =>
    request('/auth/password', { method: 'POST', body: { password, current_password: currentPassword } }),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (settings) => request('/settings', { method: 'PUT', body: settings }),

  // Sources
  getSources: () => request('/sources'),
  getSource: (id) => request(`/sources/${id}`),
  createSource: (data) => request('/sources', { method: 'POST', body: data }),
  updateSource: (id, data) => request(`/sources/${id}`, { method: 'PUT', body: data }),
  deleteSource: (id) => request(`/sources/${id}`, { method: 'DELETE' }),
  scanSource: (id) => request(`/sources/${id}/scan`, { method: 'POST' }),
  getSourceImages: (id) => request(`/sources/${id}/images`),

  // Source image selection
  updateBulkImageSelection: (sourceId, selected, imageIds) =>
    request(`/sources/${sourceId}/images/selection`, {
      method: 'PUT',
      body: { selected, image_ids: imageIds },
    }),
  getSourceImageCounts: (sourceId) => request(`/sources/${sourceId}/images/counts`),

  // Thumbnails
  getThumbnailUrl: (sourceId, imageId) => `${BASE_URL}/images/thumbnail/${sourceId}/${imageId}`,

  // Playlists
  getPlaylists: () => request('/playlists'),
  getPlaylist: (id) => request(`/playlists/${id}`),
  createPlaylist: (data) => request('/playlists', { method: 'POST', body: data }),
  updatePlaylist: (id, data) => request(`/playlists/${id}`, { method: 'PUT', body: data }),
  deletePlaylist: (id) => request(`/playlists/${id}`, { method: 'DELETE' }),
  addPlaylistSource: (playlistId, sourceId, sortOrder) =>
    request(`/playlists/${playlistId}/sources`, { method: 'POST', body: { source_id: sourceId, sort_order: sortOrder } }),
  removePlaylistSource: (playlistId, sourceId) =>
    request(`/playlists/${playlistId}/sources`, { method: 'DELETE', body: { source_id: sourceId } }),

  // Playlist image selection
  getPlaylistImages: (playlistId) => request(`/playlists/${playlistId}/images`),
  setPlaylistImages: (playlistId, imageIds) =>
    request(`/playlists/${playlistId}/images`, { method: 'PUT', body: { image_ids: imageIds } }),
  clearPlaylistImages: (playlistId) =>
    request(`/playlists/${playlistId}/images`, { method: 'DELETE' }),

  // Images
  getImages: (playlistId) => request(`/images${playlistId ? `?playlist_id=${playlistId}` : ''}`),

  // Credentials
  getCredentials: () => request('/credentials'),
  deleteCredential: (id) => request(`/credentials/${id}`, { method: 'DELETE' }),

  // Dropbox
  getDropboxAuthUrl: (appKey, appSecret) =>
    request(`/dropbox/auth-url?app_key=${encodeURIComponent(appKey)}&app_secret=${encodeURIComponent(appSecret)}`),
  getDropboxFolders: (credentialId, path = '') =>
    request(`/dropbox/${credentialId}/folders${path ? `?path=${encodeURIComponent(path)}` : ''}`),

  // Plex
  connectPlex: (data) => request('/plex/connect', { method: 'POST', body: data }),
  getPlexServerInfo: (credentialId) => request(`/plex/${credentialId}/info`),
  getPlexLibraries: (credentialId, serverUrl) => {
    const params = serverUrl ? `?server_url=${encodeURIComponent(serverUrl)}` : '';
    return request(`/plex/${credentialId}/libraries${params}`);
  },
  getPlexLibraryItems: (credentialId, sectionId, serverUrl) => {
    const params = serverUrl ? `?server_url=${encodeURIComponent(serverUrl)}` : '';
    return request(`/plex/${credentialId}/libraries/${sectionId}/items${params}`);
  },
  getPlexSectionContents: (credentialId, sectionId, serverUrl) => {
    const params = serverUrl ? `?server_url=${encodeURIComponent(serverUrl)}` : '';
    return request(`/plex/${credentialId}/libraries/${sectionId}/contents${params}`);
  },
  getPlexContainerChildren: (credentialId, ratingKey, serverUrl) => {
    const params = serverUrl ? `?server_url=${encodeURIComponent(serverUrl)}` : '';
    return request(`/plex/${credentialId}/browse/${ratingKey}${params}`);
  },
  getPlexThumbnailUrl: (credentialId, thumbPath, serverUrl) => {
    const params = new URLSearchParams();
    params.set('path', thumbPath);
    if (serverUrl) params.set('server_url', serverUrl);
    return `${BASE_URL}/plex/${credentialId}/thumb?${params.toString()}`;
  },

  // Cache
  getCacheStats: () => request('/cache/stats'),
  clearCache: () => request('/cache', { method: 'DELETE' }),

  // Browse
  browseLocal: (browsePath, page, limit) => {
    const params = new URLSearchParams();
    if (browsePath) params.set('path', browsePath);
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    return request(`/browse/local?${params.toString()}`);
  },
};
