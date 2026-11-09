/** A pointer in logical (720-wide) coordinates. */
export interface Pointer {
  id: number;
  x: number;
  y: number;
  /** Real time (ms) when the pointer went down. */
  downAt: number;
  startX: number;
  startY: number;
}

/**
 * Every screen of the game is a Scene. The Game drives exactly one scene at a time.
 * `dt` is scaled simulation time (affected by hit-stop / slow-mo), `rdt` is real time.
 */
export interface Scene {
  enter?(): void;
  exit?(): void;
  update(dt: number, rdt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  pointerDown?(p: Pointer): void;
  pointerMove?(p: Pointer): void;
  pointerUp?(p: Pointer): void;
  /** Android back button. Return true when handled. */
  back?(): boolean;
  /** Called when the logical viewport size changed. */
  resize?(): void;
  /** App went to background. */
  pause?(): void;
}
