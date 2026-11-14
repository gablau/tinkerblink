// There are no sensors on the web: everything is reported as unavailable.
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
