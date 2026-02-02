const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { getAllSettings, updateSettings } = require('../services/settingsService');
const { TRANSITION_TYPES, ORDER_TYPES } = require('../config/constants');

const router = Router();

router.get('/', (req, res) => {
  res.json(getAllSettings());
});

router.put(
  '/',
  [
    body('interval_seconds')
      .optional()
      .isInt({ min: 1, max: 300 })
      .withMessage('Interval must be between 1 and 300 seconds'),
    body('order')
      .optional()
      .isIn(ORDER_TYPES)
      .withMessage(`Order must be one of: ${ORDER_TYPES.join(', ')}`),
    body('transition')
      .optional()
      .isIn(TRANSITION_TYPES)
      .withMessage(`Transition must be one of: ${TRANSITION_TYPES.join(', ')}`),
    body('transition_duration_ms')
      .optional()
      .isInt({ min: 0, max: 5000 })
      .withMessage('Transition duration must be between 0 and 5000ms'),
    body('fullscreen_on_start')
      .optional()
      .isIn(['true', 'false'])
      .withMessage('fullscreen_on_start must be true or false'),
    body('include_subfolders')
      .optional()
      .isIn(['true', 'false'])
      .withMessage('include_subfolders must be true or false'),
    body('active_playlist_id')
      .optional()
      .isString(),
    validate,
  ],
  (req, res) => {
    const settings = updateSettings(req.body);
    res.json(settings);
  }
);

module.exports = router;
