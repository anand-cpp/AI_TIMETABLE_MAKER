import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * useApi - Generic hook for API calls
 * Handles loading, error, and success states
 * Usage:
 *   const { execute, loading, error, data } = useApi(myService.getAll)
 *   await execute(params)
 */
const useApi = (apiFunction, options = {}) => {
  const {
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    showSuccessToast = false,
    showErrorToast = true,
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const execute = useCallback(
    async (...args) => {
      try {
        setLoading(true);
        setError(null);

        const result = await apiFunction(...args);
        setData(result);

        if (showSuccessToast && successMessage) {
          toast.success(successMessage);
        }

        if (onSuccess) onSuccess(result);

        return result;
      } catch (err) {
        const message =
          err.response?.data?.message ||
          errorMessage ||
          err.message ||
          'Something went wrong';

        setError(message);

        if (showErrorToast) {
          toast.error(message);
        }

        if (onError) onError(err, message);

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, onSuccess, onError, successMessage, errorMessage, showSuccessToast, showErrorToast]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { execute, loading, error, data, reset };
};

export default useApi;