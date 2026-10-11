// Limit visual work by elapsed time, independent of a phone's 60/90/120 Hz display.
// Game state and camera targets can still advance between rendered frames.
const RenderPacer = (() => {
  function create(mobile = false) {
    let previous = null, delta = 1 / 60, interval = 1 / 30, count = 0;
    return {
      step(now, active) {
        interval = mobile || !active ? 1 / 30 : 0;
        if (previous !== null && now - previous + .4 < interval * 1000) return false;
        delta = previous === null ? 1 / 60 : Math.max(0, (now - previous) / 1000);
        previous = now; count++; return true;
      },
      reset() { previous = null; delta = 1 / 60; },
      get delta() { return delta; },
      get interval() { return interval || 1 / 60; },
      get frames() { return count; }
    };
  }
  return { create };
})();
