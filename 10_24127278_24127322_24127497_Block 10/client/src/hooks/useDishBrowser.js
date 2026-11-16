import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
export function useDishBrowser(loader) {
  const [params, setParams] = useSearchParams(),
    requestParams = new URLSearchParams(params);
  requestParams.delete("anchor");
  const key = requestParams.toString();
  const [state, setState] = useState({
      data: null,
      loading: true,
      error: null,
    }),
    [revision, setRevision] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const mode = params.get("mode") || "pages",
    append = useRef(null),
    busy = useRef(false),
    restoreAnchor = useRef(null),
    current = useRef(state);
  current.current = state;
  useEffect(() => {
    const controller = new AbortController();
    busy.current = true;
    const appending = append.current === key;
    restoreAnchor.current = appending ? null : params.get("anchor");
    append.current = null;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader(key, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState((s) => {
          const items =
            appending && mode !== "pages" && data.page > s.data?.page
              ? [...s.data.items, ...data.items]
              : data.items;
          return {
            data: {
              ...data,
              items: [...new Map(items.map((d) => [d.id, d])).values()],
            },
            loading: false,
            error: null,
          };
        });
        busy.current = false;
        const corrected = new URLSearchParams(params);
        corrected.set("page", String(data.page));
        const anchor = appending
          ? data.items[0]?.id
          : params.get("anchor") || data.items[0]?.id;
        if (anchor) corrected.set("anchor", anchor);
        else corrected.delete("anchor");
        if (corrected.toString() !== params.toString())
          setParams(corrected, { replace: true });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          busy.current = false;
          setState((s) => ({ ...s, loading: false, error }));
        }
      });
    return () => {
      controller.abort();
    };
  }, [key, revision, loader]);
  useEffect(() => {
    if (state.loading || !restoreAnchor.current) return;
    const id = restoreAnchor.current;
    restoreAnchor.current = null;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById("dish-" + id)
        ?.scrollIntoView({ block: "center" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [state.data, state.loading]);
  function change(values, { appendPage = false } = {}) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(values))
      v !== "" && v !== undefined ? next.set(k, String(v)) : next.delete(k);
    next.delete("anchor");
    if (appendPage) append.current = next.toString();
    else append.current = null;
    setParams(next);
  }
  const next = () => {
    const s = current.current;
    if (busy.current || s.loading || s.error || !s.data?.hasNext) return;
    busy.current = true;
    change({ page: s.data.page + 1 }, { appendPage: mode !== "pages" });
  };
  return {
    ...state,
    params,
    mode,
    autoPaused,
    setAutoPaused,
    change,
    next,
    reload: () => {
      // Retrying a failed append must retain the batches already displayed.
      append.current =
        state.error &&
        mode !== "pages" &&
        Number(params.get("page")) > (state.data?.page || 0)
          ? key
          : null;
      setRevision((n) => n + 1);
    },
  };
}
