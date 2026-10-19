// Limit visual work by elapsed time, independent of a phone's display refresh.
// Keep the target clock separate from actual paint times: small RAF jitter must
// not move every subsequent deadline and silently lower the target frame rate.
const RenderPacer = (() => {
  function create(mobile = false) {
    let previous = null, next = null, lastInterval = null, delta = 1 / 60, interval = mobile ? 1 / 60 : 1 / 30, count = 0;
    let override = null;     // a target set by hand (the phone test, ?test): frames a second, 0 = every frame the display offers
    let rated = 60;          // a phone's frames a second while something moves (the menu's 60 or 120); still, it stays at 60
    // A 60 Hz display needs a small early margin at a matching 60 FPS target;
    // otherwise timestamp jitter can discard frames that the display cannot recover.
    const tolerance = 1.25;
    return {
      step(now, active) {
        interval = override != null ? (override ? 1 / override : 0) : mobile ? (active ? 1 / rated : 1 / 60) : active ? 0 : 1 / 30;
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
      target(fps) { override = fps == null ? null : fps; },
      rate(fps) { if (fps != null) rated = fps > 60 ? Math.min(240, fps) : 60; return rated; },
      get delta() { return delta; },
      get interval() { return interval || 1 / 60; },
      get frames() { return count; }
    };
  }
  return { create };
})();

// A phone's safety net above the standard graphics level (board3d.js guard): watches the drawn frames and says when to
// draw less. It judges at least two seconds of frames (and six of them) by their mean time, the slowest twentieth left
// out: isolated stalls (a picture decoded, a shader made) do not count, and a 75, 90 or 144 Hz screen that shows a 60
// target unevenly (some frames a refresh early, some a refresh late) means exactly the target. More than 15% over the
// target (under 52 frames a second at 60) is lagging: 'rate' (a phone at 120 goes back to 60), else 'down' a step. A
// step that did not help (less than a third of the lag gone: the models are slow, not the pixels) is taken back, 'up',
// and then nothing more is said, so the board is not blurred for nothing; past the last step, 'stuck'.
const FrameGuard = (() => {
  function create(steps = 5) {
    let times = [], seenT = 0, step = 0, before = 0, stuck = false;
    const clear = () => { times = []; seenT = 0; };
    return {
      // one drawn frame: the seconds since the one before, the target interval, the phone's chosen rate
      sample(real, interval, rated = 60) {
        if (stuck || !(real > 0) || !(interval > 0)) return null;
        times.push(real / interval); seenT += real;          // each frame against its own target (moving or still)
        if (seenT < 2 || times.length < 6) return null;
        const s = times.sort((a, b) => a - b).slice(0, times.length - Math.floor(times.length / 20));
        const over = s.reduce((a, b) => a + b, 0) / s.length - 1, r = { over, fps: Math.round(times.length / seenT * 10) / 10, of: times.length };
        clear();
        if (over <= 0.15) { before = 0; return null; }
        if (rated > 60) return { do: 'rate', step, ...r };
        if (step > 0 && before && over > before * 0.67) { stuck = true; step--; return { do: 'up', step, before, ...r }; }
        if (step < steps - 1) { before = over; step++; return { do: 'down', step, ...r }; }
        stuck = true; return { do: 'stuck', step, ...r };
      },
      pause: clear,                                  // not judged now (a game's first seconds, models arriving)
      reset() { clear(); step = 0; before = 0; stuck = false; },
      get step() { return step; }, get stuck() { return stuck; }
    };
  }
  return { create };
})();
