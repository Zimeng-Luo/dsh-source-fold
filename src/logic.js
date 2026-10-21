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
  const width = Math.max(1, Math.min(page === 0 ? 320 : 376, viewport.width - 24));
  const wanted = page === 0 ? (adjustable ? 182 : 112) + Math.min(1, noticeCount) * 56
    : 122 + Math.max(1, count) * (page === 1 ? 68 : 58) + Math.min(2, noticeCount) * 52;
  const above = Math.max(0, anchor.top - 24);
  const below = Math.max(0, viewport.height - anchor.bottom - 24);
  const side = above >= Math.min(wanted, 260) || above >= below ? "above" : "below";
  const height = Math.max(1, Math.min(wanted, 540, side === "above" ? above : below));
  const left = Math.max(12, Math.min(anchor.right - width, viewport.width - width - 12));
  return {
    width, height, left, side,
    ...(side === "above" ? { bottom: viewport.height - anchor.top + 10 } : { top: anchor.bottom + 10 })
  };
}
