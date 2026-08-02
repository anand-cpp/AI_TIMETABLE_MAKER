import { useState, useEffect } from 'react';

/**
 * useDebounce - Delays updating a value until after delay ms
 * Usage:
 *   const debouncedSearch = useDebounce(searchTerm, 300)
 */
const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;