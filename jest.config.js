const ESM_PACKAGES = ['msw', 'until-async', '@bundled-es-modules', '@open-draft'];
const transformIgnorePatterns = [
  `/node_modules/(?!(${ESM_PACKAGES.join('|')})/)`
];

module.exports = {
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/app/$1'
  },
  // Per-directory environment overrides
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/app/utils/__tests__/**/*.test.js',
        '<rootDir>/app/services/__tests__/**/*.test.js'
      ],
      transform: { '^.+\\.jsx?$': 'babel-jest' },
      transformIgnorePatterns,
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/app/$1' }
    },
    {
      displayName: 'jsdom',
      testEnvironment: 'jest-environment-jsdom',
      testMatch: ['<rootDir>/app/components/__tests__/**/*.test.js'],
      transform: { '^.+\\.jsx?$': 'babel-jest' },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/app/$1' },
      setupFilesAfterEnv: ['@testing-library/jest-dom']
    }
  ]
};
