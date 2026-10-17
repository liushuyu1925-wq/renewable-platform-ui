(function () {
  var NAV_SELECTOR = ".pill-nav-links";
  var LINK_SELECTOR = ".pill-nav-link";
  var SLIDER_SELECTOR = ".liquid-glass-slider, .active-glass-pill";
  var DRAG_OVER_CLASS = "is-drag-over";
  var DRAG_THRESHOLD = 7;
  var MOVE_MS = 250;
  var BOUNCE_MS = 190;
  var CLICK_SUPPRESS_MS = 480;
  var PILL_GROW_X = 20;
  var PILL_GROW_Y = 14;
  var ROUTE_ALIASES = {
    "/module/windcast": "/prediction/windcast",
    "/module/pv_power_forecast": "/prediction/windcast",
    "/module/blade_detection": "/diagnosis",
    "/module/inverter_health": "/diagnosis",
  };
  var STATE_CLASSES = [
    "is-slider-hover",
    "is-slider-pressed",
    "is-dragging",
    "is-snapping",
    "is-settling",
    "is-click-bounce",
  ];

  var states = new WeakMap();
  var startupTimer = 0;
  var scheduled = 0;

  function normalizePath(pathname) {
    if (!pathname || pathname === "/") {
      return "/overview";
    }
    var normalized = pathname.replace(/\/$/, "") || "/overview";
    Object.keys(ROUTE_ALIASES).some(function (prefix) {
      if (normalized === prefix || normalized.indexOf(prefix + "/") === 0) {
        normalized = ROUTE_ALIASES[prefix];
        return true;
      }
      return false;
    });
    if (normalized.indexOf("/prediction") === 0) {
      return "/prediction/windcast";
    }
    if (normalized.indexOf("/diagnosis") === 0) {
      return "/diagnosis";
    }
    return normalized;
  }

  function routeForLink(link) {
    if (!link) {
      return "/overview";
    }
    var href = link.getAttribute("href") || link.pathname || "/overview";
    try {
      return normalizePath(new URL(href, window.location.origin).pathname);
    } catch (_error) {
      return normalizePath(href);
    }
  }

  function getState(nav) {
    var state = states.get(nav);
    if (!state) {
      state = {
        activeLink: null,
        pathname: "",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        centerX: 0,
        centerY: 0,
        hasGeometry: false,
        isPointerDown: false,
        dragStarted: false,
        pointerId: null,
        pointerStartX: 0,
        pointerStartY: 0,
        currentCenterX: 0,
        raf: 0,
        pendingGeometry: null,
        pendingRoute: null,
        pendingBounceTimer: 0,
        bounceTimer: 0,
        suppressTrustedClick: false,
        suppressClickTimer: 0,
        resizeObserver: null,
        windowListenersReady: false,
      };
      states.set(nav, state);
    }
    return state;
  }

  function navLinks(nav) {
    return Array.prototype.slice.call(nav.querySelectorAll(":scope > " + LINK_SELECTOR));
  }

  function slider(nav) {
    return nav.querySelector(SLIDER_SELECTOR);
  }

  function ensureSlider(nav) {
    var pill = slider(nav);
    if (!pill) {
      return null;
    }
    pill.setAttribute("aria-hidden", "true");
    pill.style.pointerEvents = "none";
    pill.querySelectorAll(".liquid-lens-track").forEach(function (track) {
      track.textContent = "";
      track.setAttribute("aria-hidden", "true");
    });
    return pill;
  }

  function measureLink(nav, link) {
    if (!nav || !link || nav.getClientRects().length === 0 || link.getClientRects().length === 0) {
      return null;
    }
    var navRect = nav.getBoundingClientRect();
    var linkRect = link.getBoundingClientRect();
    return {
      x: linkRect.left - navRect.left + nav.scrollLeft,
      y: linkRect.top - navRect.top + nav.scrollTop,
      width: linkRect.width,
      height: linkRect.height,
      centerX: linkRect.left - navRect.left + nav.scrollLeft + linkRect.width / 2,
      centerY: linkRect.top - navRect.top + nav.scrollTop + linkRect.height / 2,
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function geometryForLink(nav, link, preferredCenterX) {
    var anchor = measureLink(nav, link);
    if (!anchor) {
      return null;
    }
    var width = anchor.width + PILL_GROW_X;
    var height = anchor.height + PILL_GROW_Y;
    var centerX = typeof preferredCenterX === "number" ? preferredCenterX : anchor.centerX;
    var centerY = anchor.centerY;
    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width: width,
      height: height,
      centerX: centerX,
      centerY: centerY,
    };
  }

  function dragCenterBounds(nav) {
    var links = navLinks(nav);
    var first = measureLink(nav, links[0]);
    var last = measureLink(nav, links[links.length - 1]);
    if (!first || !last) {
      return { min: 0, max: Math.max(nav.clientWidth, nav.scrollWidth) };
    }
    return { min: first.centerX, max: last.centerX };
  }

  function nearestLink(nav, centerX) {
    var links = navLinks(nav);
    var nearest = links[0] || null;
    var nearestDistance = Number.POSITIVE_INFINITY;
    links.forEach(function (link) {
      var rect = measureLink(nav, link);
      if (!rect) {
        return;
      }
      var distance = Math.abs(rect.centerX - centerX);
      if (distance < nearestDistance) {
        nearest = link;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  function activeLinkForPath(nav) {
    var currentPath = normalizePath(window.location.pathname);
    var links = navLinks(nav);
    return (
      links.find(function (link) {
        return routeForLink(link) === currentPath;
      }) || links[0] || null
    );
  }

  function setPhase(nav, phase) {
    nav.classList.remove.apply(nav.classList, STATE_CLASSES);
    if (phase === "pressing") {
      nav.classList.add("is-slider-pressed");
    } else if (phase === "dragging") {
      nav.classList.add("is-dragging");
    } else if (phase === "snapping") {
      nav.classList.add("is-snapping");
    } else if (phase === "settling") {
      nav.classList.add("is-settling");
    } else if (phase === "bounce") {
      nav.classList.add("is-click-bounce");
    }
  }

  function clearDragOver(nav) {
    nav.querySelectorAll(":scope > " + LINK_SELECTOR + "." + DRAG_OVER_CLASS).forEach(function (link) {
      link.classList.remove(DRAG_OVER_CLASS);
    });
  }

  function setDragOver(nav, target) {
    navLinks(nav).forEach(function (link) {
      link.classList.toggle(DRAG_OVER_CLASS, link === target);
    });
  }

  function setActiveClass(nav, target) {
    navLinks(nav).forEach(function (link) {
      var isActive = link === target;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function applyGeometry(nav, geometry, immediate) {
    var pill = ensureSlider(nav);
    if (!pill || !geometry) {
      return;
    }
    var state = getState(nav);
    state.x = geometry.x;
    state.y = geometry.y;
    state.width = geometry.width;
    state.height = geometry.height;
    state.centerX = geometry.centerX;
    state.centerY = geometry.centerY;
    state.currentCenterX = geometry.centerX;

    var firstGeometry = !state.hasGeometry;
    if (firstGeometry || immediate) {
      pill.style.transition = "none";
    }

    pill.style.width = geometry.width.toFixed(3) + "px";
    pill.style.height = geometry.height.toFixed(3) + "px";
    pill.style.opacity = "1";
    pill.style.setProperty("--liquid-slider-center-x", geometry.centerX.toFixed(3) + "px");
    pill.style.setProperty("--liquid-slider-center-y", geometry.centerY.toFixed(3) + "px");
    pill.style.setProperty("--liquid-slider-x", geometry.x.toFixed(3) + "px");
    pill.style.setProperty("--liquid-slider-y", geometry.y.toFixed(3) + "px");
    pill.style.setProperty("--liquid-pill-x", geometry.x.toFixed(3) + "px");
    pill.style.setProperty("--liquid-pill-y", geometry.y.toFixed(3) + "px");
    pill.style.setProperty(
      "--lens-highlight-x",
      clamp((geometry.centerX / Math.max(nav.scrollWidth, 1)) * 100, 16, 84).toFixed(2) + "%"
    );

    if (firstGeometry || immediate) {
      state.hasGeometry = true;
      window.requestAnimationFrame(function () {
        if (document.body.contains(pill)) {
          pill.style.transition = "";
        }
      });
    }
  }

  function queueGeometry(nav, geometry) {
    var state = getState(nav);
    state.pendingGeometry = geometry;
    if (state.raf) {
      return;
    }
    state.raf = window.requestAnimationFrame(function () {
      state.raf = 0;
      applyGeometry(nav, state.pendingGeometry, false);
    });
  }

  function syncToPath(nav, options) {
    var state = getState(nav);
    var opts = options || {};
    if (state.isPointerDown && !opts.force) {
      return;
    }
    var link = activeLinkForPath(nav);
    if (!link) {
      return;
    }
    var path = normalizePath(window.location.pathname);
    var matchedPendingRoute = state.pendingRoute && state.pendingRoute === path;
    state.pendingRoute = null;
    state.pathname = path;
    state.activeLink = link;
    clearDragOver(nav);
    setActiveClass(nav, link);
    setPhase(nav, "idle");
    applyGeometry(nav, geometryForLink(nav, link), opts.immediate || !state.hasGeometry);

    if (opts.bounce || matchedPendingRoute) {
      window.clearTimeout(state.pendingBounceTimer);
      state.pendingBounceTimer = window.setTimeout(function () {
        playBounce(nav, link);
      }, opts.bounceDelay == null ? MOVE_MS : opts.bounceDelay);
    }
  }

  function playBounce(nav, link) {
    var state = getState(nav);
    window.clearTimeout(state.bounceTimer);
    if (link) {
      applyGeometry(nav, geometryForLink(nav, link), false);
    }
    setPhase(nav, "bounce");
    state.bounceTimer = window.setTimeout(function () {
      if (!state.isPointerDown) {
        setPhase(nav, "idle");
        syncToPath(nav, { force: true });
      }
    }, BOUNCE_MS);
  }

  function localPointerX(nav, event) {
    var navRect = nav.getBoundingClientRect();
    return event.clientX - navRect.left + nav.scrollLeft;
  }

  function localPointerY(nav, event) {
    var navRect = nav.getBoundingClientRect();
    return event.clientY - navRect.top + nav.scrollTop;
  }

  function pointerInsideSlider(nav, event) {
    var state = getState(nav);
    if (!state.width || !state.height) {
      return false;
    }
    var x = localPointerX(nav, event);
    var y = localPointerY(nav, event);
    return x >= state.x && x <= state.x + state.width && y >= state.y && y <= state.y + state.height;
  }

  function eventLink(nav, event) {
    var link = event && event.target && event.target.closest ? event.target.closest(LINK_SELECTOR) : null;
    return link && nav.contains(link) ? link : null;
  }

  function releaseCapture(nav, pointerId) {
    try {
      nav.releasePointerCapture(pointerId);
    } catch (_error) {
      /* Pointer capture may already be released. */
    }
  }

  function suppressNextTrustedClick(nav) {
    var state = getState(nav);
    state.suppressTrustedClick = true;
    window.clearTimeout(state.suppressClickTimer);
    state.suppressClickTimer = window.setTimeout(function () {
      state.suppressTrustedClick = false;
    }, CLICK_SUPPRESS_MS);
  }

  function resetPointerState(nav, event) {
    var state = getState(nav);
    if (event && state.pointerId != null) {
      releaseCapture(nav, state.pointerId);
    }
    state.isPointerDown = false;
    state.dragStarted = false;
    state.pointerId = null;
    clearDragOver(nav);
  }

  function navigateWithLink(link) {
    if (!link) {
      return;
    }
    var before = normalizePath(window.location.pathname);
    var targetPath = routeForLink(link);
    link.click();
    window.setTimeout(function () {
      if (normalizePath(window.location.pathname) !== targetPath && targetPath !== before) {
        var href = link.getAttribute("href") || targetPath;
        window.history.pushState({}, "", href);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }, 160);
  }

  function handlePointerDown(nav, event) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    var state = getState(nav);
    var active = state.activeLink || activeLinkForPath(nav);
    if (!active || !state.hasGeometry) {
      syncToPath(nav, { force: true, immediate: true });
      active = state.activeLink || activeLinkForPath(nav);
    }

    var link = eventLink(nav, event);
    if (link !== active && !pointerInsideSlider(nav, event)) {
      return;
    }

    state.isPointerDown = true;
    state.dragStarted = false;
    state.pointerId = event.pointerId;
    state.pointerStartX = event.clientX;
    state.pointerStartY = event.clientY;
    state.currentCenterX = state.centerX;
    clearDragOver(nav);
    setPhase(nav, "pressing");
    try {
      nav.setPointerCapture(event.pointerId);
    } catch (_error) {
      /* Pointer capture is progressive enhancement here. */
    }
  }

  function handlePointerMove(nav, event) {
    var state = getState(nav);
    if (!state.isPointerDown || state.pointerId !== event.pointerId) {
      return;
    }

    var dx = event.clientX - state.pointerStartX;
    var dy = event.clientY - state.pointerStartY;

    if (!state.dragStarted) {
      if (Math.abs(dy) > DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.2) {
        resetPointerState(nav, event);
        setPhase(nav, "idle");
        syncToPath(nav, { force: true });
        return;
      }
      if (Math.abs(dx) < DRAG_THRESHOLD) {
        return;
      }
      state.dragStarted = true;
      setPhase(nav, "dragging");
    }

    var bounds = dragCenterBounds(nav);
    var centerX = clamp(localPointerX(nav, event), bounds.min, bounds.max);
    var nearest = nearestLink(nav, centerX);
    if (!nearest) {
      return;
    }

    state.currentCenterX = centerX;
    setDragOver(nav, nearest);
    queueGeometry(nav, geometryForLink(nav, nearest, centerX));
    event.preventDefault();
  }

  function handlePointerUp(nav, event) {
    var state = getState(nav);
    if (!state.isPointerDown || state.pointerId !== event.pointerId) {
      return;
    }

    var didDrag = state.dragStarted;
    var target = didDrag ? nearestLink(nav, state.currentCenterX) : null;
    resetPointerState(nav, event);

    if (!didDrag) {
      setPhase(nav, "idle");
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressNextTrustedClick(nav);

    if (!target) {
      setPhase(nav, "idle");
      syncToPath(nav, { force: true });
      return;
    }

    var targetPath = routeForLink(target);
    var currentPath = normalizePath(window.location.pathname);
    setPhase(nav, "snapping");
    applyGeometry(nav, geometryForLink(nav, target), false);

    if (targetPath === currentPath) {
      window.setTimeout(function () {
        syncToPath(nav, { force: true, bounce: true, bounceDelay: 0 });
      }, MOVE_MS);
      return;
    }

    state.pendingRoute = targetPath;
    window.setTimeout(function () {
      if (document.body.contains(target)) {
        navigateWithLink(target);
      }
    }, 24);
    window.setTimeout(scheduleLiquidNavUpdate, MOVE_MS + 80);
  }

  function handlePointerCancel(nav, event) {
    var state = getState(nav);
    if (!state.isPointerDown) {
      return;
    }
    if (event && event.pointerId != null && state.pointerId !== event.pointerId) {
      return;
    }
    resetPointerState(nav, event);
    setPhase(nav, "idle");
    syncToPath(nav, { force: true });
  }

  function handleClick(nav, event) {
    var link = eventLink(nav, event);
    if (!link) {
      return;
    }

    var state = getState(nav);
    if (state.suppressTrustedClick && event.isTrusted) {
      state.suppressTrustedClick = false;
      window.clearTimeout(state.suppressClickTimer);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    var targetPath = routeForLink(link);
    var currentPath = normalizePath(window.location.pathname);
    if (targetPath === currentPath) {
      event.preventDefault();
      event.stopPropagation();
      playBounce(nav, link);
      return;
    }

    state.pendingRoute = targetPath;
    window.setTimeout(scheduleLiquidNavUpdate, 0);
    window.setTimeout(scheduleLiquidNavUpdate, 80);
    window.setTimeout(scheduleLiquidNavUpdate, MOVE_MS + 80);
  }

  function initLiquidNav() {
    document.querySelectorAll(NAV_SELECTOR).forEach(function (nav) {
      ensureSlider(nav);
      if (nav.dataset.liquidNavReady === "true") {
        syncToPath(nav);
        return;
      }
      nav.dataset.liquidNavReady = "true";

      nav.addEventListener(
        "click",
        function (event) {
          handleClick(nav, event);
        },
        true
      );
      nav.addEventListener("dragstart", function (event) {
        event.preventDefault();
      });
      nav.addEventListener("pointerdown", function (event) {
        handlePointerDown(nav, event);
      });
      nav.addEventListener("pointermove", function (event) {
        handlePointerMove(nav, event);
      });
      nav.addEventListener("pointerup", function (event) {
        handlePointerUp(nav, event);
      });
      nav.addEventListener("pointercancel", function (event) {
        handlePointerCancel(nav, event);
      });
      var state = getState(nav);
      if (!state.windowListenersReady) {
        state.windowListenersReady = true;
        window.addEventListener(
          "pointermove",
          function (event) {
            var activeState = getState(nav);
            if (activeState.isPointerDown) {
              handlePointerMove(nav, event);
            }
          },
          true
        );
        window.addEventListener(
          "pointerup",
          function (event) {
            var activeState = getState(nav);
            if (activeState.isPointerDown) {
              handlePointerUp(nav, event);
            }
          },
          true
        );
        window.addEventListener(
          "pointercancel",
          function (event) {
            var activeState = getState(nav);
            if (activeState.isPointerDown) {
              handlePointerCancel(nav, event);
            }
          },
          true
        );
        window.addEventListener("blur", function () {
          var activeState = getState(nav);
          if (activeState.isPointerDown) {
            handlePointerCancel(nav, null);
          }
        });
      }
      nav.addEventListener("scroll", function () {
        var activeState = getState(nav);
        if (!activeState.isPointerDown) {
          syncToPath(nav, { force: true });
        }
      });

      if ("ResizeObserver" in window) {
        var observer = new ResizeObserver(function () {
          var state = getState(nav);
          if (!state.isPointerDown) {
            syncToPath(nav, { force: true });
          }
        });
        observer.observe(nav);
        navLinks(nav).forEach(function (link) {
          observer.observe(link);
        });
        getState(nav).resizeObserver = observer;
      }

      syncToPath(nav, { immediate: true });
    });
  }

  function scheduleLiquidNavUpdate() {
    if (scheduled) {
      return;
    }
    scheduled = window.requestAnimationFrame(function () {
      scheduled = 0;
      initLiquidNav();
    });
  }

  function retryLiquidNavStartup(attempt) {
    initLiquidNav();
    if (document.querySelector(NAV_SELECTOR + "[data-liquid-nav-ready='true']") || attempt >= 100) {
      return;
    }
    startupTimer = window.setTimeout(function () {
      retryLiquidNavStartup(attempt + 1);
    }, 200);
  }

  function updateTopNavScrollState() {
    var shell = document.getElementById("top-nav-shell");
    if (!shell) {
      return;
    }
    var scrolled = window.scrollY > 8;
    shell.classList.toggle("is-scrolled", scrolled);
    shell.classList.toggle("nav-scrolled", scrolled);
  }

  function observeLiquidNavMounts() {
    if (!document.body || document.body.dataset.liquidNavObserverReady === "true") {
      return;
    }
    document.body.dataset.liquidNavObserverReady = "true";
    new MutationObserver(scheduleLiquidNavUpdate).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function patchHistoryForNavUpdates() {
    if (window.__windcastLiquidNavHistoryPatched) {
      return;
    }
    window.__windcastLiquidNavHistoryPatched = true;
    ["pushState", "replaceState"].forEach(function (method) {
      var original = history[method];
      history[method] = function () {
        var result = original.apply(this, arguments);
        scheduleLiquidNavUpdate();
        return result;
      };
    });
  }

  window.addEventListener("DOMContentLoaded", function () {
    observeLiquidNavMounts();
    updateTopNavScrollState();
    scheduleLiquidNavUpdate();
  });
  window.addEventListener("load", scheduleLiquidNavUpdate);
  window.addEventListener("resize", scheduleLiquidNavUpdate);
  window.addEventListener("scroll", updateTopNavScrollState, { passive: true });
  window.addEventListener("popstate", scheduleLiquidNavUpdate);
  window.addEventListener("hashchange", scheduleLiquidNavUpdate);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleLiquidNavUpdate).catch(function () {});
  }

  patchHistoryForNavUpdates();
  observeLiquidNavMounts();
  updateTopNavScrollState();
  retryLiquidNavStartup(0);
  scheduleLiquidNavUpdate();

  window.addEventListener("beforeunload", function () {
    window.clearTimeout(startupTimer);
  });
})();
