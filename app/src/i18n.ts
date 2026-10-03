// Testi dell'app nella lingua del telefono: italiano oppure inglese (default).
// I testi dei widget usano la terminologia della documentazione di Blynk Legacy, che esiste solo in inglese.
import { getLocales } from 'expo-localization';

const en = {
  // Widget
  everyday: 'Everyday',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  // Schermate
  appTitle: 'Blynk Legacy',
  loginSubtitle: 'Log in to your server',
  server: 'Server',
  email: 'Email',
  password: 'Password',
  rememberPassword: 'Remember password',
  logIn: 'Log In',
  logOut: 'Log out',
  credits: 'Credits',
  projects: 'Projects',
  widgetCount: (n: number) => `${n} widget${n === 1 ? '' : 's'}`,
  notActive: 'not active',
  dashboardNotFound: 'Dashboard not found',
  connecting: 'Connecting…',
  reconnecting: 'Connection lost, reconnecting…',
  paused: 'Paused',
  wrongCredentials: 'Wrong email or password',
  deviceOffline: 'Device offline: command not delivered',
  notConnected: 'Not connected: command not sent',
  cancel: 'Cancel',
  save: 'Save',
  start: 'Start',
  stop: 'Stop',
  send: 'Send',
  noStop: 'No end time',
  // Stato dei device
  onlineSince: (when: string) => `Online since ${when}`,
  offlineSince: (when: string) => `Offline since ${when}`,
  neverOnline: 'Never connected',
  // SuperChart
  graphNoData: 'No data yet',
  graphLoading: 'Loading…',
  // Video
  videoEmpty: 'No video URL set',
  inputHint: 'Type a value',
  videoError: 'Unable to play the video stream',
  videoNoRtspWeb: 'RTSP streams cannot be played in the browser',
  near: 'Near',
  far: 'Far',
  gpsNotificationTitle: 'Blynk Legacy',
  gpsNotificationBody: 'Sending the position (GPS Stream)',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  /** "20:50 Oct 1, 2026". */
  formatDateTime: (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${en.months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
};

type Strings = typeof en;

const it: Strings = {
  everyday: 'Tutti i giorni',
  weekdays: 'Giorni feriali',
  weekends: 'Weekend',
  sunrise: 'Alba',
  sunset: 'Tramonto',
  days: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
  appTitle: 'Blynk Legacy',
  loginSubtitle: 'Accedi al tuo server',
  server: 'Server',
  email: 'Email',
  password: 'Password',
  rememberPassword: 'Ricorda la password',
  logIn: 'Accedi',
  logOut: 'Esci',
  credits: 'Crediti',
  projects: 'Progetti',
  widgetCount: (n: number) => `${n} widget`,
  notActive: 'non attivo',
  dashboardNotFound: 'Dashboard non trovata',
  connecting: 'Connessione…',
  reconnecting: 'Connessione persa, riconnessione in corso…',
  paused: 'In pausa',
  wrongCredentials: 'Email o password non corrette',
  deviceOffline: 'Dispositivo offline: comando non consegnato',
  notConnected: 'Non connesso: comando non inviato',
  cancel: 'Annulla',
  save: 'Salva',
  start: 'Inizio',
  stop: 'Fine',
  send: 'Invia',
  noStop: 'Senza orario di fine',
  onlineSince: (when: string) => `Online da ${when}`,
  offlineSince: (when: string) => `Offline da ${when}`,
  neverOnline: 'Mai collegato',
  graphNoData: 'Ancora nessun dato',
  graphLoading: 'Caricamento…',
  videoEmpty: 'Nessun indirizzo video impostato',
  inputHint: 'Inserisci un valore',
  videoError: 'Impossibile riprodurre lo stream video',
  videoNoRtspWeb: 'Il browser non può riprodurre gli stream RTSP',
  near: 'Vicino',
  far: 'Lontano',
  gpsNotificationTitle: 'Blynk Legacy',
  gpsNotificationBody: 'Invio della posizione (GPS Stream)',
  months: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  /** "20:50 1 ott 2026". */
  formatDateTime: (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${d.getDate()} ${it.months[d.getMonth()]} ${d.getFullYear()}`,
};

export const language = getLocales()[0]?.languageCode === 'it' ? 'it' : 'en';

/** Testi nella lingua del telefono (letta all'avvio dell'app). */
export const t: Strings = language === 'it' ? it : en;
