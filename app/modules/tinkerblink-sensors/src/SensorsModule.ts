import { NativeModule, requireNativeModule } from 'expo';
import type { SensorsEvents } from './Sensors.types';

declare class SensorsModule extends NativeModule<SensorsEvents> {
  isAvailable(type: number): boolean;
  start(type: number): boolean;
  stop(type: number): void;
}

export default requireNativeModule<SensorsModule>('TinkerBlinkSensors');
