import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  DooPush,
  type DooPushDeviceInfo,
  type DooPushMessage,
  type DooPushPermissionStatus,
} from 'doopush-react-native-sdk';

// 与 app.json plugin 配置保持一致（JS 侧 configure 是运行时真源）
const CONFIG = {
  appId: '1',
  apiKey: 'dp_live_Ud7gxj1dHnbivXMulAShhIjES1py8X1g',
  baseURL: 'https://doopush.com/api/v1',
};
const SDK_VERSION = '0.5.1';

type SdkStatus = 'notConfigured' | 'configured' | 'registering' | 'registered' | 'failed';
type GatewayStatus = 'disconnected' | 'connected' | 'error';

const SDK_STATUS_TEXT: Record<SdkStatus, string> = {
  notConfigured: '未配置',
  configured: '已配置',
  registering: '注册中…',
  registered: '已注册',
  failed: '注册失败',
};

const SDK_STATUS_COLOR: Record<SdkStatus, string> = {
  notConfigured: '#9aa0a6',
  configured: '#f5a623',
  registering: '#f5a623',
  registered: '#34c759',
  failed: '#ff3b30',
};

const PERMISSION_TEXT: Record<DooPushPermissionStatus, string> = {
  authorized: '已授权',
  denied: '已拒绝',
  notDetermined: '未确定',
  provisional: '临时授权',
  ephemeral: '短期授权',
  unknown: '未知',
};

const PERMISSION_COLOR: Record<DooPushPermissionStatus, string> = {
  authorized: '#34c759',
  denied: '#ff3b30',
  notDetermined: '#f5a623',
  provisional: '#f5a623',
  ephemeral: '#f5a623',
  unknown: '#9aa0a6',
};

type HistoryItem = DooPushMessage & { id: string; receivedAt: number };

