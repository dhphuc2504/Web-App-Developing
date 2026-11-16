import React, { useEffect, useState } from "react";
import { Field } from "./common.jsx";

export function useMfaLock(error) {
  const [until, setUntil] = useState(0),
    [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (error?.code === "MFA_LOCKED") {
      setUntil(Date.now() + 30000);
      setRemaining(30);
    }
  }, [error]);
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(
      () => setRemaining(Math.max(0, Math.ceil((until - Date.now()) / 1000))),
      250,
    );
    return () => clearInterval(timer);
  }, [until]);
  return remaining;
}

export function MfaCode({ method, setMethod, code, setCode }) {
  return (
    <>
      <Field
        name="mfaCode"
        label={
          method === "recovery"
            ? "Unused recovery code"
            : "Six-digit authenticator code"
        }
        value={code}
        onChange={setCode}
        required
      />
      <button
        type="button"
        className="secondary"
        onClick={() => {
          setMethod(method === "recovery" ? "totp" : "recovery");
          setCode("");
        }}
      >
        {method === "recovery"
          ? "Use authenticator instead"
          : "Use a recovery code instead"}
      </button>
      <p>
        A code can be used only once. Four incorrect attempts pause verification
        for 30 seconds.
      </p>
    </>
  );
}

export function RecoveryCodes({ codes, busy, onSaved }) {
  const [saved, setSaved] = useState(false);
  function download() {
    const blob = new Blob(
      [
        "Santaishi-tei administrator recovery codes\nKeep these private. Each code can be used once.\n\n" +
          codes.join("\n"),
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "santaishi-tei-recovery-codes.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="recovery-panel" aria-label="Save recovery codes">
      <h2>Keep a spare key.</h2>
      <p>
        Save these ten codes somewhere private, separate from your phone. Each
        works once. They are shown only now; finish within ten minutes.
      </p>
      <ol className="recovery-codes">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="secondary"
        onClick={download}
        disabled={busy}
      >
        Download recovery codes
      </button>
      <label className="recovery-saved">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          disabled={busy}
        />{" "}
        I saved my recovery codes securely
      </label>
      <button type="button" onClick={onSaved} disabled={busy || !saved}>
        {busy ? "Saving…" : "Finish & continue"}
      </button>
    </section>
  );
}
