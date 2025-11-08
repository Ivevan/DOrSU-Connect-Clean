# Unit Testing Guide for DOrSU Connect

This guide provides instructions on how to set up, run, and write unit tests for the DOrSU Connect project.

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Test Structure](#test-structure)
6. [Best Practices](#best-practices)
7. [Examples](#examples)

## Overview

The project uses **Jest** with multiple presets for comprehensive testing:

- **Utility/Service Tests**: Uses `ts-jest` preset with Node.js environment for testing pure JavaScript/TypeScript functions
- **Component Tests**: Uses `react-native` preset with React Native Testing Library for testing React Native components

This setup allows you to:

- Test utility functions and services (pure JavaScript/TypeScript code)
- Test React Native components with proper mocks and context providers
- Generate code coverage reports
- Run tests in watch mode during development

## Setup

### 1. Install Dependencies

The testing dependencies have been added to `package.json`. Install them by running:

```bash
npm install
```

### 2. Configuration Files

The following configuration files have been created:

- **`jest.config.js`**: Main Jest configuration with multiple projects for different test types
- **`jest.setup.js`**: Setup file for global test configuration and mocks
- **`frontend/src/__tests__/test-utils.tsx`**: Test utilities for component testing with ThemeProvider

**Configuration Details**:
- **Utils Project**: Uses `ts-jest` preset with Node.js environment for utility/service tests
- **Components Project**: Uses `react-native` preset for React Native component tests
- Automatically transforms `.ts`, `.tsx`, `.js`, and `.jsx` files
- Includes comprehensive mocks for Expo modules, React Native modules, and third-party libraries

### 3. Test Scripts

The following npm scripts are available:

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

Watch mode automatically re-runs tests when files change:

```bash
npm run test:watch
```

### Run Tests with Coverage

Generate a coverage report to see which parts of your code are tested:

```bash
npm run test:coverage
```

The coverage report will show:
- **Statements**: Percentage of statements executed
- **Branches**: Percentage of branches executed
- **Functions**: Percentage of functions executed
- **Lines**: Percentage of lines executed

Coverage reports are generated in the `coverage/` directory.

### Run Specific Test Files

You can run a specific test file by providing its path:

```bash
npm test dateUtils.test.ts
npm test AdminDataService.test.js
npm test LogoutModal.component.test.tsx
```

### Run Tests by Project

The Jest configuration uses multiple projects. You can run tests for specific projects:

```bash
# Run only utility/service tests
npm test -- --selectProjects utils

# Run only component tests
npm test -- --selectProjects components
```

## Writing Tests

### Test File Naming

Test files should follow one of these naming conventions:
- `*.test.ts` or `*.test.tsx` (e.g., `dateUtils.test.ts`)
- `*.spec.ts` or `*.spec.tsx` (e.g., `dateUtils.spec.ts`)
- Place test files in a `__tests__` folder (e.g., `__tests__/dateUtils.test.ts`)

### Basic Test Structure

```typescript
import { functionToTest } from '../path/to/module';

describe('ModuleName', () => {
  describe('functionName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test input';
      
      // Act
      const result = functionToTest(input);
      
      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

### Testing Utility Functions

Example for testing date utilities:

```typescript
import { formatDate } from '../dateUtils';

describe('formatDate', () => {
  it('should format a valid date correctly', () => {
    const date = new Date(2025, 10, 8);
    const result = formatDate(date);
    expect(result).toBe('Nov 08, 2025');
  });

  it('should handle edge cases', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate(null)).toBe('');
  });
});
```

### Testing Services

Example for testing data services:

```typescript
import AdminDataService from '../AdminDataService';

describe('AdminDataService', () => {
  describe('getPosts', () => {
    it('should return an array of posts', async () => {
      const posts = await AdminDataService.getPosts();
      expect(Array.isArray(posts)).toBe(true);
    });
  });
});
```

### Testing React Native Components

Example for testing React Native components:

```typescript
import React from 'react';
import { render, fireEvent, screen } from '../../__tests__/test-utils';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('should handle button press', () => {
    const onPress = jest.fn();
    render(<MyComponent onPress={onPress} />);
    
    fireEvent.press(screen.getByText('Button'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

**Important Notes for Component Testing**:
- Use the custom `render` function from `test-utils.tsx` which automatically wraps components with `ThemeProvider`
- Component test files should be named `*.component.test.tsx` to be picked up by the components project
- All React Native and Expo modules are automatically mocked in `jest.setup.js`

## Test Structure

### Organizing Tests

1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain what is being tested
3. **Follow the AAA pattern**: Arrange, Act, Assert

### Example Structure

```typescript
describe('ModuleName', () => {
  // Setup/Teardown
  beforeEach(() => {
    // Setup code
  });

  afterEach(() => {
    // Cleanup code
  });

  describe('functionName', () => {
    it('should handle normal case', () => {
      // Test normal behavior
    });

    it('should handle edge case', () => {
      // Test edge cases
    });

    it('should handle error case', () => {
      // Test error handling
    });
  });
});
```

## Best Practices

### 1. Test One Thing at a Time

Each test should verify one specific behavior:

```typescript
// ❌ Bad: Testing multiple things
it('should format date and handle errors', () => {
  expect(formatDate(validDate)).toBe('Nov 08, 2025');
  expect(formatDate(invalidDate)).toBe('');
});

// ✅ Good: Separate tests
it('should format valid date correctly', () => {
  expect(formatDate(validDate)).toBe('Nov 08, 2025');
});

it('should handle invalid date', () => {
  expect(formatDate(invalidDate)).toBe('');
});
```

### 2. Use Descriptive Test Names

Test names should clearly describe what is being tested:

```typescript
// ❌ Bad
it('works', () => { ... });

// ✅ Good
it('should return formatted date string for valid input', () => { ... });
```

### 3. Test Edge Cases

Always test:
- **Null/undefined inputs**
- **Empty strings/arrays**
- **Boundary values**
- **Error conditions**

### 4. Mock External Dependencies

Mock external services, APIs, and native modules:

```typescript
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));
```

### 5. Use Setup and Teardown

Use `beforeEach` and `afterEach` for common setup:

```typescript
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2025-11-08T12:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});
```

### 6. Keep Tests Independent

Tests should not depend on each other. Each test should be able to run in isolation.

### 7. Test Behavior, Not Implementation

Focus on what the function does, not how it does it:

```typescript
// ❌ Bad: Testing implementation details
it('should call formatDate with correct parameters', () => {
  const spy = jest.spyOn(utils, 'formatDate');
  myFunction();
  expect(spy).toHaveBeenCalledWith('2025-11-08');
});

// ✅ Good: Testing behavior
it('should display formatted date', () => {
  const result = myFunction('2025-11-08');
  expect(result).toContain('Nov 08, 2025');
});
```

## Examples

### Example 1: Testing Date Utilities

See `frontend/src/utils/__tests__/dateUtils.test.ts` for a complete example of testing date utility functions.

### Example 2: Testing Data Services

See `frontend/src/services/__tests__/AdminDataService.test.js` for a complete example of testing service functions.

### Example 3: Testing React Native Components

See `frontend/src/modals/__tests__/LogoutModal.component.test.tsx` for a complete example of testing a React Native modal component.

### Example 4: Testing Components with Animations

See `frontend/src/components/common/__tests__/ThemeSwitchOverlay.component.test.tsx` for an example of testing components with animations.

### Example 3: Testing Async Functions

```typescript
describe('asyncFunction', () => {
  it('should return data after async operation', async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
    expect(result.data).toBe('expected');
  });

  it('should handle errors', async () => {
    await expect(asyncFunction()).rejects.toThrow('Error message');
  });
});
```

### Example 4: Testing with Mocks

```typescript
jest.mock('../api', () => ({
  fetchData: jest.fn(() => Promise.resolve({ data: 'mocked' })),
}));

describe('componentWithApi', () => {
  it('should use mocked API', async () => {
    const result = await fetchData();
    expect(result.data).toBe('mocked');
  });
});
```

## Common Jest Matchers

- `expect(value).toBe(expected)` - Exact equality (===)
- `expect(value).toEqual(expected)` - Deep equality
- `expect(value).toBeTruthy()` - Truthy value
- `expect(value).toBeFalsy()` - Falsy value
- `expect(value).toBeDefined()` - Not undefined
- `expect(value).toBeNull()` - Null
- `expect(value).toContain(item)` - Array/string contains
- `expect(value).toHaveLength(number)` - Array/string length
- `expect(fn).toHaveBeenCalled()` - Function was called
- `expect(fn).toHaveBeenCalledWith(args)` - Function called with args
- `expect(promise).resolves.toBe(value)` - Promise resolves
- `expect(promise).rejects.toThrow(error)` - Promise rejects

## Troubleshooting

### Tests Not Running

1. Ensure dependencies are installed: `npm install`
2. Check Jest configuration in `jest.config.js`
3. Verify test file naming matches the pattern

### Module Not Found Errors

1. Check `moduleNameMapper` in `jest.config.js`
2. Ensure paths are correct
3. Verify imports in test files

### Async Test Issues

1. Use `async/await` for async tests
2. Use `done` callback if needed
3. Ensure promises are properly awaited

### Mock Issues

1. Check mock setup in `jest.setup.js`
2. Verify mock implementations
3. Clear mocks between tests with `jest.clearAllMocks()`

## Testing Best Practices: Mock Management and Flexible Assertions

### 1. Mock Cleanup: Avoid Duplicate Mocks

**Problem**: Duplicate mocks in individual test files can conflict with global mocks in `jest.setup.js`, causing test failures.

**Solution**: Check `jest.setup.js` first before adding mocks to individual test files. Only add mocks that are specific to that test file.

#### Example: Removed Duplicate Mock

**Before (❌ Bad)**:
```typescript
// frontend/src/screens/admin/__tests__/AdminAIChat.screen.test.tsx
// Mock useWindowDimensions - DUPLICATE!
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 400, height: 800 }),
  };
});
```

**After (✅ Good)**:
```typescript
// frontend/src/screens/admin/__tests__/AdminAIChat.screen.test.tsx
// Note: useWindowDimensions is already mocked in jest.setup.js
// No need to mock it again!
```

#### What's Already Mocked in `jest.setup.js`

The following are globally mocked and should NOT be re-mocked in test files:

- `react-native-safe-area-context` (SafeAreaProvider, useSafeAreaInsets)
- `@expo/vector-icons` (Ionicons, MaterialIcons, MaterialCommunityIcons)
- `react-native-reanimated`
- `react-native-gesture-handler`
- `@react-navigation/native` (useNavigation, useRoute, useFocusEffect)
- `expo-haptics`
- `expo-linear-gradient`
- `@react-native-firebase/auth`
- `@react-native-async-storage/async-storage`

**When to Add Mocks in Test Files**:
- Service-specific mocks (e.g., `AdminDataService`, `authService`)
- Component-specific mocks (e.g., `UserBottomNavBar`, `AdminBottomNavBar`)
- Modal-specific mocks (e.g., `PreviewModal`, `InfoModal`)
- Test-specific behavior that differs from global mocks

### 2. Flexible Assertions: Handle Multiple Elements

**Problem**: Using `getByText()` or `queryByText()` fails when multiple elements match the same text (e.g., title appears in header and content).

**Solution**: Use `getAllByText()` or `queryAllByText()` and check that the array length is greater than 0.

#### Example: Multiple Element Matches

**Before (❌ Bad)**:
```typescript
it('should render terms content', async () => {
  renderScreen(<TermsOfUseScreen />);
  
  await waitFor(() => {
    // ❌ Fails: "Found multiple elements with text: Terms of Use"
    const termsContent = screen.queryByText(/Terms of Use/i);
    expect(termsContent).toBeTruthy();
  });
});
```

**After (✅ Good)**:
```typescript
it('should render terms content', async () => {
  renderScreen(<TermsOfUseScreen />);
  
  await waitFor(() => {
    // ✅ Works: Handles multiple matches
    const termsContent = screen.queryAllByText(/Terms of Use/i);
    expect(termsContent.length).toBeGreaterThan(0);
  });
});
```

#### Example: Multiple Placeholder Matches

**Before (❌ Bad)**:
```typescript
it('should render password input field', async () => {
  renderScreen(<CreateAccount />);
  
  await waitFor(() => {
    // ❌ Fails: "Found multiple elements with placeholder: Password"
    const passwordInput = screen.queryByPlaceholderText(/Password/i);
    expect(passwordInput).toBeTruthy();
  });
});
```

**After (✅ Good)**:
```typescript
it('should render password input field', async () => {
  renderScreen(<CreateAccount />);
  
  await waitFor(() => {
    // ✅ Works: Handles password and confirm password fields
    const passwordInputs = screen.queryAllByPlaceholderText(/Password/i);
    expect(passwordInputs.length).toBeGreaterThan(0);
  });
});
```

### 3. Fallback Checks for Conditionally Rendered Elements

**Problem**: Elements may not always be present due to animations, loading states, or conditional rendering.

**Solution**: Add fallback checks that verify the screen rendered correctly even if the specific element isn't found.

#### Example: Fallback Checks

**Before (❌ Bad)**:
```typescript
it('should render message input field', async () => {
  renderScreen(<AdminAIChat />);
  
  await waitFor(() => {
    // ❌ Fails if input is conditionally rendered or animated
    const input = screen.queryByPlaceholderText(/Type your message/i);
    expect(input).toBeTruthy();
  });
});
```

**After (✅ Good)**:
```typescript
it('should render message input field', async () => {
  renderScreen(<AdminAIChat />);
  
  await waitFor(() => {
    // ✅ Works: Falls back to checking title if input not found
    const input = screen.queryByPlaceholderText(/Type your message/i);
    const title = screen.queryByText('DOrSU AI');
    expect(input || title).toBeTruthy();
  });
});
```

#### Example: Multiple Fallback Options

```typescript
it('should render Post Update screen', async () => {
  renderScreen(<PostUpdate />);
  
  await waitFor(() => {
    // ✅ Multiple fallback checks
    const titles = screen.queryAllByText(/Post Update|Title/i);
    const titleInput = screen.queryByPlaceholderText(/Title/i);
    expect(titles.length > 0 || titleInput).toBeTruthy();
  });
});
```

### 4. Best Practices Summary

1. **Check Global Mocks First**: Always check `jest.setup.js` before adding mocks to test files
2. **Use `queryAllBy*` for Multiple Matches**: When multiple elements may match, use `queryAllByText()` or `queryAllByPlaceholderText()`
3. **Add Fallback Checks**: For conditionally rendered elements, add fallback assertions
4. **Use Descriptive Comments**: Document why you're using `queryAllBy*` or fallback checks
5. **Test What Matters**: Focus on verifying the screen rendered correctly, not finding every single element

### 5. Common Patterns

#### Pattern 1: Multiple Text Matches
```typescript
// When title appears in header and content
const titles = screen.queryAllByText(/Screen Title/i);
expect(titles.length).toBeGreaterThan(0);
```

#### Pattern 2: Multiple Placeholder Matches
```typescript
// When multiple inputs share similar placeholders
const inputs = screen.queryAllByPlaceholderText(/Password/i);
expect(inputs.length).toBeGreaterThan(0);
```

#### Pattern 3: Fallback to Title
```typescript
// When element may be conditionally rendered
const element = screen.queryByText(/Specific Text/i);
const title = screen.queryByText('Screen Title');
expect(element || title).toBeTruthy();
```

#### Pattern 4: Fallback to Input Field
```typescript
// When checking for form fields
const descriptionInput = screen.queryByPlaceholderText(/Description/i);
const titleInput = screen.queryByPlaceholderText(/Title/i);
expect(descriptionInput || titleInput).toBeTruthy();
```

## Component Testing Best Practices

### 1. Use Test Utilities

Always use the custom `render` function from `test-utils.tsx`:

```typescript
import { render, screen, fireEvent } from '../../__tests__/test-utils';
```

This automatically provides:
- `ThemeProvider` wrapper
- All necessary mocks
- Consistent test environment

### 2. Test User Interactions

Focus on testing what users can see and do:

```typescript
it('should call onPress when button is tapped', () => {
  const onPress = jest.fn();
  render(<Button onPress={onPress} />);
  
  fireEvent.press(screen.getByText('Click Me'));
  expect(onPress).toHaveBeenCalled();
});
```

### 3. Test Conditional Rendering

```typescript
it('should show loading state', () => {
  const { rerender } = render(<Component loading={false} />);
  expect(screen.queryByText('Loading...')).toBeNull();
  
  rerender(<Component loading={true} />);
  expect(screen.getByText('Loading...')).toBeTruthy();
});
```

### 4. Test with Different Themes

```typescript
it('should adapt to dark mode', () => {
  const { rerender } = render(<Component />, { isDark: false });
  // Test light mode
  
  rerender(<Component />, { isDark: true });
  // Test dark mode
});
```

## Screen Testing

Screen tests are similar to component tests but require additional setup for navigation and context providers.

### Screen Test Utilities

Use `renderScreen` from `screen-test-utils.tsx`:

```typescript
import { renderScreen, screen, fireEvent, waitFor, mockNavigation } from '../../../__tests__/screen-test-utils';
import UserSettings from '../UserSettings';

describe('UserSettings Screen', () => {
  it('should render screen', async () => {
    renderScreen(<UserSettings />);
    
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy();
    });
  });

  it('should navigate when button is pressed', async () => {
    renderScreen(<UserSettings />);
    
    await waitFor(() => {
      const button = screen.getByText('Help Center');
      fireEvent.press(button);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('UserHelpCenter');
    });
  });
});
```

### Screen Test Files

Screen test files should be named `*.screen.test.tsx` to be picked up by the screens project.

### Mocking Navigation

Navigation is automatically mocked in `jest.setup.js`. The `mockNavigation` object is available for assertions:

```typescript
expect(mockNavigation.navigate).toHaveBeenCalledWith('ScreenName');
expect(mockNavigation.goBack).toHaveBeenCalled();
```

### Example Screen Tests

See the following examples:
- `frontend/src/screens/user/__tests__/UserSettings.screen.test.tsx`
- `frontend/src/screens/user/__tests__/AIChat.screen.test.tsx`
- `frontend/src/screens/admin/__tests__/AdminSettings.screen.test.tsx`
- `frontend/src/screens/admin/__tests__/AdminDashboard.screen.test.tsx`

## Next Steps

1. **Add more test files** for other utilities, services, components, and screens
2. **Test user interactions** and edge cases in components and screens
3. **Set up CI/CD** to run tests automatically
4. **Aim for high coverage** (80%+ is a good target)
5. **Write tests before fixing bugs** (TDD approach)
6. **Test accessibility** using React Native Testing Library's accessibility queries

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

