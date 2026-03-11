const path = require('path');
const request = require('supertest');
const { createHarness } = require('../helpers/appHarness');

describe('API behavior', () => {
  let harness;

  afterEach(() => {
    if (harness) {
      harness.closeDb();
      harness = null;
    }
  });

  test('settings and slideshow images remain public when auth is enabled', async () => {
    harness = createHarness();
    const agent = request(harness.app);

    const passwordRes = await agent.post('/api/auth/password').send({ password: 'secret123' });
    expect(passwordRes.status).toBe(200);

    const settingsRes = await agent.get('/api/settings');
    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.interval_seconds).toBe('8');

    const imagesRes = await agent.get('/api/images');
    expect(imagesRes.status).toBe(200);
    expect(imagesRes.body).toEqual([]);

    const lockedRes = await agent.get('/api/sources');
    expect(lockedRes.status).toBe(401);
  });

  test('review queue is auth-protected', async () => {
    harness = createHarness();
    const agent = request(harness.app);

    await agent.post('/api/auth/password').send({ password: 'secret123' });

    const response = await agent.get('/api/review-queue');

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Authentication required');
  });

  test('review queue returns pending items for selected mode after auth', async () => {
    harness = createHarness();
    const agent = request(harness.app);
    const { getDb } = require('../../src/db/connection');
    const db = getDb();

    const source = harness.sourceService.createSource({
      name: 'Local Photos',
      type: 'local',
      path: path.join(harness.dataDir, 'photos'),
      include_subfolders: 1,
    });

    db.prepare("INSERT INTO image_cache (source_id, file_path, file_name, selected, thumbnail_path, is_available, review_status, favorite, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(source.id, path.join(harness.dataDir, 'photos', 'pending.jpg'), 'pending.jpg', 1, null, 1, 'pending', 0, null);

    const passwordRes = await agent.post('/api/auth/password').send({ password: 'secret123' });
    const token = passwordRes.body.token;

    const response = await agent
      .get('/api/review-queue?mode=unreviewed')
      .set('Authorization', 'Bearer ' + token);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].file_name).toBe('pending.jpg');
  });
  test('deleting the active playlist clears the setting', async () => {
    harness = createHarness();
    const agent = request(harness.app);

    const playlistRes = await agent.post('/api/playlists').send({ name: 'Favorites' });
    expect(playlistRes.status).toBe(201);

    const updateRes = await agent.put('/api/settings').send({ active_playlist_id: String(playlistRes.body.id) });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.active_playlist_id).toBe(String(playlistRes.body.id));

    const deleteRes = await agent.delete(`/api/playlists/${playlistRes.body.id}`);
    expect(deleteRes.status).toBe(200);

    const settingsRes = await agent.get('/api/settings');
    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.active_playlist_id).toBe('');
  });

  test('credential deletion is blocked while a source still references it', async () => {
    harness = createHarness();
    const credentialId = harness.credentialService.storeCredential('dropbox', 'Dropbox Account', {
      access_token: 'token',
      refresh_token: 'refresh',
      app_key: 'key',
      app_secret: 'secret',
    });

    harness.sourceService.createSource({
      name: 'Dropbox Photos',
      type: 'dropbox',
      path: '/photos',
      credential_id: credentialId,
    });

    const agent = request(harness.app);
    const response = await agent.delete(`/api/credentials/${credentialId}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/in use/i);
  });

  test('invalid active playlist ids are rejected', async () => {
    harness = createHarness();
    const agent = request(harness.app);

    const response = await agent.put('/api/settings').send({ active_playlist_id: '9999' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Selected playlist does not exist');
  });

  test('unavailable images are excluded from future slideshow payloads', async () => {
    harness = createHarness();
    const agent = request(harness.app);
    const { getDb } = require('../../src/db/connection');
    const db = getDb();

    const source = harness.sourceService.createSource({
      name: 'Local Photos',
      type: 'local',
      path: path.join(harness.dataDir, 'photos'),
      include_subfolders: 1,
    });

    db.prepare(
      'INSERT INTO image_cache (source_id, file_path, file_name, selected, thumbnail_path, is_available) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(source.id, path.join(harness.dataDir, 'photos', 'a.jpg'), 'a.jpg', 1, null, 1);
    db.prepare(
      'INSERT INTO image_cache (source_id, file_path, file_name, selected, thumbnail_path, is_available) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(source.id, path.join(harness.dataDir, 'photos', 'b.jpg'), 'b.jpg', 1, null, 0);

    const response = await agent.get('/api/images');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].file_name).toBe('a.jpg');
  });
});


