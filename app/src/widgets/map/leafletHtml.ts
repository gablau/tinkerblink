// HTML page with Leaflet for the Map widget: OpenStreetMap maps (or Esri satellite imagery), no API
// keys. It runs in a WebView (Android) or in an iframe (web) and talks to the app with JSON messages:
//
// app → map (window.blynk(cmd)):
//   { type: 'setup', satellite, markerColor, meColor, view?: { lat, lon, zoom }, fallback: { lat, lon } }
//   { type: 'points', points: [{ index, lat, lon, label }], fit }   fit = fit the points
//   { type: 'fit' }                                                  fit the points (button)
//   { type: 'me', lat, lon, accuracy, pan }                          user location
// map → app:
//   { type: 'ready' }
//   { type: 'view', lat, lon, zoom }                                 after the user moved the map
//
// Leaflet is loaded from unpkg: the map needs Internet for the tiles anyway.

/** Zoom with a single point: close enough to see the street. */
export const SINGLE_POINT_ZOOM = 16;
const FIT_PADDING = 48;

export function buildLeafletHtml(): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #212227; }
  .leaflet-control-attribution { font-size: 8px; }
  .pin svg { display: block; }
</style>
</head><body>
<div id="map"></div>
<script>
(function () {
  function post(msg) {
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent) window.parent.postMessage(s, '*');
  }
  var map = L.map('map', { zoomControl: false, attributionControl: true });
  var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  });
  var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: '&copy; Esri'
  });
  var markers = L.layerGroup().addTo(map);
  var me = null, meCircle = null;
  var color = '#131319', meColor = '#23C48E';
  var points = [];
  var userMove = false;

  function pinIcon() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 26 36">' +
      '<path d="M13 35C13 35 25 21 25 13A12 12 0 0 0 1 13C1 21 13 35 13 35Z" fill="' + color + '" stroke="#fff" stroke-width="1.5"/>' +
      '<circle cx="13" cy="13" r="4.5" fill="#fff"/></svg>';
    return L.divIcon({ className: 'pin', html: svg, iconSize: [26, 36], iconAnchor: [13, 35], popupAnchor: [0, -32] });
  }
  function fit() {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView([points[0].lat, points[0].lon], ${SINGLE_POINT_ZOOM}); return; }
    map.fitBounds(points.map(function (p) { return [p.lat, p.lon]; }), { padding: [${FIT_PADDING}, ${FIT_PADDING}] });
  }
  function drawPoints() {
    markers.clearLayers();
    points.forEach(function (p) {
      var m = L.marker([p.lat, p.lon], { icon: pinIcon() });
      if (p.label) m.bindPopup(p.label.replace(/</g, '&lt;'));
      markers.addLayer(m);
    });
  }
  // Initial view to apply again when the container gets its final size: if the map is created while the
  // WebView is still 0×0, Leaflet would move the center on resize.
  var initial = null;
  var touched = false;
  var el = document.getElementById('map');
  ['touchstart', 'mousedown', 'wheel'].forEach(function (ev) {
    el.addEventListener(ev, function () { touched = true; userMove = true; }, { passive: true });
  });
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      map.invalidateSize({ pan: false });
      if (!touched && initial) initial();
    }).observe(el);
  }
  // Only the view chosen by the user (gestures) is saved, not the moves made by the code.
  map.on('moveend', function () {
    if (!userMove) return;
    var c = map.getCenter();
    post({ type: 'view', lat: c.lat, lon: c.lng, zoom: map.getZoom() });
  });

  window.blynk = function (cmd) {
    if (cmd.type === 'setup') {
      color = cmd.markerColor || color;
      meColor = cmd.meColor || meColor;
      (cmd.satellite ? sat : osm).addTo(map);
      var view = cmd.view, fb = cmd.fallback;
      initial = view
        ? function () { map.setView([view.lat, view.lon], view.zoom); }
        : function () { map.setView([fb.lat, fb.lon], 15); };
      initial();
    } else if (cmd.type === 'points') {
      points = cmd.points || [];
      drawPoints();
      if (cmd.fit && points.length > 0) { initial = fit; fit(); }
    } else if (cmd.type === 'fit') {
      userMove = false;
      fit();
    } else if (cmd.type === 'me') {
      var ll = [cmd.lat, cmd.lon];
      if (!me) {
        me = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: meColor, fillOpacity: 1 }).addTo(map);
        meCircle = L.circle(ll, { radius: cmd.accuracy || 0, color: meColor, weight: 1, fillColor: meColor, fillOpacity: 0.15 }).addTo(map);
      } else {
        me.setLatLng(ll);
        meCircle.setLatLng(ll).setRadius(cmd.accuracy || 0);
      }
      if (cmd.pan) { userMove = false; map.setView(ll, Math.max(map.getZoom(), ${SINGLE_POINT_ZOOM})); }
    }
  };
  // Messages from the web app (iframe).
  window.addEventListener('message', function (e) {
    try { var cmd = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; if (cmd && cmd.type) window.blynk(cmd); } catch (err) {}
  });
  post({ type: 'ready' });
})();
</script>
</body></html>`;
}
