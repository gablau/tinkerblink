// Scorrimento automatico della dashboard durante un trascinamento dell'editor: con il dito vicino al bordo alto o
// basso dello ScrollView la vista scorre da sola (più veloce più si è vicini al bordo). Il gesto aggiunge al suo
// spostamento quanto è scorsa la vista (offset()), così il widget resta sotto il dito, e si ricalcola a ogni passo
// anche se il dito è fermo (onTick).
import type { ScrollView } from 'react-native';

/** Fascia vicino ai bordi in cui parte lo scorrimento (dp). */
const EDGE = 96;
/** Velocità massima, in dp per fotogramma. */
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

  /** Lo ScrollView da far scorrere (collegato in un effect); posizione e misure arrivano dai suoi eventi. */
  attach(view: ScrollView | null): void {
    this.view = view;
  }
  setScrollY(y: number): void {
    // Durante lo scorrimento automatico vale la posizione impostata qui, non quella (in ritardo) degli eventi.
    if (this.frame === null) this.scrollY = y;
  }
  setViewHeight(h: number): void {
    this.viewHeight = h;
  }
  setContentHeight(h: number): void {
    this.contentHeight = h;
  }

  /** Inizio del gesto: posizione di partenza e posizione della vista sullo schermo. */
  begin(): void {
    this.startY = this.scrollY;
    const v = this.view as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
    v?.measureInWindow?.((_x, y, _w, h) => {
      this.viewTop = y;
      if (h > 0) this.viewHeight = h;
    });
  }

  /** Quanto è scorsa la vista dall'inizio del gesto. */
  offset(): number {
    return this.scrollY - this.startY;
  }

  /** Posizione del dito sullo schermo (pageY / moveY del PanResponder). */
  drag(pageY: number): void {
    const fromTop = pageY - this.viewTop;
    const fromBottom = this.viewTop + this.viewHeight - pageY;
    if (fromTop < EDGE) this.speed = -MAX_SPEED * Math.min(1, (EDGE - fromTop) / EDGE);
    else if (fromBottom < EDGE) this.speed = MAX_SPEED * Math.min(1, (EDGE - fromBottom) / EDGE);
    else this.speed = 0;
    if (this.speed !== 0 && this.frame === null) this.frame = requestAnimationFrame(this.step);
  }

  /** Fine del gesto. */
  end(): void {
    this.speed = 0;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  /** Avviso a ogni passo dello scorrimento automatico (il gesto ricalcola posizione e anteprima). */
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
    // Al bordo del contenuto si aspetta comunque: il contenuto può crescere (righe in fondo, widget spinti).
    this.frame = requestAnimationFrame(this.step);
  };
}
