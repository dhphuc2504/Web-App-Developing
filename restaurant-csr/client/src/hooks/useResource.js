import { useEffect, useRef, useState } from "react";
export function useResource(loader, key, { keepPreviousData = false } = {}) {
  const latest = useRef(loader);
  latest.current = loader;
  const [state, setState] = useState({
      data: null,
      error: null,
      loading: true,
    }),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({
      data: keepPreviousData ? previous.data : null,
      error: null,
      loading: true,
    }));
    latest
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            data: keepPreviousData ? previous.data : null,
            error,
            loading: false,
          }));
      });
    return () => controller.abort();
  }, [key, revision, keepPreviousData]);
  return { ...state, reload: () => setRevision((n) => n + 1) };
}
export function useMutation() {
  const [error, setError] = useState(null),
    [saving, setSaving] = useState(false);
  const active = useRef(false);
  async function run(action) {
    if (active.current) return null;
    active.current = true;
    setSaving(true);
    setError(null);
    try {
      return await action();
    } catch (e) {
      setError(e);
      return null;
    } finally {
      active.current = false;
      setSaving(false);
    }
  }
  return { run, error, saving, clearError: () => setError(null) };
}
