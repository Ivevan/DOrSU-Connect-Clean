// Common type definitions for the application

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'moderator' | 'admin';
  username?: string;
  createdAt?: string;
  lastLogin?: string;
  isActive?: boolean;
}

export interface Post {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  isoDate: string;
  images: string[];
  image?: string;
  isPinned: boolean;
  isUrgent: boolean;
  source: string;
}

export interface Theme {
  colors: {
    primary: string;
    accent: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    success: string;
    warning: string;
    danger: string;
    chipBg: string;
    background: string;
    card: string;
    textSecondary: string;
    icon: string;
    iconActive: string;
    tabBar: string;
    tabBarBorder: string;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  spacing: (n: number) => number;
  shadow1: object;
  shadow2: object;
  navBarShadow: object;
}

export type ThemeMode = 'light' | 'dark';

export interface NavigationScreen {
  name: string;
  component: React.ComponentType<any>;
  options?: any;
}
