export const TICK_SECONDS = 1 / 60;

/** Fixed-step accumulator. At most maxSteps catch-up steps, then time is dropped. */
export function createTicker(
  onStep: (dt: number) => void,
  tick = TICK_SECONDS,
  maxSteps = 4
): (frameDt: number) => number {
  let acc = 0;
  return (frameDt: number): number => {
    acc += Math.min(frameDt, 0.25);
    let steps = 0;
    while (acc >= tick && steps < maxSteps) {
      onStep(tick);
      acc -= tick;
      steps += 1;
    }
    if (steps === maxSteps) acc = 0;
    return steps;
  };
}
