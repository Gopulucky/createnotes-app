import { useCallback, useEffect, useRef, useState } from 'react';

// Shared toast pattern (message + auto-dismiss) used anywhere an action needs
// visible confirmation without blocking, replacing alert() and silent failures.
export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const showToast = useCallback((message, tone = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, tone });
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return { toast, showToast };
}
