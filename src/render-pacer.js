// Limit visual work by elapsed time, independent of a phone's display refresh.
// Keep the target clock separate from actual paint times: small RAF jitter must
// not move every subsequent deadline and silently lower the target frame rate.
const RenderPacer = (() => {
  function create(mobile = false) {
    let previous = null, next = null, lastInterval = null, delta = 1 / 60, interval = 1 / 30, count = 0;
    const tolerance = .4;
    return {
      step(now, active) {
        interval = mobile || !active ? 1 / 30 : 0;
        const milliseconds = interval * 1000;
        if (milliseconds !== lastInterval) {
          next = milliseconds && previous !== null ? previous + milliseconds : null;
          lastInterval = milliseconds;
        }
        if (milliseconds && next !== null && now + tolerance < next) return false;
        delta = previous === null ? 1 / 60 : Math.max(0, (now - previous) / 1000);
        previous = now;
        if (milliseconds) {
          if (next === null) next = now + milliseconds;
          else next += Math.max(1, Math.floor((now + tolerance - next) / milliseconds) + 1) * milliseconds;
        }
        // Missed deadlines are skipped, never repainted in a catch-up burst.
        count++; return true;
      },
      reset() { previous = next = lastInterval = null; delta = 1 / 60; },
      get delta() { return delta; },
      get interval() { return interval || 1 / 60; },
      get frames() { return count; }
    };
  }
  return { create };
})();
