import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DooPush, type DooPushMessage } from 'doopush-react-native-sdk';

export default function HomeScreen() {
  const [out, setOut] = useState<string>('not registered');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<DooPushMessage[]>([]);

  useEffect(() => {
    const sub = DooPush.addMessageListener((m) => {
      setMessages((prev) => [m, ...prev].slice(0, 20));
    });
    return () => sub.remove();
  }, []);

  const onRegister = async () => {
    setError(null);
    setOut('registering…');
    try {
      // TODO: replace with your DooPush credentials before running.
      // Match the values you set in app.json's plugin block (configure runs at JS-side
      // and is the source of truth for runtime; the plugin config is for native side).
      DooPush.configure({
        appId: 'your_app_id',
        apiKey: 'your_api_key',
        baseURL: 'https://doopush.com/api/v1',
      });
      const r = await DooPush.register();
      setOut(`token: ${r.token.slice(0, 24)}…\ndeviceId: ${r.deviceId}\nvendor: ${r.vendor}`);
    } catch (e: any) {
      setError(e.message ?? String(e));
      setOut('failed');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>DooPush RN SDK v0.1.0</Text>
      <View style={styles.row}>
        <Button title="Configure + Register" onPress={onRegister} />
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Result:</Text>
        <Text style={styles.mono}>{out}</Text>
      </View>
      {error && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: 'red' }]}>Error:</Text>
          <Text style={[styles.mono, { color: 'red' }]}>{error}</Text>
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.label}>Messages ({messages.length}):</Text>
        {messages.length === 0 && <Text style={styles.mono}>(none yet — send a push to test)</Text>}
        {messages.map((m, i) => (
          <View key={i} style={styles.msg}>
            <Text style={styles.bold}>{m.title ?? '(no title)'}</Text>
            <Text>{m.body ?? '(no body)'}</Text>
            <Text style={styles.mono}>{JSON.stringify(m.data)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 80, gap: 20 },
  h1: { fontSize: 22, fontWeight: 'bold' },
  row: { marginVertical: 10 },
  section: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  mono: { fontFamily: 'Courier', fontSize: 13 },
  msg: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    gap: 4,
  },
  bold: { fontWeight: '700' },
});
