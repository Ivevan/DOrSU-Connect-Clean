import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { CalendarEvent } from '../services/CalendarService';

type UpdatesContextValue = {
  posts: any[];
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  calendarEvents: CalendarEvent[];
  setCalendarEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  clearUpdates: () => void;
};

const UpdatesContext = createContext<UpdatesContextValue | undefined>(undefined);

// Global reference to clear function for logout to access
let globalClearUpdatesFn: (() => void) | null = null;

export const UpdatesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const clearUpdates = useCallback(() => {
    setPosts([]);
    setCalendarEvents([]);
    // Reset session flags when clearing updates
    try {
      const { resetAllSessionFlags } = require('../utils/sessionReset');
      resetAllSessionFlags();
    } catch (error) {
      // Ignore errors if module not available
      if (__DEV__) console.warn('Could not reset session flags:', error);
    }
  }, []);

  // Store clear function globally so logout can access it
  React.useEffect(() => {
    globalClearUpdatesFn = clearUpdates;
    return () => {
      globalClearUpdatesFn = null;
    };
  }, [clearUpdates]);

  const value: UpdatesContextValue = {
    posts,
    setPosts,
    calendarEvents,
    setCalendarEvents,
    clearUpdates,
  };

  return (
    <UpdatesContext.Provider value={value}>
      {children}
    </UpdatesContext.Provider>
  );
};

export const useUpdates = (): UpdatesContextValue => {
  const ctx = useContext(UpdatesContext);
  if (!ctx) {
    throw new Error('useUpdates must be used within an UpdatesProvider');
  }
  return ctx;
};

// Export global clear function for logout to access
export { globalClearUpdatesFn };


