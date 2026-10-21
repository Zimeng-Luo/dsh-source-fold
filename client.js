// Copyright (c) 2026 Zimeng-Luo. MIT License.
export const name = "dsh-source-fold";
const STORAGE = "dsh-source-fold:v1";
const INSTANCE = Symbol.for("dsh-source-fold.instance");

function readSavedState(raw) {
  try {
    const value = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return new Map();
    return new Map(value.filter(item =>
      Array.isArray(item) && item.length === 2
      && typeof item[0] === "string" && typeof item[1] === "boolean"
    ));
  } catch {
    return new Map();
  }
}

function mount() {
  window[INSTANCE]?.();
  let saved = new Map();
  try { saved = readSavedState(localStorage.getItem(STORAGE)); } catch {}

  const headings = new Map();
  const rows = new Set();
  const keyboardOpen = new Set();
  let frame = 0;
  let disposed = false;
  const style = document.createElement("style");
  style.textContent = `
[data-dsf-heading] { cursor: pointer; user-select: none; }
[data-dsf-heading]::before { content: "▸"; display: inline-block; width: 16px; }
[data-dsf-heading][aria-expanded="true"]::before { content: "▾"; }
[data-dsf-heading]::after {
  content: " (" attr(data-dsf-count) ")";
  opacity: .6;
  font-weight: normal;
}
[data-dsf-heading]:focus-visible {
  outline: 2px solid currentColor; outline-offset: -2px;
}
[data-dsf-hidden] { display: none !important; }
`;
  document.head.append(style);

  function restore(heading, original) {
    for (const [key, value] of original) {
      if (value === null) heading.removeAttribute(key);
      else heading.setAttribute(key, value);
    }
    heading.removeAttribute("data-dsf-heading");
    heading.removeAttribute("data-dsf-count");
  }

  function surfaceFor(node) {
    for (const trigger of document.querySelectorAll(
      '[aria-haspopup="menu"][aria-controls]'
    )) {
      const surface = document.getElementById(
        trigger.getAttribute("aria-controls")
      );
      if (surface && (surface.contains(node) || trigger === node)) {
        return surface;
      }
    }
    return null;
  }

  function searchFor(surface) {
    return surface.querySelector(
      'input[role="searchbox"], input[type="search"]'
    );
  }

  function scan() {
    frame = 0;
    if (disposed) return;
    const activeHeadings = new Set();
    const activeRows = new Set();

    for (const surface of keyboardOpen) {
      if (!surface.isConnected) keyboardOpen.delete(surface);
    }

    for (const group of document.querySelectorAll(
      'section[role="group"][aria-labelledby]'
    )) {
      const items = [...group.querySelectorAll(
        'button[role="menuitemradio"]'
      )].filter(item => item.closest('section[role="group"]') === group);
      if (!items.length) continue;

      const providers = items.map(item =>
        item.querySelector("[data-provider-id]")
          ?.getAttribute("data-provider-id")
      );
      const provider = providers[0];
      if (!provider || providers.some(id => id !== provider)) continue;

      const surface = surfaceFor(group);
      const heading = document.getElementById(
        group.getAttribute("aria-labelledby")
      );
      if (!surface || !heading || !group.contains(heading)) continue;

      activeHeadings.add(heading);
      if (!headings.has(heading)) {
        headings.set(heading, new Map(
          ["role", "tabindex", "aria-expanded"].map(key => [
            key, heading.getAttribute(key)
          ])
        ));
      }

      const searching = Boolean(searchFor(surface)?.value.trim());
      const current = items.some(
        item => item.getAttribute("aria-checked") === "true"
      );
      const collapsed = saved.has(provider) ? saved.get(provider) : !current;
      const expanded = searching || keyboardOpen.has(surface) || !collapsed;

      heading.setAttribute("data-dsf-heading", provider);
      heading.setAttribute("data-dsf-count", String(items.length));
      heading.setAttribute("role", "button");
      heading.setAttribute("tabindex", "0");
      heading.setAttribute("aria-expanded", String(expanded));

      for (const item of items) {
        activeRows.add(item);
        rows.add(item);
        item.toggleAttribute("data-dsf-hidden", !expanded);
      }
    }

    for (const [heading, original] of headings) {
      if (!activeHeadings.has(heading)) {
        restore(heading, original);
        headings.delete(heading);
      }
    }
    for (const row of rows) {
      if (!activeRows.has(row)) {
        row.removeAttribute("data-dsf-hidden");
        rows.delete(row);
      }
    }
  }

  function schedule() {
    if (!disposed && !frame) frame = requestAnimationFrame(scan);
  }

  function headingOf(target) {
    return target instanceof Element
      ? target.closest("[data-dsf-heading]")
      : null;
  }

  function toggle(heading) {
    const surface = surfaceFor(heading);
    if (!surface || searchFor(surface)?.value.trim()) return;

    keyboardOpen.delete(surface);
    const provider = heading.getAttribute("data-dsf-heading");
    saved.set(provider, heading.getAttribute("aria-expanded") === "true");
    try {
      localStorage.setItem(STORAGE, JSON.stringify([...saved]));
    } catch {}

    // Keep focus within the menu before hiding any focused model row.
    heading.focus({ preventScroll: true });
    scan();
  }

  function onMouseDown(event) {
    if (headingOf(event.target)) event.preventDefault();
  }

  function onClick(event) {
    const heading = headingOf(event.target);
    if (heading) {
      event.preventDefault();
      event.stopPropagation();
      toggle(heading);
    } else {
      schedule();
    }
  }

  function onKeyDown(event) {
    if (event.isComposing) return;
    const heading = headingOf(event.target);
    if (heading && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      toggle(heading);
      return;
    }
    if (!["ArrowUp", "ArrowDown", "Enter", "Tab"].includes(event.key)) return;

    // Native navigation uses the entire catalog. Reveal its rows before
    // forwarding keys, without changing the user's saved preferences.
    if (event.target instanceof Element) {
      const surface = surfaceFor(event.target);
      if (surface) {
        keyboardOpen.add(surface);
        scan();
      }
    }
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-checked", "aria-busy", "data-provider-id"]
  });
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("input", schedule, true);
  scan();

  function dispose() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    cancelAnimationFrame(frame);
    document.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("input", schedule, true);
    for (const [heading, original] of headings) restore(heading, original);
    for (const row of rows) row.removeAttribute("data-dsf-hidden");
    style.remove();
    if (window[INSTANCE] === dispose) delete window[INSTANCE];
  }
  window[INSTANCE] = dispose;
  return dispose;
}

export function apply(ctx) {
  ctx.effect(() => mount(), "dsh-source-fold");
}
