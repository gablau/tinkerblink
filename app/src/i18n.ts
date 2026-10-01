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
};

const language = getLocales()[0]?.languageCode === 'it' ? 'it' : 'en';

/** Testi nella lingua del telefono (letta all'avvio dell'app). */
export const t: Strings = language === 'it' ? it : en;
