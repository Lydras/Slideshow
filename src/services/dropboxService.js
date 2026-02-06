const { Dropbox } = require('dropbox');
const { getCredential, storeCredential, updateCredential } = require('./credentialService');

function getDropboxClient(credentialId) {
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');

  const data = cred.decrypted_data;
  const dbx = new Dropbox({
    accessToken: data.access_token,
    clientId: data.app_key,
    clientSecret: data.app_secret,
    refreshToken: data.refresh_token,
  });

  return { dbx, data, credentialId };
}

async function performTokenRefresh(credentialId, data) {
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
      client_id: data.app_key,
      client_secret: data.app_secret,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to refresh Dropbox token: ${err}`);
  }

  const tokenData = await response.json();
  const updated = {
    ...data,
    access_token: tokenData.access_token,
    expires_at: Date.now() + tokenData.expires_in * 1000,
  };

  updateCredential(credentialId, updated);
  return updated;
}

async function refreshTokenIfNeeded(credentialId) {
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');

  const data = cred.decrypted_data;
  if (data.expires_at && Date.now() < data.expires_at - 300000) {
    // Token still valid (5-min buffer)
    return data;
  }

  if (!data.refresh_token || !data.app_key || !data.app_secret) {
    throw new Error('Cannot refresh token: missing refresh_token or app credentials');
  }

  return performTokenRefresh(credentialId, data);
}

// Force a token refresh regardless of expires_at
async function forceRefresh(credentialId) {
  const cred = getCredential(credentialId);
  if (!cred) throw new Error('Credential not found');
  const data = cred.decrypted_data;

  if (!data.refresh_token || !data.app_key || !data.app_secret) {
    return; // Can't refresh without these
  }

  await performTokenRefresh(credentialId, data);
}

// Extract a human-readable message from a Dropbox SDK error
function getDropboxErrorMessage(err) {
  // Plain text error response (detailed scope messages)
  if (typeof err.error === 'string') return err.error;
  // JSON error with required_scope info
  if (err.error?.error?.['.tag'] === 'missing_scope') {
    const scope = err.error.error.required_scope;
    return `Missing Dropbox permission: '${scope}'. Enable it in the Permissions tab of your Dropbox App Console, then disconnect and reconnect your account.`;
  }
  if (err.error?.error_summary) return `Dropbox error: ${err.error.error_summary}`;
  return err.message || 'Unknown Dropbox error';
}

// Retry a Dropbox operation once after forcing a token refresh on auth errors
async function withRetry(credentialId, operation) {
  try {
    await refreshTokenIfNeeded(credentialId);
    return await operation();
  } catch (err) {
    const status = err?.status || err?.error?.status;
    if (status === 400 || status === 401) {
      console.log('Dropbox auth error, forcing token refresh and retrying...');
      try {
        await forceRefresh(credentialId);
        return await operation();
      } catch (retryErr) {
        // Surface the detailed Dropbox error message
        const msg = getDropboxErrorMessage(retryErr);
        const wrapped = new Error(msg);
        wrapped.status = retryErr.status || status;
        throw wrapped;
      }
    }
    const msg = getDropboxErrorMessage(err);
    const wrapped = new Error(msg);
    wrapped.status = err.status || 500;
    throw wrapped;
  }
}

function getAuthUrl(appKey, redirectUri, state) {
  const dbx = new Dropbox({ clientId: appKey });
  return dbx.auth.getAuthenticationUrl(redirectUri, state || null, 'code', 'offline');
}

async function exchangeCodeForToken(code, appKey, appSecret, redirectUri) {
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: appKey,
      client_secret: appSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tokenData = await response.json();

  const credentialId = storeCredential('dropbox', 'Dropbox Account', {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Date.now() + tokenData.expires_in * 1000,
    app_key: appKey,
    app_secret: appSecret,
  });

  return credentialId;
}

async function listFolders(credentialId, folderPath = '') {
  return withRetry(credentialId, async () => {
    const { dbx } = getDropboxClient(credentialId);
    const folders = [];

    let response = await dbx.filesListFolder({
      path: folderPath || '',
    });

    for (const e of response.result.entries) {
      if (e['.tag'] === 'folder') folders.push({ name: e.name, path: e.path_lower });
    }

    while (response.result.has_more) {
      response = await dbx.filesListFolderContinue({ cursor: response.result.cursor });
      for (const e of response.result.entries) {
        if (e['.tag'] === 'folder') folders.push({ name: e.name, path: e.path_lower });
      }
    }

    return folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  });
}

async function listImages(credentialId, folderPath, includeSubfolders = true) {
  await forceRefresh(credentialId);

  const images = [];
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif', '.avif'];

  const { dbx } = getDropboxClient(credentialId);

  async function listDir(path) {
    const subfolders = [];

    let response = await dbx.filesListFolder({
      path: path || '',
      limit: 2000,
      include_non_downloadable_files: false,
    });

    processEntries(response.result.entries);

    while (response.result.has_more) {
      response = await dbx.filesListFolderContinue({
        cursor: response.result.cursor,
      });
      processEntries(response.result.entries);
    }

    function processEntries(entries) {
      for (const entry of entries) {
        if (entry['.tag'] === 'file') {
          const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
          if (imageExts.includes(ext)) {
            images.push({
              file_path: entry.path_lower,
              file_name: entry.name,
            });
          }
        } else if (entry['.tag'] === 'folder' && includeSubfolders) {
          subfolders.push(entry.path_lower);
        }
      }
    }

    if (includeSubfolders) {
      for (const folderPath of subfolders) {
        await listDir(folderPath);
      }
    }
  }

  await listDir(folderPath);
  return images;
}

async function downloadFile(credentialId, filePath) {
  return withRetry(credentialId, async () => {
    const { dbx } = getDropboxClient(credentialId);
    const response = await dbx.filesDownload({ path: filePath });
    return response.result.fileBinary;
  });
}

async function getThumbnail(credentialId, filePath) {
  try {
    return await withRetry(credentialId, async () => {
      const { dbx } = getDropboxClient(credentialId);
      const response = await dbx.filesGetThumbnailV2({
        resource: { '.tag': 'path', path: filePath },
        size: { '.tag': 'w256h256' },
        format: { '.tag': 'jpeg' },
      });
      return response.result.fileBinary;
    });
  } catch (err) {
    console.error(`Dropbox thumbnail failed for ${filePath}:`, err.message);
    return null;
  }
}

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  listFolders,
  listImages,
  downloadFile,
  getThumbnail,
};
