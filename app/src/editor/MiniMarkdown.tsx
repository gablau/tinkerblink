// Minimal Markdown for the widget documentation texts: headings (#), code blocks (```), lists
// (- / *), paragraphs; inline **bold**, `code` and [links](url) (opened in the browser).
import { Linking, StyleSheet, Text, View } from 'react-native';
import { FONT } from '@/ui/fonts';
import { withAlpha } from '@/widgets/color';

type Block = { kind: 'h'; text: string } | { kind: 'code'; text: string } | { kind: 'li'; text: string } | { kind: 'p'; text: string };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split('\n');
  let para: string[] = [];
  const flush = () => {
    if (para.length > 0) blocks.push({ kind: 'p', text: para.join(' ').replace(/\s+/g, ' ').trim() });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith('```')) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i]!.trim().startsWith('```'); i++) code.push(lines[i]!);
      blocks.push({ kind: 'code', text: code.join('\n') });
    } else if (/^#{1,6}\s/.test(line)) {
      flush();
      blocks.push({ kind: 'h', text: line.replace(/^#+\s*/, '') });
    } else if (/^\s*[-*]\s+/.test(line)) {
      flush();
      blocks.push({ kind: 'li', text: line.replace(/^\s*[-*]\s+/, '') });
    } else if (line.trim() === '') {
      flush();
    } else {
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

/** Text with **bold**, `code` and [links](url). */
function Inline({ text, color, accent }: { text: string; color: string; accent: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter((p) => p !== '');
  return (
    <Text style={[styles.text, { color }]}>
      {parts.map((p, i) => {
        if (p.startsWith('**')) return <Text key={i} style={styles.bold}>{p.slice(2, -2)}</Text>;
        if (p.startsWith('`')) return <Text key={i} style={[styles.inlineCode, { backgroundColor: withAlpha(color, 0.1) }]}>{p.slice(1, -1)}</Text>;
        const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <Text key={i} style={{ color: accent, textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(link[2]!).catch(() => undefined)}>
              {link[1]}
            </Text>
          );
        }
        return p;
      })}
    </Text>
  );
}

export function MiniMarkdown({ text, color, accent }: { text: string; color: string; accent: string }) {
  return (
    <View style={styles.box}>
      {parse(text).map((b, i) => {
        switch (b.kind) {
          case 'h':
            return <Text key={i} style={[styles.heading, { color }]}>{b.text}</Text>;
          case 'code':
            return (
              <Text key={i} style={[styles.code, { color, backgroundColor: withAlpha(color, 0.08) }]}>
                {b.text}
              </Text>
            );
          case 'li':
            return (
              <View key={i} style={styles.li}>
                <Text style={[styles.text, { color }]}>•</Text>
                <View style={{ flex: 1 }}>
                  <Inline text={b.text} color={color} accent={accent} />
                </View>
              </View>
            );
          default:
            return <Inline key={i} text={b.text} color={color} accent={accent} />;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  text: { fontSize: 15, lineHeight: 21, fontFamily: FONT.regular },
  bold: { fontFamily: FONT.medium },
  heading: { fontSize: 16, fontFamily: FONT.medium, marginTop: 6 },
  code: { fontFamily: 'monospace', fontSize: 12.5, padding: 10, borderRadius: 4 },
  inlineCode: { fontFamily: 'monospace', fontSize: 13 },
  li: { flexDirection: 'row', gap: 8 },
});
