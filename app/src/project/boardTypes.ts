// Modelli hardware e tipi di connessione dei device.
// Il server conosce solo i nomi del suo enum BoardType (BoardType.fromLabel trasforma ogni altro nome in
// "Generic Board"), quindi l'elenco viene da lì: lo rigenera app/scripts/import-boards.js dal sorgente del
// server (fork gablau/blynk-server). I pin dell'editor vengono dalle definizioni in editor/boards; per i modelli
// senza definizione si usa la scheda generica. Su un server senza i modelli nuovi il device resta Generic Board.

// <boards>
// Generato da app/scripts/import-boards.js dall'enum BoardType del server (99 modelli): non modificare.
const SERVER_BOARD_TYPES = [
  'ESP8266', 'Arduino UNO', 'NodeMCU', 'Raspberry Pi 3 B', 'WeMos D1 mini', 'Arduino Nano', 'Arduino Mega',
  'ESP32 Dev Board', 'WeMos D1', 'Generic Board', 'Raspberry Pi 2/A+/B+', 'Particle Photon', 'Arduino MKR1000',
  'Arduino 101', 'Arduino Yun', 'Raspberry Pi A/B (Rev2)', 'Arduino Pro Mini', 'Arduino Leonardo',
  'Raspberry Pi B (Rev1)', 'Arduino Due', 'SparkFun Blynk Board', 'Orange Pi', 'BBC Micro:bit', 'Arduino Mini',
  'Arduino Micro', 'Onion Omega', 'Arduino Pro Micro', 'Particle Core', 'SparkFun ESP8266 Thing',
  'STM32F103C Blue Pill', 'WiPy', 'Particle Electron', 'Arduino Zero', 'Intel Edison', 'Teensy 3', 'LinkIt ONE',
  'NanoPi', 'LightBlue Bean', 'Intel Galileo', 'RedBearLab BLE Nano', 'RedBear Duo', 'TI CC3200-LaunchXL',
  'Digistump Oak', 'Seeed Wio Link', 'TI Tiva C Connected', 'Samsung ARTIK 5', 'Microduino CoreUSB',
  'Espruino Pico', 'TinyDuino', 'Microduino Core+', 'chipKIT Uno32', 'The AirBoard', 'Microduino Core', 'Simblee',
  'LeMaker Banana Pro', 'Wildfire v2', 'LightBlue Bean+', 'SparkFun Photon RedBoard', 'Microduino CoreRF',
  'RedBearLab CC3200/Mini', 'Bluz', 'LeMaker Guitar', 'panStamp esp-output', 'Digistump Digispark',
  'RedBearLab Blend Micro', 'TI LM4F120 LaunchPad', 'Wildfire v3', 'Wildfire v4', 'Konekt Dash Pro',
  'Arduino GIGA R1 WiFi', 'Arduino MKR WiFi 1010', 'Arduino Nano 33 IoT', 'Arduino Nano ESP32',
  'Arduino Nano Every', 'Arduino Nano RP2040 Connect', 'Arduino UNO R4 Minima', 'Arduino UNO R4 WiFi',
  'Arduino UNO WiFi Rev2', 'ESP32-C3 SuperMini', 'ESP32-C6 SuperMini', 'ESP32-S3 SuperMini', 'LOLIN C3 Mini',
  'LOLIN C3 Pico', 'LOLIN D1 mini Lite', 'LOLIN D1 mini Pro', 'LOLIN D32', 'LOLIN D32 Pro', 'LOLIN S2 Mini',
  'LOLIN S2 Pico', 'LOLIN S3', 'LOLIN S3 Mini', 'LOLIN S3 Mini Pro', 'LOLIN S3 Pro', 'Raspberry Pi 3 A+/B+',
  'Raspberry Pi 4 B/400', 'Raspberry Pi 5/500', 'Raspberry Pi Pico W', 'Raspberry Pi Pico 2 W',
  'Raspberry Pi Zero/Zero W/Zero 2 W',
];
// </boards>

/** Modelli in ordine alfabetico, per il menu. */
export const BOARD_TYPES: readonly string[] = [...SERVER_BOARD_TYPES].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

/** Un progetto nuovo parte da un ESP8266 in Wi-Fi. */
export const DEFAULT_BOARD = 'ESP8266';
export const DEFAULT_CONNECTION = 'WI_FI';

/** Tipi di connessione del server (ConnectionType), nell'ordine del menu. */
export const CONNECTION_TYPES = [
  { value: 'ETHERNET', label: 'Ethernet' },
  { value: 'WI_FI', label: 'Wi-Fi' },
  { value: 'USB', label: 'USB' },
  { value: 'GSM', label: 'GSM' },
  { value: 'BLUETOOTH', label: 'Bluetooth' },
  { value: 'BLE', label: 'BLE' },
];

/** Schede che passano subito in Wi-Fi quando vengono scelte. */
const WI_FI_BOARDS = [
  'ESP8266', 'ESP32 Dev Board', 'NodeMCU', 'SparkFun Blynk Board', 'SparkFun ESP8266 Thing', 'Particle Photon',
  'Arduino GIGA R1 WiFi', 'Arduino MKR WiFi 1010', 'Arduino Nano 33 IoT', 'Arduino Nano ESP32',
  'Arduino Nano RP2040 Connect', 'Arduino UNO R4 WiFi', 'Arduino UNO WiFi Rev2', 'ESP32-C3 SuperMini',
  'ESP32-C6 SuperMini', 'ESP32-S3 SuperMini', 'LOLIN C3 Mini', 'LOLIN C3 Pico', 'LOLIN D1 mini Lite',
  'LOLIN D1 mini Pro', 'LOLIN D32', 'LOLIN D32 Pro', 'LOLIN S2 Mini', 'LOLIN S2 Pico', 'LOLIN S3', 'LOLIN S3 Mini',
  'LOLIN S3 Mini Pro', 'LOLIN S3 Pro', 'Raspberry Pi Pico W', 'Raspberry Pi Pico 2 W',
];

export function isWifiBoard(board: string): boolean {
  return WI_FI_BOARDS.includes(board);
}
