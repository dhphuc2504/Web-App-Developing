import React, { useState } from "react";
import { mfaApi } from "../api/resources.js";
import { useResource, useMutation } from "../hooks/useResource.js";
import {
  ErrorNotice,
  Field,
  Heading,
  ResourceState,
} from "../components/common.jsx";
import {
  MfaCode,
  RecoveryCodes,
  useMfaLock,
} from "../components/MfaControls.jsx";

export function Security() {
  const resource = useResource(mfaApi.status, "admin-security"),
    mutation = useMutation();
  const [flow, setFlow] = useState(null),
    [step, setStep] = useState(null),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [method, setMethod] = useState("totp"),
    [notice, setNotice] = useState("");
  const remaining = useMfaLock(mutation.error);
  function reset() {
    setFlow(null);
    setStep(null);
    setPassword("");
    setCode("");
    setMethod("totp");
    mutation.clearError();
  }
  async function submit(e) {
    e.preventDefault();
    let action =
      flow === "disable"
        ? "disable"
        : flow === "recovery"
          ? "recovery"
          : "setup";
    if (step?.next === "email") action = "setup/verify";
    if (step?.next === "authenticator") action = "setup/confirm";
    const result = await mutation.run(() =>
      mfaApi.submit(
        action,
        step
          ? { challenge: step.challenge, code: code.trim() }
          : { password, code: code.trim(), method },
      ),
    );
    if (!result) return;
    setPassword("");
    setCode("");
    if (result.next) setStep(result);
    else {
      reset();
      setNotice(
        "Authenticator disabled. Your next sign-in will use an email code.",
      );
      resource.reload();
    }
  }
  async function acknowledge() {
    const result = await mutation.run(() =>
      mfaApi.submit(flow === "setup" ? "setup/ack" : "recovery/ack", {
        challenge: step.challenge,
        saved: true,
      }),
    );
    if (result) {
      reset();
      setNotice(
        flow === "setup"
          ? "Authenticator enabled. Use it the next time you sign in."
          : "New recovery codes saved. Previous codes no longer work.",
      );
      resource.reload();
    }
  }
  return (
    <>
      <Heading
        title="Your key to the house."
        kicker="管理 · Account security"
        back="/admin"
      />
      <section className="security-layout">
        <aside className="security-intro">
          <h2>Administrator sign-in</h2>
          <p>
            An authenticator app replaces your email sign-in code when enabled.
            Chef sign-in stays the same.
          </p>
          <p>
            Scan with Google Authenticator, Microsoft Authenticator or another
            TOTP app. Keep your phone’s date and time set automatically.
          </p>
          <p>
            Changes apply to future sign-ins. Existing access tokens expire
            within 15 minutes.
          </p>
        </aside>
        <div className="form-panel auth-card security-card">
          {notice && (
            <p role="status" className="security-notice">
              {notice}
            </p>
          )}
          <ErrorNotice error={mutation.error} />
          {remaining > 0 && (
            <p role="status">Try again in {remaining} seconds.</p>
          )}
          {mutation.saving && (
            <p role="status">
              {step ? "Checking and saving…" : "Verifying your account…"}
            </p>
          )}
          <ResourceState resource={resource}>
            {(status) =>
              !flow ? (
                <>
                  <span className="status-tag">
                    {status.enabled
                      ? "Authenticator enabled"
                      : "Email sign-in codes"}
                  </span>
                  <h2>
                    {status.enabled
                      ? "Your authenticator is ready."
                      : "Add an authenticator."}
                  </h2>
                  <p>
                    {status.enabled
                      ? `${status.recoveryCodesRemaining} unused recovery codes remaining.`
                      : "Confirm your password and email, then connect your authenticator app. Setup is complete only after you save recovery codes."}
                  </p>
                  <div className="security-actions">
                    {(status.enabled
                      ? [
                          ["recovery", "Replace recovery codes"],
                          ["disable", "Turn off authenticator"],
                        ]
                      : [["setup", "Set up authenticator"]]
                    ).map(([action, label]) => (
                      <button
                        key={action}
                        className={action === "disable" ? "secondary" : ""}
                        onClick={() => {
                          reset();
                          setFlow(action);
                          setNotice("");
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              ) : step?.next === "recovery-codes" ? (
                <RecoveryCodes
                  codes={step.recoveryCodes}
                  busy={mutation.saving}
                  onSaved={acknowledge}
                />
              ) : (
                <form onSubmit={submit}>
                  <fieldset className="auth-fields" disabled={mutation.saving}>
                    <h2>
                      {flow === "disable"
                        ? "Turn off authenticator"
                        : flow === "recovery"
                          ? "Replace recovery codes"
                          : step?.next === "email"
                            ? "Confirm your email"
                            : step?.next === "authenticator"
                              ? "Connect your authenticator"
                              : "Confirm it’s you"}
                    </h2>
                    {!step && (
                      <Field
                        name="password"
                        label="Current password"
                        type="password"
                        value={password}
                        onChange={setPassword}
                        required
                      />
                    )}
                    {!step && flow !== "setup" && (
                      <MfaCode
                        method={method}
                        setMethod={setMethod}
                        code={code}
                        setCode={setCode}
                      />
                    )}
                    {step?.next === "email" && (
                      <>
                        <p>
                          Enter the setup code sent to your email. It expires in
                          five minutes.
                        </p>
                        <Field
                          name="emailCode"
                          label="Six-digit setup code"
                          value={code}
                          onChange={setCode}
                          required
                        />
                      </>
                    )}
                    {step?.next === "authenticator" && (
                      <>
                        <img
                          className="totp-qr"
                          src={step.qrCode}
                          alt="Scan this QR code with your authenticator app"
                        />
                        <details>
                          <summary>Can’t scan? Enter this key manually</summary>
                          <code className="totp-manual">{step.manualKey}</code>
                          <p>Time based · 6 digits · 30 seconds</p>
                        </details>
                        <Field
                          name="totpCode"
                          label="Code from your authenticator"
                          value={code}
                          onChange={setCode}
                          required
                        />
                      </>
                    )}
                    {flow === "disable" && (
                      <p>
                        Your next login will require an email code. To replace
                        your authenticator, turn it off and set it up again.
                      </p>
                    )}
                    {flow === "recovery" && (
                      <p>
                        Save the new set before finishing. All previous recovery
                        codes will then stop working.
                      </p>
                    )}
                    <button disabled={remaining > 0}>
                      {flow === "disable" ? "Confirm & turn off" : "Continue"}
                    </button>
                    <button type="button" className="secondary" onClick={reset}>
                      Cancel
                    </button>
                  </fieldset>
                </form>
              )
            }
          </ResourceState>
        </div>
      </section>
    </>
  );
}
