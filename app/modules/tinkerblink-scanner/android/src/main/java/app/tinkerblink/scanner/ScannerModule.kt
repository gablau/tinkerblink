package app.tinkerblink.scanner

import android.app.Activity
import com.google.zxing.client.android.Intents
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Reads a QR code with the camera: opens the ZXing scanner screen (zxing-android-embedded), which also asks for
// the camera permission, and returns the text of the code, or null when the user goes back.
class ScannerModule : Module() {
  private var pending: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("TinkerBlinkScanner")

    AsyncFunction("scanQr") { prompt: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("E_NO_SCREEN", "The app is not in the foreground", null)
        return@AsyncFunction
      }
      // A scan still open (it should not happen): it ends as cancelled, the new one takes its place.
      pending?.resolve(null)
      pending = promise
      val options = ScanOptions()
        .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
        .setPrompt(prompt)
        .setBeepEnabled(false)
        .setOrientationLocked(false)
        .setCaptureActivity(QrScanScreen::class.java)
      activity.startActivityForResult(ScanContract().createIntent(activity, options), REQUEST_CODE)
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null
      // Read from the intent: the library getter is declared non-null but is null when the user goes back.
      val text = if (payload.resultCode == Activity.RESULT_OK) payload.data?.getStringExtra(Intents.Scan.RESULT) else null
      promise.resolve(text)
    }
  }

  private companion object {
    const val REQUEST_CODE = 0x5143 // "QC"
  }
}
