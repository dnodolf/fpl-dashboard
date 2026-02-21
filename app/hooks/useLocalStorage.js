'use client';
import { useState, useEffect } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Error reading localStorage key "${key}":`, error);
      }
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    }
  };

  return [storedValue, setValue];
}