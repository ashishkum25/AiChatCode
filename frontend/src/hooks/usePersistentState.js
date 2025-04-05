import { useState, useEffect } from 'react';

// Custom hook for persisting state in localStorage
export const usePersistentState = (key, initialValue) => {
  // Initialize state from localStorage or use initialValue
  const [state, setState] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      // Parse stored json or return initialValue if nothing stored
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when state changes
  useEffect(() => {
    try {
      // Allow value to be a function for same API as useState
      const valueToStore = state instanceof Function ? state(state) : state;
      
      // Save state to localStorage
      if (valueToStore !== null && valueToStore !== undefined) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
};

export default usePersistentState;