// Credits: origin and licenses of what the app uses or includes. Shown on the /credits page.
// Update it when adding a library, a font, a service or external data.
import { language } from '@/i18n';

export interface Credit {
  name: string;
  author: string;
  license: string;
  url: string;
  /** What it is used for in the app. */
  use: string;
}

export interface CreditGroup {
  title: string;
  items: Credit[];
}

const it = language === 'it';
const say = (itText: string, enText: string) => (it ? itText : enText);

/** TinkerBlink source (the GPL requires that people who receive the app can get it). */
export const SOURCE_URL = 'https://github.com/gablau/tinkerblink';

export const CREDIT_GROUPS: CreditGroup[] = [
  {
    title: 'TinkerBlink',
    items: [
      {
        name: 'TinkerBlink',
        author: 'Gabriele Lauricella',
        license: 'GPL-3.0+',
        url: SOURCE_URL,
        use: say(
          'Software libero: GPL-3.0 o successiva, con un permesso aggiuntivo per la distribuzione negli app store (LICENSE-EXCEPTION.md). Tocca per il codice sorgente.',
          'Free software: GPL-3.0 or later, with an additional permission for distribution through app stores (LICENSE-EXCEPTION.md). Tap for the source code.',
        ),
      },
      {
        name: '@tinkerblink/protocol',
        author: 'Gabriele Lauricella',
        license: 'MIT',
        url: `${SOURCE_URL}/tree/main/protocol`,
        use: say('Client del protocollo Blynk Legacy, riusabile anche fuori dall\'app', 'Blynk Legacy protocol client, reusable outside the app'),
      },
      {
        name: say('Sviluppo con l\'AI', 'Built with AI'),
        author: 'Claude (Anthropic) · Claude Code',
        license: 'AI',
        url: `${SOURCE_URL}#use-of-ai`,
        use: say(
          'Gran parte del codice, della documentazione e delle icone è stata scritta da Claude, sotto la guida dell\'autore, che ha deciso funzioni e comportamento e ha provato l\'app con dispositivi reali.',
          'Most of the code, documentation and icons were written by Claude, directed by the author, who decided features and behaviour and tested the app with real devices.',
        ),
      },
    ],
  },
  {
    title: say('Dati inclusi', 'Included data'),
    items: [
      {
        name: say('Definizioni delle schede', 'Board definitions'),
        author: 'Blynk Inc. (2016) · fork gablau',
        license: 'MIT',
        url: 'https://github.com/gablau/tinkerblink-boards',
        use: say('Pin delle schede nel selettore dell\'editor (96 schede)', 'Board pins in the editor pin picker (96 boards)'),
      },
      {
        name: say('Documentazione utente di Blynk Legacy', 'Blynk Legacy user documentation'),
        author: 'Blynk Inc. · fork gablau',
        license: 'MIT',
        url: 'https://gablau.dev/blynk-legacy-docs/',
        use: say('Informazioni sui widget nel Widget Box dell\'editor', 'Widget information in the editor Widget Box'),
      },
      {
        name: say('Certificati radice di Let\'s Encrypt', 'Let\'s Encrypt root certificates'),
        author: 'Internet Security Research Group (ISRG)',
        license: say('Certificati pubblici', 'Public certificates'),
        url: 'https://letsencrypt.org/certificates/',
        use: say(
          'Connessione ai server con certificato Let\'s Encrypt su Android 7.0',
          'Connection to servers with a Let\'s Encrypt certificate on Android 7.0',
        ),
      },
    ],
  },
  {
    title: say('Font', 'Fonts'),
    items: [
      { name: 'Barlow', author: 'Jeremy Tribby', license: 'SIL OFL 1.1', url: 'https://fonts.google.com/specimen/Barlow', use: say('Testi dell\'app', 'App text') },
      { name: 'VT323', author: 'Peter Hull', license: 'SIL OFL 1.1', url: 'https://fonts.google.com/specimen/VT323', use: say('Widget LCD', 'LCD widget') },
      {
        name: 'Material Design Icons',
        author: 'Pictogrammers',
        license: 'Apache 2.0',
        url: 'https://pictogrammers.com/library/mdi/',
        use: say('Icone', 'Icons'),
      },
    ],
  },
  {
    title: say('Mappe', 'Maps'),
    items: [
      { name: 'Leaflet', author: 'Volodymyr Agafonkin', license: 'BSD-2-Clause', url: 'https://leafletjs.com', use: say('Widget Map', 'Map widget') },
      {
        name: 'OpenStreetMap',
        author: say('© contributori di OpenStreetMap', '© OpenStreetMap contributors'),
        license: 'ODbL',
        url: 'https://www.openstreetmap.org/copyright',
        use: say('Tessere della mappa', 'Map tiles'),
      },
      {
        name: 'Esri World Imagery',
        author: 'Esri, Maxar, Earthstar Geographics',
        license: say('Termini d\'uso Esri', 'Esri terms of use'),
        url: 'https://www.esri.com/en-us/legal/terms/full-master-agreement',
        use: say('Vista satellite del widget Map', 'Satellite view of the Map widget'),
      },
    ],
  },
  {
    title: say('Librerie', 'Libraries'),
    items: [
      { name: 'React Native', author: 'Meta Platforms', license: 'MIT', url: 'https://reactnative.dev', use: say('Interfaccia', 'User interface') },
      { name: 'React', author: 'Meta Platforms', license: 'MIT', url: 'https://react.dev', use: say('Interfaccia', 'User interface') },
      { name: 'Expo', author: '650 Industries', license: 'MIT', url: 'https://expo.dev', use: say('Piattaforma, moduli nativi, router, video, posizione, schermo acceso', 'Platform, native modules, router, video, location, screen kept on') },
      { name: 'AndroidX Media3', author: 'Google', license: 'Apache 2.0', url: 'https://developer.android.com/media/media3', use: say('Video RTSP (tramite expo-video)', 'RTSP video (through expo-video)') },
      { name: 'react-native-svg', author: 'Software Mansion', license: 'MIT', url: 'https://github.com/software-mansion/react-native-svg', use: say('Grafici e indicatori', 'Charts and gauges') },
      { name: 'react-native-webview', author: 'react-native-webview', license: 'MIT', url: 'https://github.com/react-native-webview/react-native-webview', use: say('Mappa', 'Map') },
      { name: 'AsyncStorage', author: 'React Native Community', license: 'MIT', url: 'https://github.com/react-native-async-storage/async-storage', use: say('Preferenze', 'Preferences') },
      { name: '@noble/hashes', author: 'Paul Miller', license: 'MIT', url: 'https://github.com/paulmillr/noble-hashes', use: say('Hash della password del protocollo', 'Protocol password hash') },
      { name: 'fflate', author: '101arrowz', license: 'MIT', url: 'https://github.com/101arrowz/fflate', use: say('Profilo e grafici compressi', 'Compressed profile and charts') },
    ],
  },
  {
    title: say('Server', 'Server'),
    items: [
      {
        name: 'Blynk Server (legacy)',
        author: 'Blynk Inc. · fork gablau',
        license: 'GPL-3.0',
        url: 'https://github.com/gablau/blynk-server',
        use: say('Server compatibile: il suo sorgente è il riferimento per protocollo e dati (nessun codice incluso)', 'Compatible server: its source is the reference for protocol and data (no code included)'),
      },
    ],
  },
];

export const DISCLAIMER = say(
  'App non ufficiale, compatibile con Blynk Legacy. Non è affiliata a Blynk Inc.; "Blynk" è un marchio dei rispettivi proprietari.',
  'Unofficial app compatible with Blynk Legacy. Not affiliated with Blynk Inc.; "Blynk" is a trademark of its respective owners.',
);
