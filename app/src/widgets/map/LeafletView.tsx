// Leaflet map on Android: a WebView with the page from leafletHtml.ts. The web uses LeafletView.web.tsx.
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
      // invalid message: ignored
    }
  };
  return (
    <WebView
      ref={web}
      // baseUrl: OpenStreetMap tiles require a Referer.
      source={{ html, baseUrl: 'https://tinkerblink.local/' }}
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
