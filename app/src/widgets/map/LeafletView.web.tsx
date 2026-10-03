// Mappa Leaflet sul web: iframe con la stessa pagina della WebView di Android (leafletHtml.ts).
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { buildLeafletHtml } from './leafletHtml';
import type { LeafletHandle, LeafletProps } from './LeafletView';

export type { LeafletHandle, LeafletProps } from './LeafletView';

export const LeafletView = forwardRef<LeafletHandle, LeafletProps>(function LeafletView({ onMessage }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => buildLeafletHtml(), []);
  useImperativeHandle(ref, () => ({
    send(cmd: object) {
      frame.current?.contentWindow?.postMessage(JSON.stringify(cmd), '*');
    },
  }));
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      try {
        onMessage(JSON.parse(String(e.data)));
      } catch {
        // messaggio non valido: ignorato
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [onMessage]);
  return <iframe ref={frame} srcDoc={html} title="map" style={{ border: 0, width: '100%', height: '100%' }} />;
});
