// Copy of the native splash drawn by the app: shown while the automatic login runs, so that with saved
// credentials the login form does not flash. Same colors and image as the splash in app.json
// (expo-splash-screen), at the same size (imageWidth 220), so the transition is invisible.
import { Image, StyleSheet, useColorScheme, View } from 'react-native';

const LIGHT = { background: '#EEF2F0', image: require('../../assets/splash-icon.png') };
const DARK = { background: '#12202A', image: require('../../assets/splash-icon-dark.png') };

export function SplashView() {
  const look = useColorScheme() === 'dark' ? DARK : LIGHT;
  return (
    <View style={[styles.screen, { backgroundColor: look.background }]}>
      <Image source={look.image} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: 220, height: 220 },
});
