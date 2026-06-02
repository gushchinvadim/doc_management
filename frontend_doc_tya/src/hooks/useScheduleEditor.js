// src/hooks/useScheduleEditor.js
import { useState, useCallback } from 'react';

// Этот хук теперь не нужен — вся логика в компоненте.
// Но если хотите оставить для переиспользования:

export const useScheduleState = (initialState = 'idle') => {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState(null);
  
  const withErrorHandling = useCallback(async (fn, errorMessage) => {
    try {
      return await fn();
    } catch (err) {
      setError(err.message || errorMessage);
      throw err;
    }
  }, []);
  
  return { state, setState, error, setError, withErrorHandling };
};