import React, { useEffect, useRef, useState } from "react";
import { loadCaptcha } from "../api/captcha.js";
import { Link, useLocation } from "react-router-dom";
import { accountApi } from "../api/resources.js";
import { useMutation, useResource } from "../hooks/useResource.js";
import { ErrorNotice, Field } from "../components/common.jsx";
function Captcha({ siteKey, onChange }) {
  const host = useRef(null),
    [attempt, setAttempt] = useState(0),
    [status, setStatus] = useState("Loading CAPTCHA…"),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false,
      widget,
      api;
    setStatus("Loading CAPTCHA…");
    setFailed(false);
    onChange("");
    // Each mount gets a fresh element; stale callbacks cannot update the current form.
    const container = document.createElement("div");
    host.current.replaceChildren(container);
    loadCaptcha()
      .then((loaded) => {
        if (disposed) return;
        api = loaded;
        widget = api.render(container, {
          sitekey: siteKey,
          size: window.matchMedia("(max-width: 420px)").matches ? "compact" : "normal",
          callback: (token) => {
            if (!disposed) {
              onChange(token);
              setStatus("CAPTCHA completed.");
            }
          },
          "expired-callback": () => {
            if (!disposed) {
              onChange("");
              setStatus("CAPTCHA expired. Complete it again.");
            }
          },
          "error-callback": () => {
            if (!disposed) {
              onChange("");
              setStatus("CAPTCHA connection failed. Please retry.");
              setFailed(true);
            }
          },
        });
        setStatus("Complete the CAPTCHA to continue.");
      })
      .catch((error) => {
        if (!disposed) {
          setFailed(true);
          setStatus(error.message);
        }
      });
    return () => {
      disposed = true;
      if (widget !== undefined) {
        try {
          api.reset(widget);
        } catch {}
      }
    };
  }, [siteKey, attempt, onChange]);
  return (
    <div className="auth-captcha">
      <div ref={host} />
      <p role={failed ? "alert" : "status"}>{status}</p>
      {failed && (
        <button
          type="button"
          className="secondary"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Retry CAPTCHA
        </button>
      )}
    </div>
  );
}
export function Account() {
  const { pathname, search } = useLocation(),
    action = {
      "/signup": "signup",
      "/verify-email": "verify-email",
      "/resend-verification": "resend",
      "/forgot-password": "forgot-password",
      "/reset-password": "reset-password",
    }[pathname];
  const config = useResource(accountApi.config, "auth-config"),
    mutation = useMutation();
  const [values, setValues] = useState({
      email: "",
      displayName: "",
      password: "",
      confirmPassword: "",
    }),
    [captcha, setCaptcha] = useState(""),
    [captchaKey, setCaptchaKey] = useState(0),
    [message, setMessage] = useState("");
  const token = new URLSearchParams(search).get("token");
  const titles = {
    signup: "Join the kitchen",
    "verify-email": "Verify your email",
    resend: "Request another activation link",
    "forgot-password": "Forgot your password?",
    "reset-password": "Choose a new password",
  };
  const set = (name) => (value) => setValues((v) => ({ ...v, [name]: value }));
  return (
    <section className="login-layout">
      <div className="auth-intro">
        <p className="eyebrow">三太子亭 · Staff accounts</p>
        <h1>{titles[action]}</h1>
        <p>
          Chef access requires email verification and administrator approval.
        </p>
      </div>
      <form
        className="form-panel auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await mutation.run(() =>
            accountApi.submit(action, {
              ...values,
              token,
              "g-recaptcha-response": captcha,
            }),
          );
          if (result) {
            setMessage(
              action === "verify-email"
                ? "Email verified. Once an administrator approves your account, sign in with your password and email code."
                : result.message,
            );
            setValues((v) => ({ ...v, password: "", confirmPassword: "" }));
          }
          if (action === "signup") {
            setCaptcha("");
            setCaptchaKey((k) => k + 1);
          }
        }}
      >
        <ErrorNotice error={mutation.error || config.error} />
        {mutation.saving && (
          <p role="status">
            Submitting your request and sending email… This can take a few
            seconds.
          </p>
        )}
        <fieldset
          className="auth-fields"
          disabled={mutation.saving}
          aria-busy={mutation.saving}
        >
          {message ? (
            <>
              <p role="status">{message}</p>
              {action === "signup" && (
                <Link to="/resend-verification">
                  Didn't receive an email? Resend verification
                </Link>
              )}
            </>
          ) : (
            <>
              {action === "signup" && (
                <Field
                  label="Display name"
                  name="displayName"
                  value={values.displayName}
                  onChange={set("displayName")}
                  required
                />
              )}
              {["signup", "resend", "forgot-password"].includes(action) && (
                <Field
                  label="Email address"
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={set("email")}
                  required
                />
              )}
              {["signup", "reset-password"].includes(action) && (
                <>
                  <Field
                    label="Password (at least 12 characters)"
                    name="password"
                    type="password"
                    value={values.password}
                    onChange={set("password")}
                    required
                  />
                  <Field
                    label="Confirm password"
                    name="confirmPassword"
                    type="password"
                    value={values.confirmPassword}
                    onChange={set("confirmPassword")}
                    required
                  />
                </>
              )}
              {action === "signup" &&
                (config.data?.recaptchaSiteKey ? (
                  <Captcha
                    key={captchaKey}
                    siteKey={config.data.recaptchaSiteKey}
                    onChange={setCaptcha}
                  />
                ) : (
                  <div>
                    {config.loading ? (
                      <p role="status">Loading registration settings…</p>
                    ) : config.error ? (
                      <button type="button" onClick={config.reload}>
                        Retry registration settings
                      </button>
                    ) : (
                      <p>Registration requires configured reCAPTCHA v2 keys.</p>
                    )}
                  </div>
                ))}
              {action === "verify-email" && (
                <p>
                  Confirm below to activate your email. Opening this link does
                  not change your account automatically.
                </p>
              )}
              <button
                disabled={
                  mutation.saving ||
                  (action === "signup" && !captcha) ||
                  (["verify-email", "reset-password"].includes(action) &&
                    !token)
                }
              >
                {mutation.saving
                  ? "Please wait…"
                  : action === "verify-email"
                    ? "Verify email"
                    : "Continue"}{" "}
                ↗
              </button>
            </>
          )}
        </fieldset>
        <p className="auth-card-footer">
          <Link to="/login">← Back to sign in</Link>
        </p>
      </form>
    </section>
  );
}
