// Mappa Leaflet su Android: WebView con la pagina di leafletHtml.ts. Sul web c'è LeafletView.web.tsx.
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildLeafletHtml } from './leafletHtml';

export interface LeafletHandle {
  send(cmd: object): void;
}

export interface LeafletProps {
  onMessage(msg: { type: string; [key: string]: unknown }): void;
}

export const LeafletView = forwardRef<LeafletHandle, LeafletProps>(function LeafletView({ onMessage }, ref) {
  const web = useRef<WebView>(null);
  const html = useMemo(() => buildLeafletHtml(), []);
  useImperativeHandle(ref, () => ({
    send(cmd: object) {
      web.current?.injectJavaScript(`window.blynk && window.blynk(${JSON.stringify(cmd)}); true;`);
    },
  }));
  const handle = (e: WebViewMessageEvent) => {
    try {
      onMessage(JSON.parse(e.nativeEvent.data));
    } catch {
      // messaggio non valido: ignorato
    }
  };
  return (
    <WebView
      ref={web}
      // baseUrl: le tessere di OpenStreetMap vogliono un Referer.
      source={{ html, baseUrl: 'https://blynklegacy.local/' }}
      originWhitelist={['*']}
      onMessage={handle}
      style={styles.web}
      javaScriptEnabled
      setSupportMultipleWindows={false}
      overScrollMode="never"
    />
  );
});

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
});
