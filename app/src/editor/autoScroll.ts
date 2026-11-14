// Automatic scrolling of the dashboard while dragging in the editor: with the finger near the top or
// bottom edge of the ScrollView the view scrolls by itself (faster closer to the edge). The gesture adds to its
// movement how far the view has scrolled (offset()), so the widget stays under the finger, and it is recomputed
// at every step even when the finger is still (onTick).
import type { ScrollView } from 'react-native';

/** Band near the edges where scrolling starts (dp). */
const EDGE = 96;
/** Maximum speed, in dp per frame. */
const MAX_SPEED = 18;

export class AutoScroller {
  private view: ScrollView | null = null;
  private scrollY = 0;
  private startY = 0;
  private viewTop = 0;
  private viewHeight = 0;
  private contentHeight = 0;
  private speed = 0;
  private frame: number | null = null;
  private listeners = new Set<() => void>();

  /** The ScrollView to scroll (connected in an effect); position and sizes come from its events. */
  attach(view: ScrollView | null): void {
    this.view = view;
  }
  setScrollY(y: number): void {
    // During automatic scrolling the position set here wins over the (late) one from the events.
    if (this.frame === null) this.scrollY = y;
  }
  setViewHeight(h: number): void {
    this.viewHeight = h;
  }
  setContentHeight(h: number): void {
    this.contentHeight = h;
  }

  /** Start of the gesture: start position and position of the view on the screen. */
  begin(): void {
    this.startY = this.scrollY;
    const v = this.view as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
    v?.measureInWindow?.((_x, y, _w, h) => {
      this.viewTop = y;
      if (h > 0) this.viewHeight = h;
    });
  }

  /** How far the view has scrolled since the start of the gesture. */
  offset(): number {
    return this.scrollY - this.startY;
  }

  /** Position of the finger on the screen (pageY / moveY of the PanResponder). */
  drag(pageY: number): void {
    const fromTop = pageY - this.viewTop;
    const fromBottom = this.viewTop + this.viewHeight - pageY;
    if (fromTop < EDGE) this.speed = -MAX_SPEED * Math.min(1, (EDGE - fromTop) / EDGE);
    else if (fromBottom < EDGE) this.speed = MAX_SPEED * Math.min(1, (EDGE - fromBottom) / EDGE);
    else this.speed = 0;
    if (this.speed !== 0 && this.frame === null) this.frame = requestAnimationFrame(this.step);
  }

  /** End of the gesture. */
  end(): void {
    this.speed = 0;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  /** Notified at every step of automatic scrolling (the gesture recomputes position and preview). */
  onTick(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private step = (): void => {
    this.frame = null;
    if (this.speed === 0) return;
    const max = Math.max(0, this.contentHeight - this.viewHeight);
    const next = Math.min(max, Math.max(0, this.scrollY + this.speed));
    if (next !== this.scrollY) {
      this.scrollY = next;
      this.view?.scrollTo({ y: next, animated: false });
      this.listeners.forEach((l) => l());
    }
    // At the edge of the content keep waiting anyway: the content can grow (rows at the bottom, pushed widgets).
    this.frame = requestAnimationFrame(this.step);
  };
}
