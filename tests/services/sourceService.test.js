const fs = require('fs');
const path = require('path');
const { createHarness } = require('../helpers/appHarness');

describe('source scanning', () => {
  let harness;

  afterEach(() => {
    if (harness) {
      harness.closeDb();
      harness = null;
    }
  });

  test('rescanning preserves playlist-specific image selections by file path', async () => {
    harness = createHarness();

    const photoDir = path.join(harness.dataDir, 'photos');
    fs.mkdirSync(photoDir, { recursive: true });
    fs.writeFileSync(path.join(photoDir, 'a.jpg'), 'a');
    fs.writeFileSync(path.join(photoDir, 'b.jpg'), 'b');

    const source = harness.sourceService.createSource({
      name: 'Local Photos',
      type: 'local',
      path: photoDir,
      include_subfolders: 1,
    });

    await harness.sourceService.scanSource(source.id);
    const initialImages = harness.sourceService.getSourceImages(source.id);
    expect(initialImages).toHaveLength(2);

    const playlist = harness.playlistService.createPlaylist({ name: 'Featured' });
    harness.playlistService.addSource(playlist.id, source.id, 0);
    harness.playlistService.setPlaylistImages(playlist.id, [initialImages[0].id]);

    await harness.sourceService.scanSource(source.id);

    const rescannedImages = harness.sourceService.getSourceImages(source.id);
    const playlistImages = harness.playlistService.getPlaylistImages(playlist.id);

    expect(rescannedImages).toHaveLength(2);
    expect(playlistImages).toHaveLength(1);
    expect(playlistImages[0].file_name).toBe(initialImages[0].file_name);
    expect(playlistImages[0].image_id).not.toBe(initialImages[0].id);
  });

  test('plex scans persist thumbnail paths for later thumbnail generation', async () => {
    harness = createHarness();

    const credentialId = harness.credentialService.storeCredential('plex', 'Plex: Living Room', {
      token: 'plex-token',
      server_url: 'http://plex.local:32400',
    });

    const source = harness.sourceService.createSource({
      name: 'Plex Photos',
      type: 'plex',
      path: '12',
      credential_id: credentialId,
      plex_server_url: 'http://plex.local:32400',
    });

    const originalFetch = global.fetch;
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ MediaContainer: { Metadata: [] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          MediaContainer: {
            Metadata: [
              { ratingKey: 'album-1', type: 'photoAlbum' },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          MediaContainer: {
            Metadata: [
              {
                type: 'photo',
                title: 'Holiday Shot',
                key: '/library/metadata/999',
                thumb: '/library/metadata/999/thumb/123',
                Media: [{ Part: [{ key: '/library/parts/218493/1758290441/file.png' }] }],
              },
            ],
          },
        }),
      });

    try {
      await harness.sourceService.scanSource(source.id);
    } finally {
      global.fetch = originalFetch;
    }

    const images = harness.sourceService.getSourceImages(source.id);
    expect(images).toHaveLength(1);
    expect(images[0].file_path).toBe('/library/parts/218493/1758290441/file.png');
    expect(images[0].thumbnail_path).toBe('/library/metadata/999/thumb/123');
  });
  test('rescanning preserves review state and favorite flags by file path', async () => {
    harness = createHarness();

    const photoDir = path.join(harness.dataDir, 'photos');
    fs.mkdirSync(photoDir, { recursive: true });
    fs.writeFileSync(path.join(photoDir, 'a.jpg'), 'a');

    const source = harness.sourceService.createSource({
      name: 'Local Photos',
      type: 'local',
      path: photoDir,
      include_subfolders: 1,
    });

    await harness.sourceService.scanSource(source.id);
    const [image] = harness.sourceService.getSourceImages(source.id);
    const { getDb } = require('../../src/db/connection');
    const db = getDb();

    db.prepare("UPDATE image_cache SET review_status = 'approved', favorite = 1, reviewed_at = datetime('now') WHERE id = ?").run(image.id);

    await harness.sourceService.scanSource(source.id);
    const [rescanned] = harness.sourceService.getSourceImages(source.id);

    expect(rescanned.review_status).toBe('approved');
    expect(rescanned.favorite).toBe(1);
    expect(rescanned.reviewed_at).toBeTruthy();
  });
});