export default function HomeScreen() {
  const [sdkStatus, setSdkStatus] = useState<SdkStatus>('notConfigured');
  const [permission, setPermission] = useState<DooPushPermissionStatus | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DooPushDeviceInfo | null>(null);
  const [badge, setBadge] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [gateway, setGateway] = useState<GatewayStatus>('disconnected');
  const [gatewayDetail, setGatewayDetail] = useState<string>('');
  const [gatewayErrCount, setGatewayErrCount] = useState<number>(0);
  const [gwLog, setGwLog] = useState<string[]>([]);
  const gwOpenAtRef = useRef<number | null>(null);

  const pushGwLog = useCallback((line: string) => {
    const t = new Date().toLocaleTimeString();
    setGwLog((prev) => [`${t}  ${line}`, ...prev].slice(0, 10));
  }, []);
  const heldStr = () =>
    gwOpenAtRef.current ? `（保持 ${((Date.now() - gwOpenAtRef.current) / 1000).toFixed(1)}s）` : '（未曾连上）';

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const refreshBadge = useCallback(async () => {
    try {
      setBadge(await DooPush.getBadge());
    } catch {
      /* ignore */
    }
  }, []);

  const loadDeviceState = useCallback(async () => {
    try {
      const [tk, did, info] = await Promise.all([
        DooPush.getDeviceToken(),
        DooPush.getDeviceId(),
        DooPush.getDeviceInfo(),
      ]);
      setToken(tk);
      setDeviceId(did);
      setDeviceInfo(info);
      if (tk) setSdkStatus((s) => (s === 'registering' ? s : 'registered'));
    } catch {
      /* ignore */
    }
  }, []);

  // 启动时 configure + 加载已有状态（对齐 iOS 的 checkAutoRegister）
  useEffect(() => {
    DooPush.configure(CONFIG);
    setSdkStatus('configured');
    loadDeviceState();
    refreshBadge();
    DooPush.checkPermissionStatus().then(setPermission).catch(() => {});

    const subs = [
      DooPush.addMessageListener((m) => {
        setHistory((prev) => {
          if (m.dedupKey && prev.some((p) => p.dedupKey === m.dedupKey)) return prev;
          const item: HistoryItem = { ...m, id: `${Date.now()}-${Math.random()}`, receivedAt: Date.now() };
          return [item, ...prev].slice(0, 50);
        });
      }),
      DooPush.addGatewayOpenListener(() => {
        gwOpenAtRef.current = Date.now();
        setGateway('connected');
        setGatewayDetail('握手鉴权成功，心跳保持中');
        pushGwLog('OPEN 已连接');
      }),
      DooPush.addGatewayClosedListener((e) => {
        setGateway('disconnected');
        setGatewayDetail(`已关闭 code=${e.code}${e.reason ? ` ${e.reason}` : ''}`);
        pushGwLog(`CLOSE code=${e.code}${e.reason ? ` ${e.reason}` : ''} ${heldStr()}`);
        gwOpenAtRef.current = null;
      }),
      DooPush.addGatewayErrorListener((e) => {
        setGateway('error');
        setGatewayDetail(e.message);
        setGatewayErrCount((c) => c + 1);
        pushGwLog(`ERROR ${e.message} ${heldStr()}`);
        gwOpenAtRef.current = null;
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [loadDeviceState, refreshBadge, pushGwLog]);

  const onRegister = async () => {
    setError(null);
    setSdkStatus('registering');
    try {
      DooPush.configure(CONFIG);
      const r = await DooPush.register();
      setToken(r.token);
      setDeviceId(r.deviceId);
      setSdkStatus('registered');
      await Promise.all([loadDeviceState(), refreshBadge()]);
      const p = await DooPush.checkPermissionStatus();
      setPermission(p);
      flash('注册成功');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setSdkStatus('failed');
      flash('注册失败');
    }
  };

  const onUpdateDevice = async () => {
    setError(null);
    try {
      await DooPush.updateDeviceInfo();
      await loadDeviceState();
      flash('设备信息更新成功');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      flash('更新失败');
    }
  };

  const onCheckPermission = async () => {
    try {
      const p = await DooPush.checkPermissionStatus();
      setPermission(p);
      flash(`推送权限：${PERMISSION_TEXT[p]}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const setBadgeTo = async (n: number) => {
    try {
      await DooPush.setBadge(n);
      await refreshBadge();
    } catch (e: any) {
      flash(e?.message ?? '角标设置失败');
    }
  };
  const clearBadgeNow = async () => {
    try {
      await DooPush.clearBadge();
      await refreshBadge();
    } catch (e: any) {
      flash(e?.message ?? '角标清除失败');
    }
  };

  const connectGw = async () => {
    try {
      await DooPush.connectGateway();
      flash('已发起网关连接');
    } catch (e: any) {
      flash(e?.message ?? '网关连接失败');
    }
  };
  const disconnectGw = async () => {
    try {
      await DooPush.disconnectGateway();
      setGateway('disconnected');
      setGatewayDetail('已手动断开');
    } catch (e: any) {
      flash(e?.message ?? '网关断开失败');
    }
  };

  const gatewayColor =
    gateway === 'connected' ? '#34c759' : gateway === 'error' ? '#ff3b30' : '#9aa0a6';
  const gatewayText =
    gateway === 'connected' ? '已连接' : gateway === 'error' ? '错误' : '已断开';

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* 头部 */}
        <View style={styles.header}>
          <Text style={styles.title}>DooPush SDK 示例</Text>
          <Text style={styles.subtitle}>React Native · SDK {SDK_VERSION}</Text>
        </View>

        {/* SDK 状态 */}
        <Section title="SDK 状态">
          <StatusRow
            label="SDK 状态"
            text={SDK_STATUS_TEXT[sdkStatus]}
            color={SDK_STATUS_COLOR[sdkStatus]}
          />
          <StatusRow
            label="推送权限"
            text={permission ? PERMISSION_TEXT[permission] : '未检查'}
            color={permission ? PERMISSION_COLOR[permission] : '#9aa0a6'}
          />
          {error && <Text style={styles.error}>⚠️ {error}</Text>}
        </Section>

        {/* 设备信息 */}
        <Section title="设备信息">
          <KV label="设备 Token" value={token ?? '未获取'} mono selectable />
          <KV label="设备 ID" value={deviceId ?? '未获取'} mono selectable />
          <KV label="设备型号" value={deviceInfo ? `${deviceInfo.brand} ${deviceInfo.model}` : '—'} />
          <KV label="系统版本" value={deviceInfo ? `${deviceInfo.platform} ${deviceInfo.systemVersion}` : '—'} />
          <KV label="推送渠道" value={deviceInfo?.channel ?? '—'} />
          <KV label="Bundle ID" value={deviceInfo?.bundleId ?? '—'} />
          <KV label="应用版本" value={deviceInfo?.appVersion ?? '—'} />
        </Section>

        {/* 操作 */}
        <Section title="操作">
          <Btn title="注册推送通知" color="#34c759" onPress={onRegister} disabled={sdkStatus === 'registering'} />
          <Btn title="更新设备信息" color="#007aff" onPress={onUpdateDevice} />
          <Btn title="检查权限" color="#f5a623" onPress={onCheckPermission} />
          <Btn title="前往系统设置" color="#8e8e93" onPress={() => Linking.openSettings()} />
        </Section>

        {/* 角标管理 */}
        <Section title="角标管理">
          <KV label="当前角标数字" value={String(badge)} />
          <View style={styles.btnGrid}>
            <Btn small title="设为 5" color="#007aff" onPress={() => setBadgeTo(5)} />
            <Btn small title="设为 10" color="#007aff" onPress={() => setBadgeTo(10)} />
            <Btn small title="角标 +1" color="#34c759" onPress={() => setBadgeTo(badge + 1)} />
            <Btn small title="角标 -1" color="#f5a623" onPress={() => setBadgeTo(Math.max(0, badge - 1))} />
            <Btn small title="随机" color="#af52de" onPress={() => setBadgeTo(Math.floor(Math.random() * 99) + 1)} />
            <Btn small title="清除" color="#ff3b30" onPress={clearBadgeNow} />
          </View>
        </Section>

        {/* 网关（WebSocket 长连接） */}
        <Section title="网关连接">
          <StatusRow label="状态" text={gatewayText} color={gatewayColor} />
          {!!gatewayDetail && <Text style={styles.hint}>{gatewayDetail}</Text>}
          {gatewayErrCount > 0 && (
            <Text style={styles.hint}>累计错误 {gatewayErrCount} 次（连接噪声，不影响 APNs 推送投递）</Text>
          )}
          <View style={styles.btnGrid}>
            <Btn small title="连接" color="#007aff" onPress={connectGw} />
            <Btn small title="断开" color="#8e8e93" onPress={disconnectGw} />
          </View>
          {gwLog.length > 0 && (
            <View style={styles.payload}>
              {gwLog.map((l, i) => (
                <Text key={i} style={styles.mono}>{l}</Text>
              ))}
            </View>
          )}
        </Section>

        {/* 通知历史 */}
        <Section title={`通知历史 (${history.length})`}>
          {history.length === 0 && <Text style={styles.hint}>暂无推送通知 —— 发一条推送试试</Text>}
          {history.map((m) => {
            const open = expanded === m.id;
            return (
              <Pressable
                key={m.id}
                style={styles.notif}
                onPress={() => setExpanded(open ? null : m.id)}
              >
                <Text style={styles.notifTitle}>{m.title ?? '(无标题)'}</Text>
                <Text style={styles.notifBody}>{m.body ?? '(无内容)'}</Text>
                <Text style={styles.notifTime}>{new Date(m.receivedAt).toLocaleString()}</Text>
                {open && (
                  <View style={styles.payload}>
                    {!!m.dedupKey && <Text style={styles.mono}>dedupKey: {m.dedupKey}</Text>}
                    {!!m.pushLogId && <Text style={styles.mono}>pushLogId: {m.pushLogId}</Text>}
                    {!!m.messageId && <Text style={styles.mono}>messageId: {m.messageId}</Text>}
                    {!!m.vendor && <Text style={styles.mono}>vendor: {m.vendor}</Text>}
                    <Text style={[styles.mono, { marginTop: 4 }]} selectable>
                      data: {JSON.stringify(m.data, null, 2)}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          {history.length > 0 && (
            <Btn title="清空历史" color="#ff3b30" onPress={() => setHistory([])} />
          )}
        </Section>

        {/* 配置信息 */}
        <Section title="配置信息">
          <KV label="应用 ID" value={CONFIG.appId} selectable />
          <KV label="API 密钥" value={CONFIG.apiKey} mono selectable />
          <KV label="服务器地址" value={CONFIG.baseURL} selectable />
          <KV label="SDK 版本" value={SDK_VERSION} />
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>

      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function StatusRow({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <View style={styles.statusValue}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.kvValue}>{text}</Text>
      </View>
    </View>
  );
}

function KV({
  label,
  value,
  mono,
  selectable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  selectable?: boolean;
}) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text
        style={[styles.kvValue, mono && styles.mono, { flexShrink: 1, textAlign: 'right' }]}
        selectable={selectable}
        numberOfLines={mono ? 1 : 2}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}

function Btn({
  title,
  color,
  onPress,
  disabled,
  small,
}: {
  title: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: color, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={styles.btnText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f2f2f7' },
  container: { padding: 16, paddingTop: 64 },
  header: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#1c1c1e' },
  subtitle: { fontSize: 13, color: '#8e8e93', marginTop: 4 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#8e8e93', marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, gap: 2 },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  kvLabel: { fontSize: 15, color: '#1c1c1e' },
  kvValue: { fontSize: 14, color: '#6c6c70' },
  statusValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  mono: { fontFamily: 'Courier', fontSize: 12 },
  error: { color: '#ff3b30', fontSize: 13, paddingVertical: 8 },
  hint: { color: '#8e8e93', fontSize: 13, paddingVertical: 8 },
  btn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 6,
  },
  btnSmall: { flexGrow: 1, flexBasis: '30%', paddingVertical: 10, marginVertical: 0 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 },
  notif: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    gap: 3,
  },
  notifTitle: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  notifBody: { fontSize: 14, color: '#3a3a3c' },
  notifTime: { fontSize: 11, color: '#8e8e93' },
  payload: { marginTop: 6, padding: 8, backgroundColor: '#f2f2f7', borderRadius: 8, gap: 2 },
  toast: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.82)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
  },
  toastText: { color: '#fff', fontSize: 14 },
});
