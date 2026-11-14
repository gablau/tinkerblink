// Formato dei file delle schede (definizioni delle schede Blynk, licenza MIT): mappa dei pin per tipo.
export interface BoardJson {
  name: string;
  /** Link alla documentazione della scheda da cui viene la mappa dei pin (facoltativo). */
  based_on?: string;
  map: {
    digital?: { pins: Record<string, number>; ops?: string[] };
    analog?: { pins: Record<string, number>; ops?: string[] };
    pwm?: { pins: string[]; ops?: string[] };
    virtual?: { pinsRange: [number, number]; ops?: string[] };
  };
}
