document.documentElement.classList.add("js");

const themeStorageKey = "team-portfolio-theme";
const systemDarkMode = window.matchMedia("(prefers-color-scheme: dark)");
const themeToggles = document.querySelectorAll("[data-theme-toggle]");

const readSavedTheme = () => {
  try {
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : null;
  } catch {
    return null;
  }
};

const saveTheme = (theme) => {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // The chosen theme still applies for this page if storage is unavailable.
  }
};

let selectedTheme = readSavedTheme();

if (selectedTheme) {
  document.documentElement.dataset.theme = selectedTheme;
}

const getActiveTheme = () => selectedTheme || (systemDarkMode.matches ? "dark" : "light");

const updateThemeControls = () => {
  const activeTheme = getActiveTheme();
  const targetTheme = activeTheme === "dark" ? "light" : "dark";

  themeToggles.forEach((toggle) => {
    const icon = toggle.querySelector("[data-theme-icon]");
    const label = toggle.querySelector("[data-theme-label]");

    toggle.setAttribute("aria-label", `Switch to ${targetTheme} mode`);
    toggle.title = `Switch to ${targetTheme} mode`;

    if (icon) {
      icon.textContent = targetTheme === "dark" ? "☾" : "☀";
    }

    if (label) {
      label.textContent = targetTheme === "dark" ? "Dark" : "Light";
    }
  });
};

themeToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    selectedTheme = getActiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = selectedTheme;
    saveTheme(selectedTheme);
    updateThemeControls();
  });
});

systemDarkMode.addEventListener("change", () => {
  if (!selectedTheme) {
    updateThemeControls();
  }
});

updateThemeControls();

const menuToggle = document.querySelector("[data-menu-toggle]");
const siteNavigation = document.querySelector("[data-navigation]");

if (menuToggle && siteNavigation) {
  const closeMenu = ({ restoreFocus = false } = {}) => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    siteNavigation.hidden = true;

    if (restoreFocus) {
      menuToggle.focus();
    }
  };

  const openMenu = () => {
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close navigation");
    siteNavigation.hidden = false;
  };

  closeMenu();

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });

  siteNavigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      closeMenu({ restoreFocus: true });
    }
  });

  const desktopNavigation = window.matchMedia("(min-width: 48rem)");

  const syncMenuForViewport = (event) => {
    if (event.matches) {
      siteNavigation.hidden = false;
      menuToggle.setAttribute("aria-expanded", "false");
    } else {
      closeMenu();
    }
  };

  syncMenuForViewport(desktopNavigation);
  desktopNavigation.addEventListener("change", syncMenuForViewport);
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const precisePointer = window.matchMedia("(pointer: fine)");

if (precisePointer.matches && !reducedMotion.matches) {
  let pointerFrame = 0;
  let pointerX = window.innerWidth * 0.78;
  let pointerY = window.innerHeight * 0.18;

  const renderPointerGlow = () => {
    document.documentElement.style.setProperty("--pointer-x", `${pointerX}px`);
    document.documentElement.style.setProperty("--pointer-y", `${pointerY}px`);
    pointerFrame = 0;
  };

  window.addEventListener("pointermove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    document.documentElement.classList.remove("pointer-away");

    if (!pointerFrame) {
      pointerFrame = window.requestAnimationFrame(renderPointerGlow);
    }
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => {
    document.documentElement.classList.add("pointer-away");
  });

  window.addEventListener("blur", () => {
    document.documentElement.classList.add("pointer-away");
  });
}

const memberTerminalOutput = document.querySelector("[data-terminal-member-output]");
const memberPreviewCards = document.querySelectorAll("[data-member-preview]");

if (memberTerminalOutput && memberPreviewCards.length) {
  const defaultMemberOutput = memberTerminalOutput.textContent;

  const showMemberInTerminal = (card) => {
    memberTerminalOutput.textContent = `> ${card.dataset.memberPreview}`;
    memberTerminalOutput.classList.add("is-active");
  };

  const resetMemberTerminal = () => {
    memberTerminalOutput.textContent = defaultMemberOutput;
    memberTerminalOutput.classList.remove("is-active");
  };

  memberPreviewCards.forEach((card) => {
    card.addEventListener("pointerenter", () => showMemberInTerminal(card));
    card.addEventListener("pointerleave", resetMemberTerminal);
    card.addEventListener("focusin", () => showMemberInTerminal(card));
    card.addEventListener("focusout", (event) => {
      if (!card.contains(event.relatedTarget)) {
        resetMemberTerminal();
      }
    });
  });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a");

  if (
    !link ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.target ||
    link.hasAttribute("download") ||
    reducedMotion.matches
  ) {
    return;
  }

  const destination = new URL(link.href, window.location.href);
  const isSamePageAnchor =
    destination.pathname === window.location.pathname &&
    destination.search === window.location.search &&
    destination.hash;
  const isLocalPage =
    destination.origin === window.location.origin &&
    destination.pathname.endsWith(".html");

  if (!isLocalPage || isSamePageAnchor) {
    return;
  }

  event.preventDefault();
  document.documentElement.classList.add("is-leaving");

  window.setTimeout(() => {
    window.location.assign(destination.href);
  }, 180);
});

window.addEventListener("pageshow", () => {
  document.documentElement.classList.remove("is-leaving");
});
