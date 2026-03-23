(() => {
  const mobileQuery = window.matchMedia("(max-width: 991px)");

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
    button.setAttribute("aria-label", "menu");

    function isMobile() {
      return mobileQuery.matches;
    }

    function closeMenu() {
      button.classList.remove("w--open");
      button.setAttribute("aria-expanded", "false");
      menu.removeAttribute("data-nav-menu-open");
    }

    function openMenu() {
      if (!isMobile()) {
        return;
      }

      button.classList.add("w--open");
      button.setAttribute("aria-expanded", "true");
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
  });
})();
