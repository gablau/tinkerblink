export interface SensorEvent {
  /** Costante di android.hardware.Sensor (1 accelerometro, 9 gravità, 5 luce, 8 prossimità, 6 pressione, 12 umidità, 13 temperatura). */
  type: number;
  values: number[];
  maxRange: number;
}

export type SensorsEvents = {
  onSensor: (event: SensorEvent) => void;
};
