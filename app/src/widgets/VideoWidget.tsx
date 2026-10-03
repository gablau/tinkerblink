// Video Streaming: con la dashboard attiva lo stream parte da solo,
// un tocco mette in pausa o riprende, durante il caricamento c'è l'indicatore, in caso di errore un messaggio.
//
// Player: expo-video (Media3/ExoPlayer su Android) con il modulo RTSP aggiunto da plugins/withMedia3Rtsp.js.
// Media3 prova RTP su UDP e, se non arriva nulla, passa a TCP. L'audio è disattivato.
// Il browser non riproduce RTSP: sul web si mostra un avviso (servirebbe un gateway).
//
// L'URL contiene le credenziali della telecamera: non va mai mostrato né scritto nei log.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { useWidgetProps } from '@/session/hooks';
import { FONT } from '@/ui/fonts';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

/** URL accettati: si controlla solo lo schema. */
function validUrl(url: unknown): string | null {
  return typeof url === 'string' && /^(rtsp|rtsps|http|https):\/\//i.test(url.trim()) ? url.trim() : null;
}

export function VideoWidget({ dashId, widget, theme }: WidgetViewProps) {
  const label = useLabel(dashId, widget);
  const props = useWidgetProps(dashId, widget);
  const url = validUrl(props.url ?? widget.url);
  return (
    <WidgetFrame label={label} theme={theme}>
      <View style={[styles.box, { backgroundColor: '#000000' }]}>
        {!url ? (
          <Message text={t.videoEmpty} />
        ) : Platform.OS === 'web' && url.toLowerCase().startsWith('rtsp') ? (
          <Message text={t.videoNoRtspWeb} />
        ) : (
          <Player url={url} />
        )}
      </View>
    </WidgetFrame>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.message}>{text}</Text>
    </View>
  );
}

function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const toggle = () => {
    if (player.playing) player.pause();
    else {
      if (status === 'error') player.replace(url);
      player.play();
    }
  };
  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={toggle}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      {status === 'loading' && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}
      {status === 'error' && <Message text={t.videoError} />}
      {status === 'readyToPlay' && !isPlaying && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <MaterialCommunityIcons name="play-circle-outline" size={56} color="#FFFFFFCC" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, borderRadius: 6, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  message: { color: '#FFFFFF', opacity: 0.7, fontSize: 14, fontFamily: FONT.regular, textAlign: 'center' },
});
