function createIsland(React, ReactDOM) {
  const { createElement: h, useState, useRef, useEffect, useLayoutEffect, useSyncExternalStore, useId } = React;
  const pinnedSourcesStore = createPinnedSourcesStore();
  function Icon({ kind, size = 18, className = "" }) {
    const paths = {
      chevron: "m9 5 7 7-7 7",
      back: "m15 5-7 7 7 7",
      check: "m5 12 4 4L19 6",
      models: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
      search: "m20 20-4.5-4.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
      close: "m6 6 12 12M18 6 6 18",
      pin: "M8 3h8l-1 5 3 3v2H6v-2l3-3-1-5ZM12 13v8"
    };
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
      stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round",
      "aria-hidden": true, className, style: { "--dsf-icon-size": size + "px" } }, h("path", { d: paths[kind] || paths.models }));
  }
  function ModelIsland({ controller, locked, sessionKey }) {
    const state = useSyncExternalStore(
      listener => controller.store.subscribe(listener),
      () => controller.store.getSnapshot()
    );
    const pins = useSyncExternalStore(pinnedSourcesStore.subscribe, pinnedSourcesStore.getSnapshot);
    const [stage, setStage] = useState("closed");
    const [page, setPage] = useState(0);
    const [sourceId, setSourceId] = useState(null);
    const [sourceQuery, setSourceQuery] = useState("");
    const [modelQuery, setModelQuery] = useState("");
    const [localError, setLocalError] = useState("");
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState(null);
    const [preference, setPreference] = useState(null);
    const [position, setPosition] = useState(null);
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    const draftRef = useRef(null);
    const sendingRef = useRef(false);
    const aliveRef = useRef(true);
    const restoreRef = useRef(false);
    const previousPageRef = useRef(0);
    const id = useId();
    const present = stage !== "closed";
    const found = currentModel(state);
    const choices = effortChoices(found?.model);
    const adjustable = choices.length > 1;
    const currentKey = routeKey(state.current);
    const confirmedIndex = effortIndex(found?.model, state.current, preference);
    const sliderIndex = draft?.key === currentKey ? draft.index : confirmedIndex;
    const activeChoice = choices[sliderIndex] || choices[0];
    const modelName = found?.model.name || (state.status === "loading" ? "加载模型…" : "选择模型");
    const busy = Boolean(locked || saving || state.pending);
    const error = localError || state.error;
    const groups = state.groups || [];
    const source = groups.find(group => group.id === sourceId);
    const sources = pinnedSourcesFirst(groups.filter(group =>
      matchesQuery(sourceQuery, [group.name, group.id, ...group.models.map(model => model.name)])
    ), pins.ids);
    const models = (source?.models || []).filter(model =>
      matchesQuery(modelQuery, [model.name, model.id])
    );
    const failures = state.failures || [];

    const load = () => {
      setLocalError("");
      Promise.resolve().then(() => controller.load()).catch(reason => {
        if (aliveRef.current) setLocalError(reason?.message || String(reason));
      });
    };
    const close = (restoreFocus = false) => {
      if (!present) return;
      restoreRef.current = restoreFocus;
      setStage("closing");
      draftRef.current = null;
      setDraft(null);
    };
    const navigate = next => {
      if (next === 1 && page === 0) setSourceQuery("");
      if (next === 2) setModelQuery("");
      setPage(next);
    };
    const back = () => {
      if (page === 2) navigate(1);
      else if (page === 1) navigate(0);
      else close(true);
    };
    const open = () => {
      if (stage !== "closed" && stage !== "closing") { close(true); return; }
      setPage(0);
      setSourceId(null);
      setSourceQuery("");
      setModelQuery("");
      setLocalError("");
      setStage("opening");
      load();
    };

    useEffect(() => {
      aliveRef.current = true;
      load();
      return () => { aliveRef.current = false; };
    }, [controller]);

    useEffect(() => {
      if (stage === "opening") {
        const frame = requestAnimationFrame(() => setStage("open"));
        return () => cancelAnimationFrame(frame);
      }
      if (stage === "closing") {
        const timer = setTimeout(() => {
          setStage("closed");
          setPosition(null);
          if (restoreRef.current) triggerRef.current?.focus({ preventScroll: true });
        }, 240);
        return () => clearTimeout(timer);
      }
    }, [stage]);

    useEffect(() => {
      draftRef.current = null;
      setDraft(null);
      setLocalError("");
    }, [currentKey]);

    useEffect(() => {
      if (page === 2 && !source && state.status !== "loading") setPage(1);
    }, [page, source, state.status]);

    useEffect(() => {
      if (locked && present) close(false);
    }, [locked]);

    useEffect(() => {
      if (!present) return;
      const outside = event => {
        if (!rootRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) close(false);
      };
      document.addEventListener("pointerdown", outside, true);
      return () => document.removeEventListener("pointerdown", outside, true);
    }, [present]);

    const count = page === 1 ? sources.length : models.length;
    useLayoutEffect(() => {
      if (!present) return;
      const place = () => {
        const anchor = triggerRef.current?.getBoundingClientRect();
        if (!anchor) return;
        const visible = window.visualViewport;
        const composer = rootRef.current?.closest("[data-composer-card]");
        const fontSize = parseFloat(window.getComputedStyle(triggerRef.current).fontSize) || 13;
        const next = panelMetrics(page, count, adjustable, anchor, {
          width: visible?.width || window.innerWidth,
          height: visible?.height || window.innerHeight,
          left: visible?.offsetLeft || 0, top: visible?.offsetTop || 0,
          layoutHeight: window.innerHeight,
          composerWidth: composer?.getBoundingClientRect().width,
          uiScale: fontSize / 13
        }, (error ? 1 : 0) + (page === 1 ? failures.length + (pins.persisted ? 0 : 1) : 0));
        setPosition(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      };
      place();
      window.addEventListener("resize", place);
      window.addEventListener("scroll", place, true);
      const visible = window.visualViewport;
      visible?.addEventListener("resize", place);
      visible?.addEventListener("scroll", place);
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
      if (triggerRef.current) observer?.observe(triggerRef.current);
      const composer = rootRef.current?.closest("[data-composer-card]");
      if (composer) observer?.observe(composer);
      return () => {
        observer?.disconnect();
        window.removeEventListener("resize", place);
        window.removeEventListener("scroll", place, true);
        visible?.removeEventListener("resize", place);
        visible?.removeEventListener("scroll", place);
      };
    }, [present, page, count, adjustable, error, failures.length, pins.persisted]);

    useLayoutEffect(() => {
      if (stage !== "open") return;
      const activePage = panelRef.current?.querySelector('[data-page="' + page + '"]');
      const backwards = page < previousPageRef.current;
      previousPageRef.current = page;
      const rows = activePage?.querySelectorAll("[data-source-id]");
      const returnSource = backwards && page === 1
        ? [...(rows || [])].find(row => row.getAttribute("data-source-id") === sourceId)
        : null;
      const target = returnSource || activePage?.querySelector(page === 0 ? ".dsf-model-title" : "input");
      target?.focus({ preventScroll: true });
    }, [stage, page]);

    async function submit(selection, nextPreference, onSuccess) {
      if (busy || sendingRef.current) return;
      sendingRef.current = true;
      setSaving(true);
      setLocalError("");
      try {
        const result = await controller.select(selection);
        if (!aliveRef.current) return;
        if (!result || !result.ok) {
          const reason = result?.error;
          throw new Error(reason ? (reason.message || reason.code || String(reason)) : "当前会话无法切换模型");
        }
        setPreference(nextPreference);
        onSuccess?.();
      } catch (reason) {
        if (aliveRef.current) setLocalError(reason?.message || String(reason));
      } finally {
        sendingRef.current = false;
        if (aliveRef.current) {
          setSaving(false);
          draftRef.current = null;
          setDraft(null);
        }
      }
    }

    function chooseModel(group, model) {
      if (!group || busy) return;
      const selection = { provider: group.id, model: model.id };
      if (routeKey(selection) === currentKey) { setPage(0); return; }
      return submit(selection, { key: routeKey(selection), id: null }, () => setPage(0));
    }

    function setSlider(index) {
      const value = { key: currentKey, index: Math.max(0, Math.min(choices.length - 1, index)) };
      draftRef.current = value;
      setDraft(value);
    }

    function commitSlider(explicitIndex) {
      const pending = explicitIndex === undefined ? draftRef.current : { key: currentKey, index: explicitIndex };
      if (!pending || pending.key !== currentKey || !adjustable || busy) return;
      const choice = choices[pending.index];
      if (!choice) return;
      draftRef.current = null;
      if (pending.index === confirmedIndex) { setDraft(null); return; }
      return submit(selectionForEffort(state.current, choice), { key: currentKey, id: choice.id });
    }

    function panelKeys(event) {
      if (event.nativeEvent?.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); back(); return;
      }
      const target = event.target;
      const isInput = target.tagName === "INPUT";
      if (event.key === "ArrowLeft" && !isInput && page > 0) {
        event.preventDefault(); back(); return;
      }
      if (isInput && target.type === "range" && event.key !== "Tab") return;
      const activePage = panelRef.current?.querySelector('[data-page="' + page + '"]');
      if (!activePage) return;
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        const rows = [...activePage.querySelectorAll(".dsf-row:not(:disabled)")];
        if (!rows.length) return;
        event.preventDefault();
        const index = rows.indexOf(document.activeElement);
        const next = index < 0 ? (event.key === "ArrowDown" ? 0 : rows.length - 1)
          : (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
        rows[next].focus();
        return;
      }
      if (event.key === "Tab") {
        const focusable = [...activePage.querySelectorAll("button:not(:disabled), input:not(:disabled)")];
        if (!focusable.length) { event.preventDefault(); panelRef.current?.focus(); return; }
        const at = focusable.indexOf(document.activeElement);
        if (event.shiftKey && at <= 0) { event.preventDefault(); focusable.at(-1).focus(); }
        else if (!event.shiftKey && (at === focusable.length - 1 || at < 0)) {
          event.preventDefault(); focusable[0].focus();
        }
      }
    }

    function pageHeader(title, subtitle) {
      return h("header", { className: "dsf-page-header" },
        h("button", { type: "button", className: "dsf-back", "aria-label": page === 2 ? "返回来源列表" : "返回思考强度", onClick: back },
          h(Icon, { kind: "back", size: 16 })),
        h("div", { className: "dsf-heading-copy" },
          h("div", { className: "dsf-page-title", title }, title),
          h("div", { className: "dsf-subtitle" }, subtitle)),
        h("button", { type: "button", className: "dsf-icon-button", "aria-label": "关闭模型面板", onClick: () => close(true) },
          h(Icon, { kind: "close", size: 15 })));
    }
    function searchBox(value, setValue, placeholder) {
      return h("div", { className: "dsf-search" },
        h(Icon, { kind: "search", size: 15 }),
        h("input", { type: "search", value, placeholder, "aria-label": placeholder,
          onChange: event => setValue(event.target.value) }));
    }
    function notice(text, retry = true) {
      return h("div", { className: "dsf-notice", role: "status" },
        h("span", null, text),
        retry && h("button", { type: "button", disabled: busy, onClick: load }, "重试"));
    }
    const progress = choices.length > 1 ? sliderIndex / (choices.length - 1) : 0;
    const panelStyle = position ? {
      width: position.width, height: position.height, left: position.left,
      "--dsf-unit": position.scale,
      top: position.top ?? "auto", bottom: position.bottom ?? "auto",
      "--dsf-origin": position.side === "above" ? "bottom right" : "top right",
      "--dsf-close-y": position.side === "above" ? "12px" : "-12px"
    } : { width: 240, height: 116, left: 0, top: 0, visibility: "hidden" };

    const controls = h("section", { className: "dsf-page dsf-controls", "data-page": 0,
      "aria-hidden": page !== 0, inert: page === 0 ? undefined : "" },
      h("div", { className: "dsf-control-top" },
        h("div", { className: "dsf-effort-label", "aria-live": "polite" }, adjustable ? activeChoice?.name : "模型")),
      h("button", { type: "button", className: "dsf-model-title", disabled: busy,
        "aria-label": "切换模型，选择来源", onClick: () => navigate(1) },
        h("span", { title: modelName }, modelName), h(Icon, { kind: "chevron", size: 17 })),
      adjustable && h("div", { className: "dsf-slider-area", "data-dragging": Boolean(draft) },
        h("div", { className: "dsf-rail" },
          h("div", { className: "dsf-fill", style: { width: "calc(" + (progress * 100) + "% + " + ((17 - 34 * progress) * (position?.scale || 1)) + "px)" } }),
          h("div", { className: "dsf-track-core" },
            choices.map((choice, index) => h("span", { className: "dsf-tick", key: choice.id ?? "__default",
              "data-past": index <= sliderIndex, style: { left: (100 * index / (choices.length - 1)) + "%" } })),
            h("span", { className: "dsf-thumb", style: { left: (100 * progress) + "%" } })),
          h("input", { className: "dsf-slider-input", type: "range", min: 0, max: choices.length - 1,
            step: 1, value: sliderIndex, disabled: busy, "aria-label": "思考强度",
            "aria-valuetext": activeChoice?.name || "Default",
            onChange: event => setSlider(Number(event.target.value)),
            onPointerUp: () => commitSlider(),
            onKeyUp: event => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) commitSlider();
            },
            onBlur: () => commitSlider(),
            onPointerCancel: () => { draftRef.current = null; setDraft(null); }
          })),
        null),
      error && h("div", { className: "dsf-control-error", role: "alert" }, error));

    const sourcePage = h("section", { className: "dsf-page", "data-page": 1,
      "aria-hidden": page !== 1, inert: page === 1 ? undefined : "" },
      pageHeader("选择来源", groups.length + " 个来源"),
      searchBox(sourceQuery, setSourceQuery, "搜索来源或模型"),
      h("div", { className: "dsf-list", "aria-label": "模型来源" },
        error && notice(error),
        state.status === "loading" && !groups.length && notice("正在加载来源…", false),
        failures.map(failure => h("div", { key: "failure:" + failure.id }, notice(
          (failure.name || failure.id) + "：" + (failure.message || "加载失败")
        ))),
        !pins.persisted && notice("置顶暂未保存到本机，当前窗口内仍可使用；再次点击可重试保存。", false),
        sources.map(group => {
          const current = group.id === state.current?.provider;
          const pinned = pins.ids.includes(group.id);
          const pinLabel = (pinned ? "取消置顶来源：" : "置顶来源：") + group.name;
          return h("div", { key: group.id, className: "dsf-source-item", "data-pinned": pinned },
            h("button", { type: "button", className: "dsf-row dsf-source-row",
              "data-source-id": group.id, "data-selected": current, disabled: busy || !group.models.length,
              onClick: () => { setSourceId(group.id); navigate(2); } },
              h("span", { className: "dsf-source-icon" }, h(Icon, { kind: "models", size: 18 })),
              h("span", { className: "dsf-row-copy" },
                h("span", { className: "dsf-row-title", title: group.name }, group.name),
                h("span", { className: "dsf-subtitle" },
                  current ? "当前 · " + (found?.model.name || "模型暂不可用") : group.models.length + " 个模型")),
              current && h("span", { className: "dsf-current-badge" }, "当前"),
              h(Icon, { kind: "chevron", size: 17 })),
            h("button", { type: "button", className: "dsf-source-pin", title: pinLabel,
              "aria-label": pinLabel, "aria-pressed": pinned, "data-pin-source-id": group.id,
              onClick: () => pinnedSourcesStore.toggle(group.id) },
              h(Icon, { kind: "pin", size: 16 })));
        }),
        !sources.length && state.status !== "loading" && notice(sourceQuery ? "没有匹配的来源" : "暂无可用来源", false)));

    const modelPage = h("section", { className: "dsf-page", "data-page": 2,
      "aria-hidden": page !== 2, inert: page === 2 ? undefined : "" },
      pageHeader(source?.name || "选择模型", (source?.models.length || 0) + " 个模型 · 返回选择其他来源"),
      searchBox(modelQuery, setModelQuery, "搜索该来源的模型"),
      h("div", { className: "dsf-list", "aria-label": "可选模型" },
        error && notice(error),
        models.map(model => {
          const selected = state.current?.provider === sourceId && state.current?.model === model.id;
          return h("button", { key: model.id, type: "button", className: "dsf-row dsf-model-row",
            "data-selected": selected, "aria-pressed": selected, disabled: busy,
            onClick: () => chooseModel(source, model) },
            h("span", { className: "dsf-row-title", title: model.name }, model.name),
            selected && h(Icon, { kind: "check", size: 18 }));
        }),
        !models.length && notice(modelQuery ? "没有匹配的模型" : "此来源暂无可用模型", false)));

    return h("div", { className: "dsf-seat", ref: rootRef },
      h("button", { type: "button", ref: triggerRef, className: "dsf-trigger",
        disabled: Boolean(locked), "aria-haspopup": "dialog", "aria-expanded": present,
        "aria-controls": present ? id + "-island" : undefined,
        "aria-label": modelName + (adjustable ? " · " + (activeChoice?.name || "Default") : "") + "，打开模型与思考强度",
        title: modelName, onClick: open },
        h(Icon, { kind: "models", size: 16 }),
        h("span", { className: "dsf-trigger-caption" }, modelName),
        adjustable && h("span", { className: "dsf-trigger-effort" }, activeChoice?.name),
        saving ? h("span", { className: "dsf-spinner", "aria-label": "正在切换" }) : h(Icon, { kind: "chevron", size: 13 })),
      present && ReactDOM.createPortal(h("div", { id: id + "-island", ref: panelRef,
        role: "dialog", "aria-label": "模型与思考强度", "aria-busy": busy, tabIndex: -1,
        className: "dsf-island", "data-stage": stage, "data-view": page,
        style: panelStyle, onKeyDown: panelKeys },
        h("div", { className: "dsf-pages", style: { transform: "translate3d(-" + (page * 100) + "%,0,0)" } },
          controls, sourcePage, modelPage),
        saving && h("div", { className: "dsf-saving", role: "status" }, h("span", { className: "dsf-spinner" }), "正在应用…")
      ), document.body));
  }
  return function ModelSeat(props) {
    return props.available ? h(ModelIsland, { ...props, key: props.sessionKey }) : null;
  };
}
