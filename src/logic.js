function effortChoices(model) {
  const levels = model?.reasoning?.efforts;
  if (!Array.isArray(levels)) return [];
  const seen = new Set();
  const supported = levels.filter(level => {
    if (!level || typeof level.id !== "string" || !level.id || seen.has(level.id)) return false;
    seen.add(level.id);
    return true;
  }).map(level => ({ id: level.id, name: level.name || level.id }));
  return supported.length ? [{ id: null, name: "Default" }, ...supported] : [];
}

function routeKey(selection) {
  return selection ? JSON.stringify([selection.provider, selection.model]) : "";
}

function currentModel(state) {
  const group = (state.groups || []).find(group => group.id === state.current?.provider);
  const model = group?.models.find(model => model.id === state.current?.model);
  return model ? { group, model } : null;
}

function effortIndex(model, current, preference) {
  const choices = effortChoices(model);
  if (!choices.length) return 0;
  const effective = current?.reasoningEffort ?? model.reasoning.defaultEffort;
  if (preference?.key === routeKey(current)) {
    const preferred = preference.id ?? model.reasoning.defaultEffort;
    if (preferred === effective) {
      const index = choices.findIndex(choice => choice.id === preference.id);
      if (index >= 0) return index;
    }
  }
  if (current?.reasoningEffort === undefined) return 0;
  return Math.max(0, choices.findIndex(choice => choice.id === current.reasoningEffort));
}

function selectionForEffort(current, choice) {
  if (!current || !choice) throw new Error("没有可用的模型或思考档位");
  const selection = { provider: current.provider, model: current.model };
  if (choice.id !== null) selection.reasoningEffort = choice.id;
  return selection;
}

function matchesQuery(query, values) {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = values.filter(Boolean).join(" ").toLocaleLowerCase();
  return tokens.every(token => text.includes(token));
}

function panelMetrics(page, count, adjustable, anchor, viewport, noticeCount = 0) {
  const scale = Math.max(.85, Math.min(1.15, Number(viewport.uiScale) || 1));
  const margin = Math.min(12, Math.max(0, viewport.width / 8));
  const originLeft = Number(viewport.left) || 0;
  const originTop = Number(viewport.top) || 0;
  const availableWidth = Math.max(1, viewport.width - 2 * margin);
  const preferredWidth = (page === 0 ? 240 : 304) * scale;
  const composerLimit = viewport.composerWidth > 0
    ? Math.max((page === 0 ? 208 : 248) * scale, viewport.composerWidth * (page === 0 ? .48 : .70))
    : preferredWidth;
  const width = Math.min(preferredWidth, composerLimit, availableWidth);
  const wanted = (page === 0
    ? (adjustable ? 116 : 86) + Math.min(1, noticeCount) * 44
    : 100 + Math.max(1, count) * (page === 1 ? 60 : 48) + Math.min(2, noticeCount) * 44) * scale;
  const gap = 8 * scale;
  const bottomEdge = originTop + viewport.height;
  const anchorTop = Math.max(originTop + margin + gap, Math.min(anchor.top, bottomEdge - margin - gap));
  const anchorBottom = Math.max(originTop + margin + gap, Math.min(anchor.bottom, bottomEdge - margin - gap));
  const above = Math.max(0, anchorTop - originTop - margin - gap);
  const below = Math.max(0, bottomEdge - anchorBottom - margin - gap);
  const side = above >= Math.min(wanted, 210 * scale) || above >= below ? "above" : "below";
  const heightLimit = page === 0 ? 230 * scale : Math.min(420 * scale, viewport.height * .62);
  const height = Math.max(1, Math.min(wanted, heightLimit, side === "above" ? above : below));
  const left = Math.max(originLeft + margin, Math.min(anchor.right - width, originLeft + viewport.width - width - margin));
  return {
    width, height, left, side, scale,
    ...(side === "above"
      ? { bottom: (viewport.layoutHeight || viewport.height) - anchorTop + gap }
      : { top: anchorBottom + gap })
  };
}

const PINNED_SOURCES_KEY = "dsh-source-fold:pinned-sources:v1";

function normalizePinnedSources(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter(id => typeof id === "string" && id.length > 0))]
    : [];
}

function pinnedSourcesFirst(groups, ids) {
  const pinned = new Set(ids);
  return [...groups.filter(group => pinned.has(group.id)), ...groups.filter(group => !pinned.has(group.id))];
}

function createPinnedSourcesStore() {
  function read() {
    try {
      const raw = window.localStorage.getItem(PINNED_SOURCES_KEY);
      try { return normalizePinnedSources(raw === null ? [] : JSON.parse(raw)); }
      catch { return []; }
    } catch { return null; }
  }
  let snapshot = { ids: read() || [], persisted: true };
  const listeners = new Set();
  const emit = () => { for (const listener of listeners) listener(); };
  function refresh(event) {
    if (event.key !== null && event.key !== PINNED_SOURCES_KEY) return;
    const ids = read();
    if (ids === null || (snapshot.persisted && JSON.stringify(ids) === JSON.stringify(snapshot.ids))) return;
    snapshot = { ids, persisted: true };
    emit();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (!listeners.size) {
        window.addEventListener("storage", refresh);
        refresh({ key: PINNED_SOURCES_KEY });
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) window.removeEventListener("storage", refresh);
      };
    },
    toggle(id) {
      if (typeof id !== "string" || !id) return;
      const previous = snapshot.persisted ? (read() || snapshot.ids) : snapshot.ids;
      const ids = previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id];
      let persisted = false;
      try {
        window.localStorage.setItem(PINNED_SOURCES_KEY, JSON.stringify(ids));
        persisted = true;
      } catch {}
      snapshot = { ids, persisted };
      emit();
    }
  };
}
