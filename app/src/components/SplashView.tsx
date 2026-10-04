// Copia dello splash nativo disegnata dall'app: si mostra mentre è in corso l'accesso automatico, così con le
// credenziali salvate non compare il modulo di login per un attimo. Stessi colori e stessa immagine dello splash
// di app.json (expo-splash-screen), nella stessa misura (imageWidth 220), quindi il passaggio non si vede.
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
