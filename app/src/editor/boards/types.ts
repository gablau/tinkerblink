// Format of the board files (Blynk board definitions, MIT license): pin map per type.
export interface BoardJson {
  name: string;
  /** Link to the board documentation the pin map comes from (optional). */
  based_on?: string;
  map: {
    digital?: { pins: Record<string, number>; ops?: string[] };
    analog?: { pins: Record<string, number>; ops?: string[] };
    pwm?: { pins: string[]; ops?: string[] };
    virtual?: { pinsRange: [number, number]; ops?: string[] };
  };
}
