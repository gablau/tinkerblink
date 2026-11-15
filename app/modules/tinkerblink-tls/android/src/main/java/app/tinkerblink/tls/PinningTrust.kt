package app.tinkerblink.tls

import android.content.Context
import android.net.http.X509TrustManagerExtensions
import com.facebook.react.modules.network.CustomClientBuilder
import com.facebook.react.modules.network.NetworkingModule
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.modules.websocket.WebSocketModule
import java.io.File
import java.net.Socket
import java.security.KeyStore
import java.security.MessageDigest
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.Properties
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLEngine
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManager
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509ExtendedTrustManager
import javax.net.ssl.X509TrustManager
import okhttp3.internal.tls.OkHostnameVerifier

// Certificates trusted by the user ("Trust this certificate"), one per server: the SHA-256 of the server
// certificate (leaf, DER) under "host:port". The system check (network_security_config: system CAs and the
// bundled Let's Encrypt roots) always comes first; only when it fails, the certificate is accepted if it is
// exactly the one trusted for that host and port. A different certificate (renewed, or someone in the middle)
// fails as before. Nothing is ever accepted without a check.

/** Trusted fingerprints, kept in memory and in files/tls-pins.properties (private to the app). */
internal object Pins {
  @Volatile private var file: File? = null
  private val pins = Properties()

  @Synchronized
  fun init(context: Context) {
    if (file != null) return
    val f = File(context.applicationContext.filesDir, "tls-pins.properties")
    if (f.exists()) runCatching { f.inputStream().use { pins.load(it) } }
    file = f
  }

  @Synchronized
  private fun save() {
    val f = file ?: return
    val tmp = File(f.parentFile, "${f.name}.tmp")
    tmp.outputStream().use { pins.store(it, "TinkerBlink trusted server certificates (SHA-256)") }
    if (!tmp.renameTo(f)) {
      tmp.copyTo(f, overwrite = true)
      tmp.delete()
    }
  }

  private fun key(host: String, port: Int) = "${host.lowercase().trim('[', ']')}:$port"

  @Synchronized
  fun get(host: String, port: Int): String? = pins.getProperty(key(host, port))

  @Synchronized
  fun set(host: String, port: Int, sha256: String) {
    pins.setProperty(key(host, port), sha256.lowercase())
    save()
  }

  @Synchronized
  fun remove(host: String, port: Int) {
    pins.remove(key(host, port))
    save()
  }

  @Synchronized
  fun all(): Map<String, String> = pins.stringPropertyNames().associateWith { pins.getProperty(it) }

  fun matches(host: String?, port: Int, cert: X509Certificate?): Boolean {
    if (host == null || port <= 0 || cert == null) return false
    val pinned = get(host, port) ?: return false
    return MessageDigest.isEqual(pinned.toByteArray(), sha256(cert).toByteArray())
  }
}

internal fun sha256(cert: X509Certificate): String =
  MessageDigest.getInstance("SHA-256").digest(cert.encoded).joinToString("") { "%02x".format(it) }

/** The platform trust manager: on Android 7+ it follows network_security_config. */
internal fun systemTrustManager(): X509TrustManager {
  val factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
  factory.init(null as KeyStore?)
  return factory.trustManagers.filterIsInstance<X509TrustManager>().first()
}

/** System check for a host, as OkHttp would do it (null = trusted, otherwise the reason). */
internal fun systemVerdict(chain: Array<X509Certificate>, authType: String, host: String): String? =
  try {
    X509TrustManagerExtensions(systemTrustManager()).checkServerTrusted(chain, authType, host)
    null
  } catch (e: Exception) {
    e.message ?: e.javaClass.simpleName
  }

internal class PinningTrustManager(private val system: X509TrustManager) : X509ExtendedTrustManager() {
  override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String, socket: Socket?) {
    try {
      if (system is X509ExtendedTrustManager) system.checkServerTrusted(chain, authType, socket)
      else system.checkServerTrusted(chain, authType)
    } catch (e: CertificateException) {
      val ssl = socket as? SSLSocket
      val host = ssl?.handshakeSession?.peerHost ?: socket?.inetAddress?.hostName
      if (Pins.matches(host, socket?.port ?: -1, chain.firstOrNull())) return
      throw e
    }
  }

  override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String, engine: SSLEngine?) {
    try {
      if (system is X509ExtendedTrustManager) system.checkServerTrusted(chain, authType, engine)
      else system.checkServerTrusted(chain, authType)
    } catch (e: CertificateException) {
      if (Pins.matches(engine?.peerHost, engine?.peerPort ?: -1, chain.firstOrNull())) return
      throw e
    }
  }

  // Without a socket the host is unknown: system check only.
  override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) = system.checkServerTrusted(chain, authType)

  override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String, socket: Socket?) =
    system.checkClientTrusted(chain, authType)

  override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String, engine: SSLEngine?) =
    system.checkClientTrusted(chain, authType)

  override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = system.checkClientTrusted(chain, authType)

  override fun getAcceptedIssuers(): Array<X509Certificate> = system.acceptedIssuers
}

/** Standard host name check, or the trusted certificate of that host and port (whatever names it has). */
internal val pinningHostnameVerifier = HostnameVerifier { host, session ->
  OkHostnameVerifier.verify(host, session) ||
    try {
      Pins.matches(host, session.peerPort, session.peerCertificates.firstOrNull() as? X509Certificate)
    } catch (_: Exception) {
      false
    }
}

/** Puts the pinning trust manager into the OkHttp clients of React Native: WebSocket and fetch. */
internal object TlsInstaller {
  @Volatile private var installed = false

  @Synchronized
  fun install(context: Context) {
    Pins.init(context)
    if (installed) return
    useNewContext()
    installed = true
  }

  /**
   * After trusting or forgetting a certificate. A resumed TLS session does not go through the trust manager:
   * without this, a forgotten certificate would still work until the app restarts. The client session cache
   * cannot be emptied (Conscrypt does not list its sessions), so a new SSLContext, with an empty cache, takes
   * the place of the old one, and the open connections are closed.
   */
  @Synchronized
  fun resetSessions() {
    if (!installed) return
    try {
      useNewContext()
      OkHttpClientProvider.getOkHttpClient().connectionPool.evictAll()
    } catch (e: Exception) {
      android.util.Log.w("TinkerBlinkTls", "TLS session reset failed", e)
    }
  }

  private fun useNewContext() {
    val trustManager = PinningTrustManager(systemTrustManager())
    val sslContext = SSLContext.getInstance("TLS").apply { init(null, arrayOf<TrustManager>(trustManager), null) }
    val builder = CustomClientBuilder { b ->
      b.sslSocketFactory(sslContext.socketFactory, trustManager).hostnameVerifier(pinningHostnameVerifier)
    }
    WebSocketModule.setCustomClientBuilder(builder)
    NetworkingModule.setCustomClientBuilder(builder)
  }
}
