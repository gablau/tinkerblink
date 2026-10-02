// Codici dei comandi e delle risposte del protocollo app.
// Fonte: server/core/.../protocol/enums/Command.java e Response.java (blynk-server 0.41.17).

export const Command = {
  RESPONSE: 0,
  REGISTER: 1,
  LOGIN: 2,
  REDEEM: 3,
  HARDWARE_CONNECTED: 4,
  PING: 6,
  ACTIVATE_DASHBOARD: 7,
  DEACTIVATE_DASHBOARD: 8,
  REFRESH_TOKEN: 9,
  TWEET: 12,
  EMAIL: 13,
  PUSH_NOTIFICATION: 14,
  BRIDGE: 15,
  HARDWARE_SYNC: 16,
  BLYNK_INTERNAL: 17,
  SMS: 18,
  SET_WIDGET_PROPERTY: 19,
  HARDWARE: 20,
  CREATE_DASH: 21,
  UPDATE_DASH: 22,
  DELETE_DASH: 23,
  LOAD_PROFILE_GZIPPED: 24,
  APP_SYNC: 25,
  SHARING: 26,
  ADD_PUSH_TOKEN: 27,
  EXPORT_GRAPH_DATA: 28,
  GET_SHARE_TOKEN: 30,
  REFRESH_SHARE_TOKEN: 31,
  SHARE_LOGIN: 32,
  CREATE_WIDGET: 33,
  UPDATE_WIDGET: 34,
  DELETE_WIDGET: 35,
  GET_ENERGY: 36,
  ADD_ENERGY: 37,
  UPDATE_PROJECT_SETTINGS: 38,
  ASSIGN_TOKEN: 39,
  GET_SERVER: 40,
  CREATE_DEVICE: 42,
  UPDATE_DEVICE: 43,
  DELETE_DEVICE: 44,
  GET_DEVICES: 45,
  CREATE_TAG: 46,
  UPDATE_TAG: 47,
  DELETE_TAG: 48,
  GET_TAGS: 49,
  MOBILE_GET_DEVICE: 50,
  UPDATE_FACE: 51,
  GET_PROJECT_BY_TOKEN: 58,
  GET_ENHANCED_GRAPH_DATA: 60,
  DELETE_ENHANCED_GRAPH_DATA: 61,
  GET_CLONE_CODE: 62,
  GET_PROJECT_BY_CLONE_CODE: 63,
  HARDWARE_RESEND_FROM_BLUETOOTH: 65,
  LOGOUT: 66,
  GET_WIDGET: 70,
  DEVICE_OFFLINE: 71,
  OUTDATED_APP_NOTIFICATION: 72,
  GET_PROVISION_TOKEN: 74,
  RESET_PASSWORD: 81,
} as const;

export type CommandCode = (typeof Command)[keyof typeof Command];

const commandNames = new Map<number, string>(
  Object.entries(Command).map(([name, code]) => [code, name]),
);

export function commandName(code: number): string {
  return commandNames.get(code) ?? `CMD_${code}`;
}

/**
 * msgId degli APP_SYNC che il server invia in risposta a una richiesta di sincronizzazione
 * (MobileSyncWidget.SYNC_DEFAULT_MESSAGE_ID). Gli APP_SYNC inoltrati da altre app hanno invece il msgId
 * del messaggio inoltrato.
 */
export const SYNC_MESSAGE_ID = 1111;

/** Comandi a cui il server risponde con un body binario (gzip). */
export const BINARY_RESPONSE_COMMANDS: ReadonlySet<number> = new Set([
  Command.LOAD_PROFILE_GZIPPED,
  Command.GET_ENHANCED_GRAPH_DATA,
  Command.GET_PROJECT_BY_TOKEN,
  Command.GET_PROJECT_BY_CLONE_CODE,
]);

export const ResponseCode = {
  OK: 200,
  QUOTA_LIMIT: 1,
  ILLEGAL_COMMAND: 2,
  USER_NOT_REGISTERED: 3,
  USER_ALREADY_REGISTERED: 4,
  USER_NOT_AUTHENTICATED: 5,
  NOT_ALLOWED: 6,
  DEVICE_NOT_IN_NETWORK: 7,
  NO_ACTIVE_DASHBOARD: 8,
  INVALID_TOKEN: 9,
  ILLEGAL_COMMAND_BODY: 11,
  NOTIFICATION_INVALID_BODY: 13,
  NOTIFICATION_NOT_AUTHORIZED: 14,
  NOTIFICATION_ERROR: 15,
  NO_DATA: 17,
  SERVER_ERROR: 19,
  ENERGY_LIMIT: 21,
  FACEBOOK_USER_LOGIN_WITH_PASS: 22,
} as const;

const responseNames = new Map<number, string>(
  Object.entries(ResponseCode).map(([name, code]) => [code, name]),
);

export function responseName(code: number): string {
  return responseNames.get(code) ?? `CODE_${code}`;
}
