(() => {
  const mobileQuery = window.matchMedia("(max-width: 991px)");

  function trackInteraction(target, fallbackName) {
    const trackName = target?.dataset.track || fallbackName;

    if (!trackName || typeof window.gtag !== "function") {
      return;
    }

    const eventPayload = {
      cta_name: trackName,
      cta_location: target?.dataset.trackLocation || "unknown",
      cta_label: target?.textContent?.trim() || "",
      page_type: document.body?.dataset.pageType || "unknown",
      destination: target?.getAttribute?.("href") || window.location.href,
    };

    const eventName = String(trackName).replace(/[^a-zA-Z0-9_]/g, "_");

    window.gtag("event", eventName, eventPayload);
    window.gtag("event", "cta_click", eventPayload);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    return false;
  }

  function flashButtonLabel(button, label) {
    if (!button) {
      return;
    }

    const originalLabel = button.dataset.originalLabel || button.textContent;
    button.dataset.originalLabel = originalLabel;
    button.textContent = label;

    window.setTimeout(() => {
      button.textContent = button.dataset.originalLabel;
    }, 1800);
  }

  function initNavigation(nav, index) {
    const button = nav.querySelector(".menu-button");
    const menu = nav.querySelector(".navigation-items");

    if (!button || !menu) {
      return;
    }

    const menuId = menu.id || `site-nav-menu-${index + 1}`;
    menu.id = menuId;

    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    button.setAttribute("aria-controls", menuId);
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Öppna meny");

    function isMobile() {
      return mobileQuery.matches;
    }

    function closeMenu() {
      button.classList.remove("w--open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Öppna meny");
      menu.removeAttribute("data-nav-menu-open");
    }

    function openMenu() {
      if (!isMobile()) {
        return;
      }

      button.classList.add("w--open");
      button.setAttribute("aria-expanded", "true");
      button.setAttribute("aria-label", "Stäng meny");
      menu.setAttribute("data-nav-menu-open", "");
    }

    function toggleMenu() {
      if (!isMobile()) {
        return;
      }

      if (menu.hasAttribute("data-nav-menu-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      toggleMenu();
    });

    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleMenu();
      }

      if (event.key === "Escape") {
        closeMenu();
      }
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        closeMenu();
      });
    });

    document.addEventListener("click", (event) => {
      if (!nav.contains(event.target)) {
        closeMenu();
      }
    });

    mobileQuery.addEventListener("change", () => {
      if (!isMobile()) {
        closeMenu();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".navigation.w-nav").forEach((nav, index) => {
      initNavigation(nav, index);
    });

    document.addEventListener("click", async (event) => {
      const shareButton = event.target.closest("[data-share]");

      if (shareButton) {
        event.preventDefault();
        trackInteraction(shareButton, "share_concert");

        const sharePayload = {
          title: shareButton.dataset.shareTitle || document.title,
          text: shareButton.dataset.shareText || document.title,
          url: shareButton.dataset.shareUrl || window.location.href,
        };

        try {
          if (navigator.share) {
            await navigator.share(sharePayload);
            flashButtonLabel(shareButton, "Delat");
            return;
          }

          const copied = await copyToClipboard(sharePayload.url);
          flashButtonLabel(
            shareButton,
            copied ? "Länk kopierad" : "Dela manuellt"
          );
        } catch (error) {
          flashButtonLabel(shareButton, "Kunde inte dela");
        }

        return;
      }

      const copyButton = event.target.closest("[data-copy-url]");

      if (copyButton) {
        event.preventDefault();
        trackInteraction(copyButton, "copy_link");

        try {
          const copied = await copyToClipboard(window.location.href);
          flashButtonLabel(copyButton, copied ? "Länk kopierad" : "Kunde inte kopiera");
        } catch (error) {
          flashButtonLabel(copyButton, "Kunde inte kopiera");
        }

        return;
      }

      const trackTarget = event.target.closest("[data-track]");

      if (trackTarget) {
        trackInteraction(trackTarget);
      }
    });
  });
})();
