// Sul web non ci sono sensori: tutto risulta non disponibile.
import { NativeModule, registerWebModule } from 'expo';
import type { SensorsEvents } from './Sensors.types';

class SensorsModule extends NativeModule<SensorsEvents> {
  isAvailable(_type: number): boolean {
    return false;
  }
  start(_type: number): boolean {
    return false;
  }
  stop(_type: number): void {}
}

export default registerWebModule(SensorsModule, 'SensorsModule');
