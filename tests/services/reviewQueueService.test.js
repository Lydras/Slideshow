const path = require('path');
const { createHarness } = require('../helpers/appHarness');

describe('review queue service', () => {
  let harness;

  afterEach(() => {
    if (harness) {
      harness.closeDb();
      harness = null;
    }
  });

  function seedSourceWithImages() {
    const { getDb } = require('../../src/db/connection');
    const db = getDb();

    const source = harness.sourceService.createSource({
      name: 'Living Room Photos',
      type: 'local',
      path: path.join(harness.dataDir, 'photos'),
      include_subfolders: 1,
    });

    const insert = db.prepare("INSERT INTO image_cache (source_id, file_path, file_name, selected, thumbnail_path, is_available, review_status, favorite, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

    const pending = insert.run(source.id, '/photos/pending.jpg', 'pending.jpg', 1, null, 1, 'pending', 0, null).lastInsertRowid;
    const approved = insert.run(source.id, '/photos/approved.jpg', 'approved.jpg', 1, null, 1, 'approved', 0, '2026-03-11 10:00:00').lastInsertRowid;
    const hidden = insert.run(source.id, '/photos/hidden.jpg', 'hidden.jpg', 0, null, 1, 'hidden', 0, '2026-03-11 09:00:00').lastInsertRowid;

    return { source, pending, approved, hidden };
  }

  test('lists only pending images for unreviewed mode', () => {
    harness = createHarness();
    seedSourceWithImages();
    const { getReviewQueue } = require('../../src/services/reviewQueueService');

    const queue = getReviewQueue({ mode: 'unreviewed' });

    expect(queue).toHaveLength(1);
    expect(queue[0].review_status).toBe('pending');
    expect(queue[0].file_name).toBe('pending.jpg');
  });

  test('orders newly scanned items newest-first and unreviewed items oldest-first', () => {
    harness = createHarness();
    const { getDb } = require('../../src/db/connection');
    const { getReviewQueue } = require('../../src/services/reviewQueueService');
    const db = getDb();

    const source = harness.sourceService.createSource({
      name: 'Hallway Photos',
      type: 'local',
      path: path.join(harness.dataDir, 'photos'),
      include_subfolders: 1,
    });

    const insert = db.prepare(
      "INSERT INTO image_cache (source_id, file_path, file_name, selected, thumbnail_path, is_available, review_status, favorite, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    insert.run(source.id, '/photos/older-pending.jpg', 'older-pending.jpg', 1, null, 1, 'pending', 0, null);
    insert.run(source.id, '/photos/newer-pending.jpg', 'newer-pending.jpg', 1, null, 1, 'pending', 0, null);

    const newlyScanned = getReviewQueue({ mode: 'newly-scanned' });
    const unreviewed = getReviewQueue({ mode: 'unreviewed' });

    expect(newlyScanned.slice(0, 2).map(item => item.file_name)).toEqual([
      'newer-pending.jpg',
      'older-pending.jpg',
    ]);
    expect(unreviewed.slice(0, 2).map(item => item.file_name)).toEqual([
      'older-pending.jpg',
      'newer-pending.jpg',
    ]);
  });

  test('favorite action approves image and sets favorite flag', () => {
    harness = createHarness();
    const { pending } = seedSourceWithImages();
    const { applyReviewAction } = require('../../src/services/reviewQueueService');

    const updated = applyReviewAction(pending, 'favorite');

    expect(updated.review_status).toBe('approved');
    expect(updated.favorite).toBe(1);
    expect(updated.selected).toBe(1);
    expect(updated.reviewed_at).toBeTruthy();
  });

  test('slideshow duplicates favorite images after eligibility filtering', () => {
    harness = createHarness();
    const { getDb } = require('../../src/db/connection');
    const { getSlideshowImages } = require('../../src/services/imageService');
    const db = getDb();

    const source = harness.sourceService.createSource({
      name: 'Display Photos',
      type: 'local',
      path: path.join(harness.dataDir, 'photos'),
      include_subfolders: 1,
    });

    const insert = db.prepare("INSERT INTO image_cache (source_id, file_path, file_name, selected, thumbnail_path, is_available, review_status, favorite, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

    insert.run(source.id, '/photos/normal.jpg', 'normal.jpg', 1, null, 1, 'approved', 0, '2026-03-11 10:00:00');
    insert.run(source.id, '/photos/favorite.jpg', 'favorite.jpg', 1, null, 1, 'approved', 1, '2026-03-11 10:00:00');

    const images = getSlideshowImages(null);
    const fileNames = images.map(image => image.file_name);

    expect(fileNames.filter(name => name === 'normal.jpg')).toHaveLength(1);
    expect(fileNames.filter(name => name === 'favorite.jpg')).toHaveLength(2);
  });
});
