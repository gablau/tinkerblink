// Map (modello Map del server), con OpenStreetMap/Leaflet:
// - un marker per indice (il firmware scrive "<indice>\0<lat>\0<lon>\0<nome>"; "clr" li cancella), con il
//   nome nel fumetto al tocco;
// - pulsante in alto a destra: inquadra tutti i marker; in basso a destra (se isMyLocationSupported): la mia
//   posizione, con il cerchio dell'accuratezza;
// - la visuale (centro e zoom) si salva sul telefono per dashboard e widget; senza visuale salvata si
//   inquadrano i marker, altrimenti si parte da lat/lon del widget;
// - isSatelliteMode: immagini satellitari Esri.
// Il widget non ha titolo. Mentre il dito è sulla mappa la dashboard non scorre.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useScrollLock } from '@/components/scrollLock';
import { useMapPoints } from '@/session/hooks';
import type { MapPoint } from '@/session/liveStore';
import type { WidgetViewProps } from '../WidgetFrame';
import { LeafletView, type LeafletHandle } from './LeafletView';

const VIEWS_KEY = 'blynk.map';

interface MapView {
  lat: number;
  lon: number;
  zoom: number;
}

async function loadView(id: string): Promise<MapView | null> {
  try {
    const raw = await AsyncStorage.getItem(VIEWS_KEY);
    return raw ? ((JSON.parse(raw) as Record<string, MapView>)[id] ?? null) : null;
  } catch {
    return null;
  }
}

async function saveView(id: string, view: MapView): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(VIEWS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, MapView>) : {};
    all[id] = view;
    await AsyncStorage.setItem(VIEWS_KEY, JSON.stringify(all));
  } catch {
    // non salvare la visuale non è un errore bloccante
  }
}

const toMessage = (points: MapPoint[]) => points.map(({ index, lat, lon, label }) => ({ index, lat, lon, label }));

export function MapWidget({ dashId, widget, theme }: WidgetViewProps) {
  const points = useMapPoints(dashId, widget);
  const lock = useScrollLock();
  const map = useRef<LeafletHandle>(null);
  const [ready, setReady] = useState(false);
  const viewId = `${dashId}-${widget.id}`;
  const myLocation = widget.isMyLocationSupported === true;
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
    if (ready) map.current?.send({ type: 'points', points: toMessage(points), fit: false });
  }, [points, ready]);

  /** Posizione dell'utente; chiede il permesso solo se `ask` (tocco sul pulsante). */
  const locate = useCallback(
    async (ask: boolean, pan: boolean) => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted && ask) perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        map.current?.send({ type: 'me', lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy ?? 0, pan });
      } catch {
        // posizione non disponibile: niente da mostrare
      }
    },
    [],
  );

  const onMessage = useCallback(
    (msg: { type: string; [key: string]: unknown }) => {
      if (msg.type === 'ready') {
        void loadView(viewId).then((view) => {
          map.current?.send({
            type: 'setup',
            satellite: widget.isSatelliteMode === true,
            markerColor: theme.mapMarker,
            meColor: theme.accent,
            view,
            fallback: { lat: Number(widget.lat) || 0, lon: Number(widget.lon) || 0 },
          });
          map.current?.send({ type: 'points', points: toMessage(pointsRef.current), fit: view === null });
          setReady(true);
          if (myLocation) void locate(false, false);
        });
      } else if (msg.type === 'view') {
        void saveView(viewId, { lat: Number(msg.lat), lon: Number(msg.lon), zoom: Number(msg.zoom) });
      }
    },
    [viewId, widget.isSatelliteMode, widget.lat, widget.lon, theme.mapMarker, theme.accent, myLocation, locate],
  );

  return (
    <View
      style={[styles.frame, { backgroundColor: theme.background }]}
      onTouchStart={() => lock(true)}
      onTouchEnd={() => lock(false)}
      onTouchCancel={() => lock(false)}
    >
      <LeafletView ref={map} onMessage={onMessage} />
      <Pressable style={[styles.button, styles.top]} onPress={() => map.current?.send({ type: 'fit' })} hitSlop={8}>
        <MaterialCommunityIcons name="map-marker-multiple" size={24} color={theme.mapMarker} />
      </Pressable>
      {myLocation && (
        <Pressable style={[styles.button, styles.bottom]} onPress={() => void locate(true, true)} hitSlop={8}>
          <MaterialCommunityIcons name="crosshairs-gps" size={24} color={theme.mapMarker} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, borderRadius: 6, overflow: 'hidden' },
  button: {
    position: 'absolute',
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: { top: 12 },
  bottom: { bottom: 12 },
});
