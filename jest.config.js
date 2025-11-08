module.exports = {
  preset: 'react-native',
  roots: ['<rootDir>/frontend/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'frontend/src/**/*.{ts,tsx,js,jsx}',
    '!frontend/src/**/*.d.ts',
    '!frontend/src/**/__tests__/**',
    '!frontend/src/**/__mocks__/**',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js|jsx)',
    '**/*.(test|spec).(ts|tsx|js|jsx)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|dayjs)',
  ],
  testEnvironment: 'node',
  // Use different test environments based on test file location
  projects: [
    {
      displayName: 'utils',
      testMatch: ['<rootDir>/frontend/src/**/__tests__/**/*.test.{ts,js}'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/frontend/src'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react',
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
          },
        }],
        '^.+\\.(js|jsx)$': 'babel-jest',
      },
    },
    {
      displayName: 'components',
      testMatch: ['<rootDir>/frontend/src/**/__tests__/**/*.component.test.{ts,tsx,js,jsx}'],
      preset: 'react-native',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|dayjs)',
      ],
    },
    {
      displayName: 'screens',
      testMatch: ['<rootDir>/frontend/src/**/__tests__/**/*.screen.test.{ts,tsx,js,jsx}'],
      preset: 'react-native',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|dayjs)',
      ],
    },
  ],
};

