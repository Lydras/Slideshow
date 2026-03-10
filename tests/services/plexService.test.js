const { createHarness } = require('../helpers/appHarness');

describe('plex service', () => {
  let harness;
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (harness) {
      harness.closeDb();
      harness = null;
    }
  });

  test('library counts fall back to totalSize when leafCount is unavailable', async () => {
    harness = createHarness();
    const credentialId = harness.credentialService.storeCredential('plex', 'Plex: Living Room', {
      token: 'plex-token',
      server_url: 'http://plex.local:32400',
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        MediaContainer: {
          Directory: [
            { key: '1', title: 'Family', type: 'photo', totalSize: 148 },
          ],
        },
      }),
    });

    const plexService = require('../../src/services/plexService');
    const libraries = await plexService.getLibraries(credentialId, 'http://plex.local:32400');

    expect(libraries).toEqual([
      {
        key: '1',
        title: 'Family',
        type: 'photo',
        count: 148,
        count_label: '148 items',
      },
    ]);
  });

  test('photo scans keep separate full image and thumbnail paths', async () => {
    harness = createHarness();
    const credentialId = harness.credentialService.storeCredential('plex', 'Plex: Living Room', {
      token: 'plex-token',
      server_url: 'http://plex.local:32400',
    });

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
                Media: [
                  {
                    Part: [
                      { key: '/library/parts/218493/1758290441/file.png' },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      });

    const plexService = require('../../src/services/plexService');
    const photos = await plexService.listPhotos(credentialId, 'http://plex.local:32400', '12');

    expect(photos).toEqual([
      {
        file_path: '/library/parts/218493/1758290441/file.png',
        file_name: 'Holiday Shot',
        thumbnail_path: '/library/metadata/999/thumb/123',
      },
    ]);
  });

  test('metadata keys are resolved to media parts before Plex download', async () => {
    harness = createHarness();
    const credentialId = harness.credentialService.storeCredential('plex', 'Plex: Living Room', {
      token: 'plex-token',
      server_url: 'http://plex.local:32400',
    });

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          MediaContainer: {
            Metadata: [
              {
                Media: [
                  {
                    Part: [
                      { key: '/library/parts/555/original.jpg' },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () => Buffer.from('image-bytes'),
      });

    const plexService = require('../../src/services/plexService');
    const result = await plexService.downloadPhoto(credentialId, 'http://plex.local:32400', '/library/metadata/999');

    expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://plex.local:32400/library/metadata/999', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Plex-Token': 'plex-token' }),
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://plex.local:32400/library/parts/555/original.jpg?download=1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Plex-Token': 'plex-token', 'X-Plex-Client-Identifier': 'slideshow-app' }),
      })
    );
    expect(result.contentType).toBe('image/jpeg');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  test('part paths download directly without Plex transcode', async () => {
    harness = createHarness();
    const credentialId = harness.credentialService.storeCredential('plex', 'Plex: Living Room', {
      token: 'plex-token',
      server_url: 'http://plex.local:32400',
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => Buffer.from('png-bytes'),
    });

    const plexService = require('../../src/services/plexService');
    const result = await plexService.downloadPhoto(credentialId, 'http://plex.local:32400', '/library/parts/218667/1758290447/file.png');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://plex.local:32400/library/parts/218667/1758290447/file.png?download=1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Plex-Token': 'plex-token', 'X-Plex-Client-Identifier': 'slideshow-app' }),
      })
    );
    expect(result.contentType).toBe('image/png');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  test('slideshow playback prefers the full Plex image before thumbnail fallback', async () => {
    harness = createHarness();
    const credentialId = harness.credentialService.storeCredential('plex', 'Plex: Living Room', {
      token: 'plex-token',
      server_url: 'http://plex.local:32400',
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => Buffer.from('png-bytes'),
    });

    const plexService = require('../../src/services/plexService');
    const result = await plexService.downloadBestPhoto(credentialId, 'http://plex.local:32400', {
      file_path: '/library/parts/218667/1758290447/file.png',
      thumbnail_path: '/library/metadata/999/thumb/123',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://plex.local:32400/library/parts/218667/1758290447/file.png?download=1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Plex-Token': 'plex-token', 'X-Plex-Client-Identifier': 'slideshow-app' }),
      })
    );
    expect(result.contentType).toBe('image/png');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });


  test('slideshow playback falls back to thumbnail path when the full image fails', async () => {
    harness = createHarness();
    const credentialId = harness.credentialService.storeCredential('plex', 'Plex: Living Room', {
      token: 'plex-token',
      server_url: 'http://plex.local:32400',
    });

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () => Buffer.from('jpeg-bytes'),
      });

    const plexService = require('../../src/services/plexService');
    const result = await plexService.downloadBestPhoto(credentialId, 'http://plex.local:32400', {
      file_path: '/library/parts/218667/1758290447/file.png',
      thumbnail_path: '/library/metadata/999/thumb/123',
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://plex.local:32400/library/parts/218667/1758290447/file.png?download=1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Plex-Token': 'plex-token', 'X-Plex-Client-Identifier': 'slideshow-app' }),
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://plex.local:32400/library/metadata/999/thumb/123',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Plex-Token': 'plex-token', 'X-Plex-Client-Identifier': 'slideshow-app' }),
      })
    );
    expect(result.contentType).toBe('image/jpeg');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  test('metadata fallback resolves to a real thumb path after full image failure', async () => {
    harness = createHarness();
    const credentialId = harness.credentialService.storeCredential('plex', 'Plex: Living Room', {
      token: 'plex-token',
      server_url: 'http://plex.local:32400',
    });

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          MediaContainer: {
            Metadata: [
              {
                key: '/library/metadata/215954',
                thumb: '/library/metadata/215954/thumb/998877',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () => Buffer.from('jpeg-bytes'),
      });

    const plexService = require('../../src/services/plexService');
    const result = await plexService.downloadBestPhoto(credentialId, 'http://plex.local:32400', {
      file_path: '/library/parts/218667/1758290447/file.png',
      thumbnail_path: '/library/metadata/215954',
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://plex.local:32400/library/parts/218667/1758290447/file.png?download=1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Plex-Token': 'plex-token', 'X-Plex-Client-Identifier': 'slideshow-app' }),
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://plex.local:32400/library/metadata/215954', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Plex-Token': 'plex-token', 'X-Plex-Client-Identifier': 'slideshow-app' }),
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'http://plex.local:32400/library/metadata/215954/thumb/998877',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Plex-Token': 'plex-token', 'X-Plex-Client-Identifier': 'slideshow-app' }),
      })
    );
    expect(result.contentType).toBe('image/jpeg');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  test('missing Plex thumbs are derived from ratingKey and updatedAt during scan', async () => {
    harness = createHarness();
    const credentialId = harness.credentialService.storeCredential('plex', 'Plex: Living Room', {
      token: 'plex-token',
      server_url: 'http://plex.local:32400',
    });

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
                title: 'Derived Thumb Photo',
                ratingKey: '215639',
                key: '/library/metadata/215639',
                updatedAt: 1759309559,
                Media: [
                  {
                    Part: [
                      { key: '/library/parts/220516/1759141211/file.png' },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      });

    const plexService = require('../../src/services/plexService');
    const photos = await plexService.listPhotos(credentialId, 'http://plex.local:32400', '12');

    expect(photos).toEqual([
      {
        file_path: '/library/parts/220516/1759141211/file.png',
        file_name: 'Derived Thumb Photo',
        thumbnail_path: '/library/metadata/215639/thumb/1759309559',
      },
    ]);
  });
});
