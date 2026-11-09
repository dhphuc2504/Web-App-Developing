export function createCaptchaLoader(win, doc, timeoutMs = 12000) {
  let pending,
    sequence = 0;
  return function load() {
    if (win.grecaptcha?.render) return Promise.resolve(win.grecaptcha);
    if (pending) return pending;
    const callback = "restaurantCaptchaReady" + ++sequence;
    const script = doc.createElement("script");
    script.src =
      "https://www.google.com/recaptcha/api.js?onload=" +
      callback +
      "&render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.captcha = "true";
    pending = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // A late Google response after timeout must not invoke a missing callback.
        win[callback] = () => {};
        if (error) {
          script.remove();
          reject(error);
        } else resolve(win.grecaptcha);
      };
      const timer = setTimeout(
        () =>
          finish(
            new Error(
              "CAPTCHA could not load. Check your connection or content blocker, then retry.",
            ),
          ),
        timeoutMs,
      );
      win[callback] = () =>
        win.grecaptcha?.render
          ? finish()
          : finish(new Error("CAPTCHA is not ready. Please retry."));
      script.addEventListener(
        "error",
        () =>
          finish(
            new Error("CAPTCHA was blocked or could not load. Please retry."),
          ),
        { once: true },
      );
      doc.head.append(script);
    }).catch((error) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}
let browserLoader;
export function loadCaptcha() {
  browserLoader ||= createCaptchaLoader(window, document);
  return browserLoader();
}
