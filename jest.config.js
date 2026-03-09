module.exports = {
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    'public/js/**/*.js',
    '!public/js/views/dropboxAuthView.js',
    '!public/js/views/plexSetupView.js',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/data/',
    '<rootDir>/.agent/',
    '<rootDir>/.agents/',
    '<rootDir>/.auto-claude/',
    '<rootDir>/.claude/',
    '<rootDir>/.cursor/',
    '<rootDir>/.trellis/',
  ],
};
