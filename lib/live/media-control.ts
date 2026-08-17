const MEDIAMTX_API_BASE = process.env.LIVE_MEDIAMTX_API_URL;

/**
 * MediaMTXのControl API経由でパブリッシャー接続を強制切断する。
 * インフラ未構築の環境やAPI呼び出し失敗時は握りつぶし、DB上のstatus変更だけは常に成立させる。
 * 実際のAPIパスはdocs/vps-deployment.mdのMediaMTXセットアップに合わせて調整する。
 */
export async function kickPublisher(streamKey: string) {
  if (!MEDIAMTX_API_BASE) {
    return;
  }

  try {
    await fetch(`${MEDIAMTX_API_BASE}/v3/paths/kick/live/${encodeURIComponent(streamKey)}`, {
      method: "POST",
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // 配信サーバー側の切断は失敗してもよい(次のpublish-endまたは視聴者側の再接続失敗で自然に解消する)。
  }
}

/**
 * OBSからの入稿パス(live/{streamKey})とは別名で視聴用パス(live/{viewToken})を動的に登録する。
 * ストリームキー(秘匿情報)を視聴URLに一切露出させないための中継設定で、MediaMTXの
 * 「pathがsourceとして別ローカルパスをpullできる」機能を使う。viewTokenが再発行された場合は
 * 古いパスをunregisterし、新しいviewTokenで再登録する。
 * 詳細はdocs/vps-deployment.mdのMediaMTX設定例を参照。
 */
export async function registerViewRelay(streamKey: string, viewToken: string) {
  if (!MEDIAMTX_API_BASE) {
    return;
  }

  try {
    await fetch(`${MEDIAMTX_API_BASE}/v3/config/paths/add/live/${encodeURIComponent(viewToken)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: `rtmp://127.0.0.1:1935/live/${streamKey}`,
        sourceOnDemand: false,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // 中継パスの登録に失敗しても入稿(OBS側)は継続させ、次のsweep/再接続で復旧を試みる。
  }
}

export async function unregisterViewRelay(viewToken: string) {
  if (!MEDIAMTX_API_BASE) {
    return;
  }

  try {
    await fetch(`${MEDIAMTX_API_BASE}/v3/config/paths/delete/live/${encodeURIComponent(viewToken)}`, {
      method: "POST",
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // 削除に失敗してもTTLやOFFLINE遷移で実害は限定的。
  }
}
