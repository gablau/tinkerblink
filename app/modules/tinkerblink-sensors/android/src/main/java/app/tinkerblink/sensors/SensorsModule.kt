package app.tinkerblink.sensors

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Sensori del telefono per i widget Accelerometer, Gravity, Light, Proximity, Barometer, Humidity e
// Temperature. Il tipo è la costante di android.hardware.Sensor (1, 9, 5, 8, 6, 12, 13); la
// registrazione usa SENSOR_DELAY_NORMAL. Ogni evento arriva a JS come
// "onSensor" { type, values, maxRange }: formato e frequenza d'invio li decide il lato JS.
class SensorsModule : Module() {
  private val manager: SensorManager?
    get() = appContext.reactContext?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  private val active = mutableMapOf<Int, Sensor>()

  private val listener = object : SensorEventListener {
    override fun onSensorChanged(event: SensorEvent) {
      sendEvent(
        "onSensor",
        mapOf(
          "type" to event.sensor.type,
          "values" to event.values.map { it.toDouble() },
          "maxRange" to event.sensor.maximumRange.toDouble(),
        ),
      )
    }

    override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
  }

  override fun definition() = ModuleDefinition {
    Name("TinkerBlinkSensors")

    Events("onSensor")

    Function("isAvailable") { type: Int ->
      manager?.getDefaultSensor(type) != null
    }

    Function("start") { type: Int ->
      if (active.containsKey(type)) return@Function true
      val m = manager ?: return@Function false
      val sensor = m.getDefaultSensor(type) ?: return@Function false
      m.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
      active[type] = sensor
      true
    }

    Function("stop") { type: Int ->
      val sensor = active.remove(type) ?: return@Function
      manager?.unregisterListener(listener, sensor)
    }

    OnDestroy {
      manager?.unregisterListener(listener)
      active.clear()
    }
  }
}
