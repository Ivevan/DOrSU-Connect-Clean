import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { ThemeProvider } from '../contexts/ThemeContext';

interface AllThemesProviderProps {
  children: React.ReactNode;
}

const AllThemesProvider: React.FC<AllThemesProviderProps> = ({ children }) => {
  return <ThemeProvider>{children}</ThemeProvider>;
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add custom options here if needed
}

const customRender = (
  ui: ReactElement,
  { ...renderOptions }: CustomRenderOptions = {}
) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AllThemesProvider>{children}</AllThemesProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Re-export everything
export * from '@testing-library/react-native';

// Override render method
export { customRender as render };

