import React, { createContext, ReactNode, useContext, useState } from 'react';
import { CalendarEvent } from '../services/CalendarService';

type UpdatesContextValue = {
  posts: any[];
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
  calendarEvents: CalendarEvent[];
  setCalendarEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
};

const UpdatesContext = createContext<UpdatesContextValue | undefined>(undefined);

export const UpdatesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const value: UpdatesContextValue = {
    posts,
    setPosts,
    calendarEvents,
    setCalendarEvents,
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


