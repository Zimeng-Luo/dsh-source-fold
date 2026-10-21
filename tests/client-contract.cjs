function verifyClient(code, logic, evaluate, testCase) {
  function check(ok, message) { if (!ok) throw new Error(message); }
  function equal(actual, expected, message) {
    check(JSON.stringify(actual) === JSON.stringify(expected),
      message + ": " + JSON.stringify(actual) + " != " + JSON.stringify(expected));
  }
  function makeFixture({ headReady = true } = {}) {
    const hooks = [];
    let cursor = 0;
    const styles = new Set();
    const listeners = new Map();
    const registrations = [];
    const entries = [{ options: { priority: 0 } }, { options: { priority: -2000 } }];
    const slotRows = [];
    const cleanups = [];
    const selections = [];
    const snapshot = {
      current: { provider: "a", model: "reasoning", reasoningEffort: "high" },
      pending: null, status: "ready", error: null, failures: [],
      groups: [
        { id: "a", name: "来源 A", models: [
          { id: "reasoning", name: "推理模型", reasoning: {
            defaultEffort: "high", efforts: [
              { id: "low", name: "低" }, { id: "high", name: "高" }
            ]
          } },
          { id: "plain", name: "普通模型" }
        ] },
        { id: "b", name: "来源 B", models: [
          { id: "other", name: "另一个模型", reasoning: {
            defaultEffort: "medium", efforts: [
              { id: "medium", name: "中" }, { id: "max", name: "最大" }
            ]
          } }
        ] }
      ]
    };
    let reject = false;
    const controller = {
      store: { getSnapshot: () => snapshot, subscribe: () => () => {} },
      load: async () => snapshot,
      select: async selection => {
        selections.push(selection);
        if (reject) return { ok: false, error: { code: "test", message: "模型切换失败" } };
        const group = snapshot.groups.find(group => group.id === selection.provider);
        const model = group.models.find(model => model.id === selection.model);
        snapshot.current = { ...selection };
        if (model.reasoning && selection.reasoningEffort === undefined) {
          snapshot.current.reasoningEffort = model.reasoning.defaultEffort;
        }
        return { ok: true };
      }
    };
    const React = {
      createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
      useState(initial) {
        const index = cursor++;
        if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
        return [hooks[index], value => {
          hooks[index] = typeof value === "function" ? value(hooks[index]) : value;
        }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in hooks)) hooks[index] = { current: initial };
        return hooks[index];
      },
      useEffect() {}, useLayoutEffect() {},
      useId() { return "test-island"; },
      useSyncExternalStore(subscribe, getSnapshot) { return getSnapshot(); }
    };
    const ReactDOM = { createPortal: node => node };
    const doc = {
      body: {},
      head: headReady ? { append(node) { styles.add(node); } } : null,
      createElement() { return { dataset: {}, textContent: "", remove() { styles.delete(this); } }; },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); }
    };
    const globals = {
      window: { innerWidth: 1000, innerHeight: 800, __ModuleLoader__: { load: row => registrations.push(row) } },
      document: doc
    };
    const ctx = {
      effect(fn) { const cleanup = fn(); cleanups.push(cleanup); return cleanup; },
      sessions: { subagentAddress: id => id === "subagent" ? {} : undefined },
      modelDirectories: { directoryFor: id => { check(id === "session", "wrong session directory"); return controller; } },
      slots: {
        entries: () => entries,
        inject(name, fn) { check(name === "conversation.input.model", "wrong slot injection"); cleanups.push(fn()); },
        register(options, component) {
          const row = { options, component }; slotRows.push(row);
          return () => slotRows.splice(slotRows.indexOf(row), 1);
        }
      }
    };
    function load(source = code) {
      evaluate(source, globals);
      return registrations.at(-1).factory(specifier => {
        if (specifier === "react") return React;
        if (specifier === "react-dom") return ReactDOM;
        throw new Error("unexpected external: " + specifier);
      });
    }
    function setup() {
      const plugin = load();
      plugin.apply(ctx);
      const row = slotRows[0];
      const props = { ...row.options.inject("session"), locked: false };
      const island = row.component(props);
      return {
        render() { cursor = 0; return island.type(island.props); },
        props, row
      };
    }
    return {
      styles, listeners, registrations, slotRows, cleanups, snapshot, selections, ctx, load, setup, globals, controller,
      reject(value) { reject = value; },
      dispose() { for (const cleanup of cleanups.reverse()) cleanup?.(); }
    };
  }
  function all(node, predicate) {
    const result = [];
    function visit(value) {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (predicate(value)) result.push(value);
      visit(value.props?.children);
    }
    visit(node);
    return result;
  }
  function one(node, predicate, message = "element not found") {
    const value = all(node, predicate)[0];
    check(value, message); return value;
  }
  const attr = (name, value) => node => node.props?.[name] === value;
  const cls = name => node => node.props?.className?.split(" ").includes(name);
  function open(fixture) {
    const app = fixture.setup();
    one(app.render(), cls("dsf-trigger")).props.onClick();
    return app;
  }
  function helpers() {
    const window = {};
    evaluate(logic + "\nwindow.helpers = { effortChoices, routeKey, currentModel, effortIndex, selectionForEffort, matchesQuery, panelMetrics };", { window });
    return window.helpers;
  }

  testCase("classic-script module registration and concatenated loading", () => {
    const f = makeFixture();
    const plugin = f.load(code + "\n" + code);
    equal(f.registrations.map(row => row.id), ["dsh-source-fold", "dsh-source-fold"], "module ids");
    check(typeof plugin.apply === "function", "missing plugin apply");
    equal(plugin.inject, ["slots", "modelDirectories", "sessions"], "required services");
    check(f.styles.size === 0 && f.slotRows.length === 0, "factory must not mount");
  });
  testCase("slot replacement uses the shared directory, skips subagents, and disposes", () => {
    const f = makeFixture();
    const app = f.setup();
    check(app.row.options.priority < -2000, "must shadow existing model controls at a unique priority");
    check(app.props.controller === f.controller, "must reuse the shared directory");
    const unavailable = app.row.options.inject("subagent");
    check(app.row.component(unavailable) === null, "subagent model seat must stay hidden");
    check(f.styles.size === 1 && f.slotRows.length === 1, "mount failed");
    f.dispose();
    check(f.styles.size === 0 && f.slotRows.length === 0, "disposal leaked style or slot");
  });
  testCase("style installation can be cancelled before DOM readiness", () => {
    const f = makeFixture({ headReady: false });
    f.load().apply(f.ctx);
    check(f.listeners.get("DOMContentLoaded")?.size === 1, "missing readiness listener");
    f.dispose();
    check(f.listeners.get("DOMContentLoaded")?.size === 0, "readiness listener leaked");
  });
  testCase("effort stops follow catalog metadata, deduplicate, and hide unsupported sliders", () => {
    const h = helpers();
    equal(h.effortChoices({}), [], "plain model");
    equal(h.effortChoices({ reasoning: { efforts: [] } }), [], "empty effort metadata");
    equal(h.effortChoices({ reasoning: { efforts: [
      { id: "medium", name: "中" }, { id: "medium", name: "重复" }, { id: "max", name: "最大" }
    ] } }), [{ id: null, name: "Default" }, { id: "medium", name: "中" }, { id: "max", name: "最大" }], "catalog-owned levels");
  });
  testCase("Default removes a stale explicit effort instead of sending a fabricated default id", () => {
    const h = helpers();
    const current = { provider: "source/one", model: "model/two", reasoningEffort: "high" };
    equal(h.selectionForEffort(current, { id: null }), { provider: "source/one", model: "model/two" }, "default selection");
    equal(h.selectionForEffort(current, { id: "low" }), { provider: "source/one", model: "model/two", reasoningEffort: "low" }, "explicit selection");
    check(h.routeKey({ provider: "a/b", model: "c" }) !== h.routeKey({ provider: "a", model: "b/c" }), "opaque route ids must not collide");
  });
  testCase("Default stays at the first stop when the host canonicalizes it to high", () => {
    const f = makeFixture();
    const h = helpers();
    const model = f.snapshot.groups[0].models[0];
    const current = f.snapshot.current;
    check(h.effortIndex(model, current, null) === 2, "explicit high index");
    check(h.effortIndex(model, current, { key: h.routeKey(current), id: null }) === 0, "default index after canonicalization");
    check(h.effortIndex(model, current, { key: "other route", id: null }) === 2, "preference must not leak across models");
  });
  testCase("panel placement keeps both long lists and control cards within the viewport", () => {
    const h = helpers();
    for (const anchor of [{ top: 700, bottom: 732, right: 980 }, { top: 10, bottom: 42, right: 70 }]) {
      const layout = h.panelMetrics(1, 200, true, anchor, { width: 1000, height: 800 });
      check(layout.left >= 12 && layout.left + layout.width <= 988, "panel exceeds horizontal bounds");
      check(layout.height <= 540, "long list must scroll");
      if (layout.side === "above") check(800 - layout.bottom - layout.height >= 12, "panel exceeds top");
      else check(layout.top + layout.height <= 788, "panel exceeds bottom");
    }
    const small = h.panelMetrics(0, 0, false, { top: 400, bottom: 430, right: 200 }, { width: 280, height: 600 });
    check(small.width === 256 && small.height === 112, "unsupported model compact card sizing");
  });
  testCase("source selection slides to its models and Back returns to sources", () => {
    const f = makeFixture();
    const app = open(f);
    one(app.render(), attr("aria-label", "切换模型，选择来源")).props.onClick();
    let tree = app.render();
    check(one(tree, cls("dsf-island")).props["data-view"] === 1, "not on sources page");
    one(tree, attr("data-source-id", "b")).props.onClick();
    tree = app.render();
    check(one(tree, cls("dsf-island")).props["data-view"] === 2, "not on models page");
    const page = one(tree, attr("data-page", 2));
    check(all(page, cls("dsf-model-row")).length === 1, "must show only the selected source");
    one(page, attr("aria-label", "返回来源列表")).props.onClick();
    check(one(app.render(), cls("dsf-island")).props["data-view"] === 1, "Back failed");
    check(f.selections.length === 0, "navigating sources must not switch models");
  });
  testCase("model selection uses the exact provider route and returns to controls", async () => {
    const f = makeFixture();
    const app = open(f);
    one(app.render(), attr("aria-label", "切换模型，选择来源")).props.onClick();
    one(app.render(), attr("data-source-id", "b")).props.onClick();
    const models = one(app.render(), attr("data-page", 2));
    await one(models, cls("dsf-model-row")).props.onClick();
    equal(f.selections[0], { provider: "b", model: "other" }, "model payload");
    const tree = app.render();
    check(one(tree, cls("dsf-island")).props["data-view"] === 0, "must return to control card");
    check(one(tree, cls("dsf-slider-input")).props.max === 2, "slider must adopt the new model's levels");
  });
  testCase("drag previews locally, commits once on release, and retains Default", async () => {
    const f = makeFixture();
    const app = open(f);
    const slider = one(app.render(), cls("dsf-slider-input"));
    slider.props.onChange({ target: { value: "0" } });
    check(f.selections.length === 0, "drag must not send network selections");
    await one(app.render(), cls("dsf-slider-input")).props.onPointerUp();
    await one(app.render(), cls("dsf-slider-input")).props.onBlur();
    equal(f.selections, [{ provider: "a", model: "reasoning" }], "one default submission");
    check(one(app.render(), cls("dsf-slider-input")).props.value === 0, "Default stop jumped after acknowledgement");
  });
  testCase("plain models hide the slider instead of inventing reasoning levels", () => {
    const f = makeFixture();
    f.snapshot.current = { provider: "a", model: "plain" };
    const app = open(f);
    check(all(app.render(), cls("dsf-slider-input")).length === 0, "unsupported slider must be hidden");
  });
  testCase("selection failure preserves navigation and displays the host error", async () => {
    const f = makeFixture();
    f.reject(true);
    const app = open(f);
    one(app.render(), attr("aria-label", "切换模型，选择来源")).props.onClick();
    one(app.render(), attr("data-source-id", "b")).props.onClick();
    await one(one(app.render(), attr("data-page", 2)), cls("dsf-model-row")).props.onClick();
    const tree = app.render();
    check(one(tree, cls("dsf-island")).props["data-view"] === 2, "failure must not dismiss models");
    check(all(tree, node => node.props?.children?.includes("模型切换失败")).length > 0, "missing host error");
    check(f.snapshot.current.provider === "a", "failed selection changed the current model");
  });
  testCase("source search matches model names while retaining provider isolation", () => {
    const f = makeFixture();
    const app = open(f);
    one(app.render(), attr("aria-label", "切换模型，选择来源")).props.onClick();
    const page = one(app.render(), attr("data-page", 1));
    one(page, attr("aria-label", "搜索来源或模型")).props.onChange({ target: { value: "另一个" } });
    const result = one(app.render(), attr("data-page", 1));
    equal(all(result, cls("dsf-source-row")).map(row => row.props["data-source-id"]), ["b"], "source filter");
  });
}

module.exports = { verifyClient };
