'use client';

import { useState, useCallback, useEffect } from 'react';

export interface RecentItem {
  id: string;
  type: 'barrel' | 'client' | 'geofence';
  label: string;
  sublabel?: string;
  href: string;
  visitedAt: string;
}

const STORAGE_KEY = 'kegsafe-recent-history';
const MAX_ITEMS = 10;

function loadHistory(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: RecentItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useRecentHistory() {
  const [history, setHistory] = useState<RecentItem[]>(loadHistory);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setHistory(loadHistory());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const recordVisit = useCallback((item: Omit<RecentItem, 'visitedAt'>) => {
    setHistory(prev => {
      const next = [
        { ...item, visitedAt: new Date().toISOString() },
        ...prev.filter(h => h.id !== item.id),
      ].slice(0, MAX_ITEMS);
      saveHistory(next);
      return next;
    });
  }, []);

  return { history, recordVisit };
}
