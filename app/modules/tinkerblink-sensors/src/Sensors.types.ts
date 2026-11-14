export interface SensorEvent {
  /** android.hardware.Sensor constant (1 accelerometer, 9 gravity, 5 light, 8 proximity, 6 pressure,
   *  12 humidity, 13 temperature). */
  type: number;
  values: number[];
  maxRange: number;
}

export type SensorsEvents = {
  onSensor: (event: SensorEvent) => void;
};
