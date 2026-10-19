import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { activity, authEvents } from "../api/client.js";
import { sessionApi } from "../api/resources.js";
import { Modal, ErrorNotice } from "./common.jsx";
const Context = createContext(null);
export const useApp = () => useContext(Context);
export const room = (path) =>
  path === "/"
    ? "outside"
    : path === "/directory"
      ? "house"
      : path.startsWith("/menu")
        ? "dining"
        : path.startsWith("/kitchen")
          ? "kitchen"
          : path.startsWith("/admin")
            ? "office"
            : "staff";
export function AppProvider({ children }) {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(null),
    [confirm, setConfirm] = useState(null),
    [phase, setPhase] = useState("");
  const pending = useSyncExternalStore(
      activity.subscribe,
      activity.getSnapshot,
    ),
    location = useLocation(),
    navigate = useNavigate(),
    timer = useRef(null),
    transition = useRef(false);
  const bootstrap = () => {
    setError(null);
    sessionApi
      .get()
      .then((data) => {
        setUser(data.user);
        setReady(true);
      })
      .catch(setError);
  };
  useEffect(() => {
    bootstrap();
    return authEvents.subscribe(() => setUser(null));
  }, []);
  useEffect(() => {
    document.documentElement.classList.remove(
      "journey-closing",
      "journey-arriving",
      "journey-revealing",
    );
    if (phase === "closing")
      document.documentElement.classList.add("journey-closing");
    if (["closed", "opening"].includes(phase))
      document.documentElement.classList.add("journey-arriving");
    if (phase === "opening")
      document.documentElement.classList.add("journey-revealing");
    return () =>
      document.documentElement.classList.remove(
        "journey-closing",
        "journey-arriving",
        "journey-revealing",
      );
  }, [phase]);
  useEffect(() => {
    if (phase === "closed" && !pending) {
      const id = setTimeout(() => setPhase("opening"), 100);
      return () => clearTimeout(id);
    }
    if (phase === "opening") {
      const id = setTimeout(() => {
        setPhase("");
        transition.current = false;
      }, 700);
      return () => clearTimeout(id);
    }
  }, [phase, pending]);
  useEffect(() => {
    const page = room(location.pathname);
    document.body.className = {
      outside: "page-entrance",
      house: "page-directory",
      dining: "page-dining",
      kitchen: "page-kitchen",
      office: "page-admin",
      staff: "page-auth",
    }[page];
    window.scrollTo(0, 0);
    document.title = "三太子亭 · Santaishi-tei";
  }, [location.pathname]);
  useEffect(() => {
    const cancel = () => {
      clearTimeout(timer.current);
      setPhase("");
      transition.current = false;
    };
    window.addEventListener("popstate", cancel);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("popstate", cancel);
    };
  }, []);
  function onNavigate(e) {
    const link = e.target.closest("a");
    if (
      !link ||
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      link.target ||
      link.hasAttribute("download")
    )
      return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin) return;
    if (
      room(url.pathname) === room(location.pathname) ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    if (transition.current) return;
    transition.current = true;
    setPhase("closing");
    timer.current = setTimeout(() => {
      setPhase("closed");
      navigate(url.pathname + url.search + url.hash);
    }, 550);
  }
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        ready,
        confirm: (message) =>
          new Promise((resolve) => setConfirm({ message, resolve })),
      }}
    >
      <div className="journey-overlay" aria-hidden="true">
        <div className="journey-panel journey-left" />
        <div className="journey-panel journey-right" />
      </div>
      <fieldset
        className="application"
        disabled={pending > 0 || !!phase}
        inert={pending > 0 || !!phase}
        aria-busy={pending > 0}
        onClickCapture={onNavigate}
      >
        {error && !ready ? (
          <section className="empty-state">
            <ErrorNotice error={error} />
            <button onClick={bootstrap}>Retry connection</button>
          </section>
        ) : (
          children
        )}
      </fieldset>
      {pending > 0 && (
        <div className="loading-indicator" role="status">
          <span className="spinner" />
          Loading…
        </div>
      )}
      {confirm && (
        <Modal
          label="Confirm action"
          onClose={() => {
            confirm.resolve(false);
            setConfirm(null);
          }}
        >
          <h2>Please confirm</h2>
          <p>{confirm.message}</p>
          <div className="button-row">
            <button
              onClick={() => {
                confirm.resolve(true);
                setConfirm(null);
              }}
            >
              Confirm
            </button>
            <button
              className="secondary"
              onClick={() => {
                confirm.resolve(false);
                setConfirm(null);
              }}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </Context.Provider>
  );
}
