package app.tinkerblink.tls

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.InetSocketAddress
import java.net.Socket
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLEngine
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManager
import javax.net.ssl.X509ExtendedTrustManager
import okhttp3.internal.tls.OkHostnameVerifier

private const val TIMEOUT_MS = 10_000

// "Trust this certificate": the JS side asks for the server certificate (inspect), shows it, and if the user
// confirms stores its SHA-256 for that host and port (trust). From then on PinningTrust accepts exactly that
// certificate for that server, in the WebSocket and in fetch (GPS HTTP API).
class TlsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TinkerBlinkTls")

    OnCreate { appContext.reactContext?.let { TlsInstaller.install(it) } }

    /** Installs the trust manager in the React Native clients (also done on creation): before the first connection. */
    Function("install") {
      val context = appContext.reactContext ?: throw CodedException("NoContext", "React context not available", null)
      TlsInstaller.install(context)
    }

    Function("trusted") { Pins.all() }

    Function("trust") { host: String, port: Int, sha256: String ->
      require(Regex("^[0-9a-fA-F]{64}$").matches(sha256)) { "Not a SHA-256 fingerprint" }
      Pins.set(host, port, sha256)
      TlsInstaller.resetSessions()
    }

    Function("forget") { host: String, port: Int ->
      Pins.remove(host, port)
      TlsInstaller.resetSessions()
    }

    /**
     * Reads the certificate chain of host:port with a TLS handshake that is always interrupted after the server
     * certificate (no data is sent), and tells what the system thinks of it.
     */
    AsyncFunction("inspect") { host: String, port: Int ->
      var chain: Array<X509Certificate>? = null
      var authType = "ECDHE_RSA"
      val capture = object : X509ExtendedTrustManager() {
        private fun record(c: Array<X509Certificate>, a: String): Nothing {
          chain = c
          authType = a
          throw CertificateException("Certificate read for inspection: connection interrupted")
        }

        override fun checkServerTrusted(c: Array<X509Certificate>, a: String, s: Socket?) = record(c, a)
        override fun checkServerTrusted(c: Array<X509Certificate>, a: String, e: SSLEngine?) = record(c, a)
        override fun checkServerTrusted(c: Array<X509Certificate>, a: String) = record(c, a)
        override fun checkClientTrusted(c: Array<X509Certificate>, a: String, s: Socket?) = throw CertificateException("Not a server")
        override fun checkClientTrusted(c: Array<X509Certificate>, a: String, e: SSLEngine?) = throw CertificateException("Not a server")
        override fun checkClientTrusted(c: Array<X509Certificate>, a: String) = throw CertificateException("Not a server")
        override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
      }
      val sslContext = SSLContext.getInstance("TLS").apply { init(null, arrayOf<TrustManager>(capture), null) }
      val raw = Socket()
      try {
        raw.connect(InetSocketAddress(host, port), TIMEOUT_MS)
        raw.soTimeout = TIMEOUT_MS
        val ssl = sslContext.socketFactory.createSocket(raw, host, port, true) as SSLSocket
        try {
          ssl.startHandshake()
        } catch (_: Exception) {
          // expected: capture always interrupts the handshake
        } finally {
          ssl.close()
        }
      } finally {
        raw.close()
      }

      val certs = chain ?: throw CodedException("NoCertificate", "The server did not send a certificate", null)
      val leaf = certs[0]
      val verdict = systemVerdict(certs, authType, host)
      val names = leaf.subjectAlternativeNames
        ?.filter { it.size >= 2 && (it[0] == 2 || it[0] == 7) }
        ?.map { it[1].toString() }
        ?: emptyList()
      mapOf(
        "host" to host,
        "port" to port,
        "sha256" to sha256(leaf),
        "subject" to leaf.subjectX500Principal.name,
        "issuer" to leaf.issuerX500Principal.name,
        "altNames" to names,
        "notBefore" to leaf.notBefore.time.toDouble(),
        "notAfter" to leaf.notAfter.time.toDouble(),
        "selfSigned" to (leaf.subjectX500Principal == leaf.issuerX500Principal),
        "chainLength" to certs.size,
        "systemTrusted" to (verdict == null),
        "systemError" to verdict,
        "hostnameMatches" to OkHostnameVerifier.verify(host, leaf),
        "pinned" to Pins.get(host, port),
      )
    }
  }
}
