function verifyClient(code, evaluate, testCase) {
  function check(condition, message) {
    if (!condition) throw new Error(message);
  }
  function fixture(readyState = "complete") {
    const listeners = new Map();
    const styles = new Set();
    const observers = new Set();
    const frames = new Map();
    const registrations = [];
    const doc = {
      readyState,
      documentElement: {},
      head: { append(node) { styles.add(node); } },
      createElement(tag) {
        check(tag === "style", "unexpected element");
        return { textContent: "", remove() { styles.delete(this); } };
      },
      querySelectorAll() { return []; },
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      emit(type) {
        for (const listener of [...(listeners.get(type) || [])]) listener({ type });
      }
    };
    const window = { __ModuleLoader__: { load(row) { registrations.push(row); } } };
    const globals = {
      window, document: doc,
      MutationObserver: class {
        observe() { observers.add(this); }
        disconnect() { observers.delete(this); }
      },
      requestAnimationFrame(callback) {
        const id = frames.size + 1;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame(id) { frames.delete(id); },
      localStorage: { getItem() { return null; }, setItem() {} },
      Element: class {}
    };
    const listenerCount = () => [...listeners.values()].reduce((n, set) => n + set.size, 0);
    return { globals, registrations, doc, styles, observers, listenerCount };
  }
  function load(env, source = code) {
    evaluate(source, env.globals);
    return env.registrations.at(-1).factory(() => {
      throw new Error("this bundle must not require external modules");
    });
  }
  function activate(plugin) {
    let cleanup;
    plugin.apply({ effect(effect) { cleanup = effect(); } });
    check(typeof cleanup === "function", "effect must return a cleanup");
    return cleanup;
  }

  testCase("classic script registers the exact package id and plugin exports", () => {
    const env = fixture();
    const plugin = load(env);
    check(env.registrations.length === 1, "expected exactly one module registration");
    check(env.registrations[0].id === "dsh-source-fold", "wrong module registration id");
    check(plugin.name === "dsh-source-fold", "wrong plugin name");
    check(typeof plugin.apply === "function", "missing apply");
    check(Array.isArray(plugin.inject) && plugin.inject.length === 0, "unexpected injected dependencies");
    check(env.styles.size === 0 && env.observers.size === 0, "factory must not mount before apply");
  });

  testCase("concatenated plugin scripts keep declarations private", () => {
    const env = fixture();
    load(env, code + "\n" + code);
    check(env.registrations.length === 2, "both concatenated bundles must register");
  });

  testCase("activation and disposal clean up style, observer, listeners and singleton", () => {
    const env = fixture();
    const cleanup = activate(load(env));
    check(env.styles.size === 1 && env.observers.size === 1, "activation failed");
    check(env.listenerCount() === 4, "expected four input listeners");
    check(typeof env.globals.window[Symbol.for("dsh-source-fold.instance")] === "function", "missing singleton");
    cleanup();
    cleanup();
    check(env.styles.size === 0 && env.observers.size === 0 && env.listenerCount() === 0, "disposal leaked resources");
    check(!env.globals.window[Symbol.for("dsh-source-fold.instance")], "singleton leaked");
  });

  testCase("replacement activates once and stale cleanup cannot stop the new instance", () => {
    const env = fixture();
    const plugin = load(env);
    const oldCleanup = activate(plugin);
    const newCleanup = activate(plugin);
    check(env.styles.size === 1 && env.observers.size === 1 && env.listenerCount() === 4, "replacement duplicated resources");
    oldCleanup();
    check(env.styles.size === 1 && env.observers.size === 1, "old cleanup stopped the new instance");
    newCleanup();
    check(env.styles.size === 0 && env.observers.size === 0 && env.listenerCount() === 0, "replacement leaked resources");
  });

  testCase("activation waits for DOMContentLoaded when the document is loading", () => {
    const env = fixture("loading");
    const cleanup = activate(load(env));
    check(env.styles.size === 0 && env.observers.size === 0, "mounted before DOM ready");
    check(env.listenerCount() === 1, "missing DOM readiness listener");
    env.doc.readyState = "complete";
    env.doc.emit("DOMContentLoaded");
    check(env.styles.size === 1 && env.observers.size === 1 && env.listenerCount() === 4, "DOM ready did not activate cleanly");
    cleanup();
    check(env.listenerCount() === 0, "DOM readiness listener leaked");
  });

  testCase("disposal cancels pending DOM readiness activation", () => {
    const env = fixture("loading");
    const cleanup = activate(load(env));
    cleanup();
    env.doc.emit("DOMContentLoaded");
    check(env.styles.size === 0 && env.observers.size === 0 && env.listenerCount() === 0, "disposed effect mounted later");
  });
}

module.exports = { verifyClient };
