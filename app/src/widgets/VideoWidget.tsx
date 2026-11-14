// Video Streaming: while the dashboard is running the stream starts by itself,
// a tap pauses or resumes it, a spinner shows while loading and a message on error.
//
// Player: expo-video (Media3/ExoPlayer on Android) with the RTSP module added by plugins/withMedia3Rtsp.js.
// Media3 tries RTP over UDP and, if nothing arrives, switches to TCP. Audio is muted.
// Browsers cannot play RTSP: on the web a notice is shown (a gateway would be needed).
//
// The URL contains the camera credentials: never show it or write it to the logs.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { useWidgetProps } from '@/session/hooks';
import { FONT } from '@/ui/fonts';
import { useLabel, WidgetFrame, type WidgetViewProps } from './WidgetFrame';

/** Accepted URLs: only the scheme is checked. */
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
