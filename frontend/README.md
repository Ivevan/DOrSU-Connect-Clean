# Frontend Structure

This document describes the organized structure of the frontend application.

## Directory Structure

```
frontend/
├── src/                          # Main source directory
│   ├── components/               # Reusable UI components
│   │   ├── common/              # Common UI components
│   │   │   ├── LetterGlitch.tsx
│   │   │   ├── ThemeSwitchOverlay.tsx
│   │   │   └── ThemeTestComponent.tsx
│   │   └── navigation/          # Navigation components
│   │       ├── AdminBottomNavBar.tsx
│   │       └── UserBottomNavBar.tsx
│   ├── screens/                 # Application screens
│   │   ├── auth/               # Authentication screens
│   │   │   ├── SplashScreen.tsx
│   │   │   ├── GetStarted.tsx
│   │   │   ├── SignIn.tsx
│   │   │   └── CreateAccount.tsx
│   │   ├── admin/              # Admin-specific screens
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminAIChat.tsx
│   │   │   ├── AdminSettings.tsx
│   │   │   ├── AdminCalendar.tsx
│   │   │   ├── ManagePosts.tsx
│   │   │   └── PostUpdate.tsx
│   │   └── user/               # User-specific screens
│   │       ├── SchoolUpdates.tsx
│   │       ├── AIChat.tsx
│   │       ├── UserSettings.tsx
│   │       └── Calendar.tsx
│   ├── navigation/             # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── modals/                 # Modal components
│   │   ├── ConfirmationModal.tsx
│   │   ├── InfoModal.tsx
│   │   ├── LogoutModal.tsx
│   │   ├── MonthPickerModal.tsx
│   │   ├── OptionsModal.tsx
│   │   └── PreviewModal.tsx
│   ├── contexts/               # React contexts
│   │   └── ThemeContext.tsx
│   ├── services/               # API and data services
│   │   └── AdminDataService.js
│   ├── utils/                  # Utility functions
│   │   └── dateUtils.ts
│   ├── types/                  # TypeScript type definitions
│   │   └── index.ts
│   ├── config/                 # Configuration files
│   │   └── theme.ts
│   └── index.ts               # Main entry point
└── README.md                  # This file
```

## Key Improvements

### 1. **Organized by Feature**
- **Authentication screens** are now grouped in `src/screens/auth/`
- **Admin screens** remain in `src/screens/admin/`
- **User screens** remain in `src/screens/user/`

### 2. **Component Categorization**
- **Navigation components** are separated from common UI components
- **Common components** are reusable across the application
- Clear separation of concerns

### 3. **Configuration Management**
- **Theme configuration** moved to `src/config/theme.ts`
- Centralized configuration management

### 4. **Type Safety**
- **TypeScript types** organized in `src/types/index.ts`
- Centralized type definitions for better maintainability

### 5. **Centralized Exports**
- **Main entry point** at `src/index.ts` exports all components and utilities
- Easier imports across the application

## Import Paths

### Before (Old Structure)
```typescript
import { theme } from '../theme';
import AdminBottomNavBar from '../components/AdminBottomNavBar';
import SplashScreen from '../screens/SplashScreen';
```

### After (New Structure)
```typescript
import { theme } from '../config/theme';
import AdminBottomNavBar from '../components/navigation/AdminBottomNavBar';
import SplashScreen from '../screens/auth/SplashScreen';
```

## Benefits

1. **Better Organization**: Files are logically grouped by functionality
2. **Easier Navigation**: Developers can quickly find related files
3. **Scalability**: Structure supports growth as the application expands
4. **Maintainability**: Clear separation of concerns makes maintenance easier
5. **Type Safety**: Centralized types improve development experience

## Usage

To use the organized structure, import from the new paths:

```typescript
// Import from main entry point
import { AdminBottomNavBar, useTheme, lightTheme } from '../src';

// Or import specific modules
import { AdminBottomNavBar } from '../src/components/navigation/AdminBottomNavBar';
import { useTheme } from '../src/contexts/ThemeContext';
import { lightTheme } from '../src/config/theme';
```
