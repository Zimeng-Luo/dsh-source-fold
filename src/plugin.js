function apply(ctx) {
  const SEAT = "conversation.input.model";
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-source-fold";
    style.textContent = CSS;
    let active = true;
    const install = () => {
      document.removeEventListener("DOMContentLoaded", install);
      if (active) document.head?.append(style);
    };
    if (document.head) install();
    else document.addEventListener("DOMContentLoaded", install, { once: true });
    return () => {
      active = false;
      document.removeEventListener("DOMContentLoaded", install);
      style.remove();
    };
  }, "dsh-source-fold: island styles");

  ctx.slots.inject(SEAT, () => {
    const entries = ctx.slots.entries(SEAT);
    const priority = Math.min(-1000, ...entries.map(entry => entry.options.priority ?? 0)) - 1;
    return ctx.slots.register({
      name: SEAT,
      priority,
      inject: sessionId => {
        const available = ctx.sessions.subagentAddress(sessionId) === undefined;
        return {
          sessionKey: sessionId,
          available,
          controller: available ? ctx.modelDirectories.directoryFor(sessionId) : null
        };
      }
    }, ModelSeat);
  });
}
