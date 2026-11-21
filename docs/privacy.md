# TinkerBlink privacy policy

*Effective date: 2026-11-21* · [Italiano](#informativa-sulla-privacy-di-tinkerblink)

TinkerBlink is a free, open-source app for self-hosted Blynk Legacy servers, developed by Gabriele Lauricella
(contact: gab.lau.dev@gmail.com). This policy explains what data the app handles and where it goes.

## In short

- The developer does not collect any data. The app has no account with the developer, no analytics, no advertising,
  no crash reporting and no tracking.
- The app talks to the **Blynk server you enter** on the login screen. That server is run by you or by whoever you
  chose: its owner is responsible for the data stored there.
- Everything else stays on your phone.

## Data sent to the Blynk server you choose

- **Login**: your email and password, to sign in. The connection is encrypted (TLS).
- **Your projects**: projects, widgets and device settings, and the commands you send to your devices (buttons,
  sliders and so on).
- **Location**: only if a project contains a GPS Stream or GPS Trigger widget, and only while the app is open on
  the screen. The position (or "entered / left the area" for GPS Trigger) is written to the widget pin. The app never
  reads the location in the background.
- **Phone sensors**: only if a project contains a sensor widget (accelerometer, gravity, light, proximity,
  barometer, humidity, temperature), and only while the app is open and connected.

## Data stored on your phone

- The server address and your email, kept in the system's encrypted storage, and your password only if you choose
  to remember it (on the web version the password is never stored).
- Certificates you chose to trust ("Trust this certificate"), stored as fingerprints for each server.
- Display preferences: pinned and hidden projects, and the last project opened.

Logging out deletes the saved password; uninstalling the app deletes all of this data.

## Camera

The camera is used only to scan the QR code of a shared project. The image is decoded on the phone and is not saved
or sent anywhere; only the content of the QR code is used.

## Third-party services

- **Map widget**: the map library (Leaflet) is loaded from unpkg.com, and map tiles from OpenStreetMap
  (tile.openstreetmap.org) and, for the satellite view, Esri (server.arcgisonline.com). These services receive your
  IP address and the area of the map being shown, as with any web map. The app does not send them your coordinates,
  but when the map is centered on your position the area requested shows roughly where you are.
  See the privacy policies of the [OpenStreetMap Foundation](https://osmfoundation.org/wiki/Privacy_Policy) and
  [Esri](https://www.esri.com/en-us/privacy/overview).
- **Video, web links and images** configured in a project are loaded from the addresses written in the project.

## Permissions

- **Location** (while using the app): GPS widgets and your position on the Map widget.
- **Camera**: QR code scanning.
- **Internet**: connection to your Blynk server.

## Children

The app is not directed at children.

## Your data and its deletion

The developer holds no data about you. Data on your Blynk server is managed by that server's owner. Local data is
deleted by uninstalling the app.

## Changes

Changes to this policy are published at this address, with a new effective date. The source code of the app is
public: <https://github.com/gablau/tinkerblink>.

---

# Informativa sulla privacy di TinkerBlink

*In vigore dal: 2026-11-21* · [English](#tinkerblink-privacy-policy)

TinkerBlink è un'app libera e open source per server Blynk Legacy self-hosted, sviluppata da Gabriele Lauricella
(contatto: gab.lau.dev@gmail.com). Questa informativa spiega quali dati tratta l'app e dove vanno.

## In breve

- Lo sviluppatore non raccoglie nessun dato. L'app non ha account presso lo sviluppatore, statistiche d'uso,
  pubblicità, segnalazione degli errori o tracciamento.
- L'app comunica con il **server Blynk che inserisci** nella schermata di accesso. Quel server è gestito da te o da
  chi hai scelto: il suo proprietario è responsabile dei dati che vi sono salvati.
- Tutto il resto resta sul telefono.

## Dati inviati al server Blynk che scegli

- **Accesso**: email e password, per entrare. La connessione è cifrata (TLS).
- **I tuoi progetti**: progetti, widget e impostazioni dei dispositivi, e i comandi che invii ai dispositivi
  (pulsanti, slider e così via).
- **Posizione**: solo se un progetto contiene un widget GPS Stream o GPS Trigger, e solo mentre l'app è aperta sullo
  schermo. La posizione (o "entrato / uscito dall'area" per GPS Trigger) viene scritta sul pin del widget. L'app non
  legge mai la posizione in background.
- **Sensori del telefono**: solo se un progetto contiene un widget sensore (accelerometro, gravità, luce,
  prossimità, barometro, umidità, temperatura), e solo mentre l'app è aperta e connessa.

## Dati salvati sul telefono

- L'indirizzo del server e l'email, conservati nella memoria cifrata del sistema, e la password solo se scegli di
  ricordarla (nella versione web la password non viene mai salvata).
- I certificati di cui hai scelto di fidarti ("Fidati di questo certificato"), salvati come impronte per ogni server.
- Le preferenze di visualizzazione: progetti fissati in cima e nascosti, ultimo progetto aperto.

L'uscita dall'account cancella la password salvata; la disinstallazione dell'app cancella tutti questi dati.

## Fotocamera

La fotocamera serve solo a leggere il codice QR di un progetto condiviso. L'immagine viene decodificata sul telefono
e non viene salvata né inviata; si usa solo il contenuto del codice QR.

## Servizi di terze parti

- **Widget Map**: la libreria della mappa (Leaflet) viene caricata da unpkg.com, e le tessere della mappa da
  OpenStreetMap (tile.openstreetmap.org) e, per la vista satellite, da Esri (server.arcgisonline.com). Questi servizi
  ricevono il tuo indirizzo IP e la zona della mappa mostrata, come per qualsiasi mappa web. L'app non invia loro le
  tue coordinate, ma quando la mappa è centrata sulla tua posizione la zona richiesta indica all'incirca dove ti
  trovi. Vedi le informative della [OpenStreetMap Foundation](https://osmfoundation.org/wiki/Privacy_Policy)
  e di [Esri](https://www.esri.com/en-us/privacy/overview).
- **Video, link e immagini** configurati in un progetto vengono caricati dagli indirizzi scritti nel progetto.

## Autorizzazioni

- **Posizione** (durante l'uso dell'app): widget GPS e la tua posizione sul widget Map.
- **Fotocamera**: lettura dei codici QR.
- **Internet**: connessione al server Blynk.

## Minori

L'app non è destinata ai bambini.

## I tuoi dati e la loro cancellazione

Lo sviluppatore non conserva dati su di te. I dati sul server Blynk sono gestiti dal proprietario del server. I dati
locali si cancellano disinstallando l'app.

## Modifiche

Le modifiche a questa informativa vengono pubblicate a questo indirizzo, con una nuova data di entrata in vigore. Il
codice sorgente dell'app è pubblico: <https://github.com/gablau/tinkerblink>.
