# `/live/` ライブ配信機能 技術調査レポート

## 0. 調査依頼の整理

「`https://clipshare.link/live/` にライブ機能をつけたい。VRChatなどで使われるTopazChatの仕組みをウェブ上で管理し、放映することが技術的に可能か」という依頼を、以下の2つのレイヤーに分解して調査した。

- **レイヤーA: 配信管理・視聴のWeb化** — 配信者がRTMPで配信し、clipshare上の `/live/[user]` のようなページで視聴者がブラウザから見られる、一般的な「ライブ配信機能」
- **レイヤーB: VRChatワールドへのリアルタイム中継** — TopazChatが実際に提供している、配信映像/音声をVRChatのワールド内スクリーンにほぼ遅延なく表示させる仕組み

この2つは技術的難易度もインフラ要件もまったく異なるため、分けて評価する。結論を先に言うと、**レイヤーAは既存インフラの延長でほぼ実現可能。レイヤーBは技術的には可能だが、clipshareが単体で持つ既存スタック(VODのバッチHLS変換)とは別物のリアルタイム配信基盤が必要で、かつVRChat側の制約(URL許可リスト、プラットフォーム別プロトコル制限)に依存する部分が大きい**。

## 1. TopazChatの実際の仕組み(公開情報ベース)

TopazChatは「VRChat向け低遅延音声/映像配信サービス」であり、想像されがちな「字幕・チャットオーバーレイツール」とは違う。実態は **RTMP入稿 → VRChatワールド内蔵のビデオプレイヤーで低遅延再生** という配信リレーサービス。

- **配信(入稿)**: OBSまたは専用の「TopazChat Streamer」アプリから `rtmp://topaz.chat/live` へRTMP配信。ストリームキーはVRChatワールド内のPlayerオブジェクトに表示される値を使う。
- **配信基盤**: AWS上にWowza Streaming Engine相当のコアを配置し、RTMP入稿を受けてRTSPで配信する構成と報告されている。
- **VRChat側の受信**: ワールド制作者が組み込む「Player」プレハブが、VRC AVPro Video Player(SDK2)/ VRCAVProVideoPlayer(SDK3、Low Latencyモード)で `rtspt://topaz.chat/live/[StreamKey]` を再生する。
- **プラットフォーム制限**: RTSPはPC版クライアントでのみ動作し、Quest等のスタンドアロン/モバイルではAVProのRTSPサポートがないため使えない(MPEG-TS等の代替が必要とされる)。
- **低遅延の実現**: 一般的なHLS配信はセグメント方式のため数秒〜十数秒の遅延が乗るが、TopazChatはRTSP/RTP系のリアルタイムリレーを使うことで東京付近で1秒未満の遅延を実現していると説明されている。x264/NVENCの「ゼロレイテンシー」系プリセットはむしろ問題を起こすため使っていない、との記述もある。
- **帯域制限**: 映像は最大2000kbps、音声はAAC 320kbps固定(合計2.32Mbps超で強制切断)。後継の「TopazChat 2.0 Player」ではOBS配信かつ合計400kbps以下という、より厳しい低帯域モードも案内されている。この制限は低遅延維持とサーバー/VRChat側の負荷抑制が目的と見られる。
- **セルフホスト可否**: 配信者側の「Streamer」クライアントはMITライセンスだが、プロプライエタリ/LGPLのGStreamerバイナリに依存。**サーバー本体(配信基盤)はオープンソースではなく、セルフホスト不可**。商用利用は個別に問い合わせが必要とされている。

出典:
- [TopazChat GitHub](https://github.com/TopazChat/TopazChat)
- [TopazChat README](https://github.com/TopazChat/TopazChat/blob/main/README.md)
- [TopazChat 低遅延の仕組み解説(note)](https://note.com/doritos20/n/na1ebef7c1389)
- [TopazChat 2.0 Player 低ビットレートモード(X/Twitter, よしたか氏)](https://x.com/TyounanMOTI/status/1245016126364348416)
- [VRChat Wiki: Video players](https://wiki.vrchat.com/wiki/Video_players)

## 2. VRChat側の制約(レイヤーBに直結する重要事項)

VRChatのビデオプレイヤーは任意のURLを無条件に再生できるわけではなく、**URL許可リスト(Allowlist)制度**がある。

- VRChatはデフォルトで信頼済みドメイン(YouTube、Twitchなど)のリストを持っており、ビデオプレイヤーはそのドメインのURLしか基本的に再生しない。
- パブリックインスタンスでは、ワールド制作者が**最大10件までの「信頼できないURL」用カスタムドメイン**を追加登録できる(Untrusted URLs)。
- ユーザー自身がクライアント設定で「Allow Untrusted URLs」を有効にすれば、許可リスト外のURLも再生対象にできる(ただしセキュリティ上非推奨とされ、悪意あるコンテンツの危険性がある)。
- RTSPはPC版クライアントのみサポート。Quest等スタンドアロンはRTSP非対応で、MPEG-TS等の代替プロトコルが必要になる。

出典:
- [VRChat Creation Docs: Video Player Allowlist](https://creators.vrchat.com/worlds/udon/video-players/www-whitelist/)
- [VRChat Wiki: Trusted URLs](https://wiki.vrchat.com/wiki/Trusted_URLs)

**含意**: `clipshare.link` 発の映像を独自ワールドに常時表示するには、ワールド制作者側で `clipshare.link`(または配信サブドメイン)を許可リストに登録してもらうか、視聴者に「Allow Untrusted URLs」を有効にしてもらう必要がある。TopazChatが多くのワールドに「TopazChat Player」プレハブとして事前に組み込まれているのは、ワールド制作者コミュニティに長年浸透済みだからであり、新規サービスが同じ位置を取るには**ワールド制作者側への普及・許可リスト登録の働きかけ**という、purely技術以外のハードルが伴う。

## 3. clipshareの現行インフラで何ができるか

現行構成(`docs/vps-deployment.md`, `docs/overall-design.md` より):

- KAGOYA CLOUD VPS 1台(MVP本番4GBプラン、Ubuntu 24.04)、Nginx、MySQL、systemd、FFmpeg。Docker・Cloudflare不使用。
- 動画パイプラインは**バッチ処理のVOD変換**が前提: アップロード → FFmpegでHLS変換 → 静的ファイルとして`/media/`配下をNginxで配信。リアルタイム配信の仕組みは一切ない。
- フロントは既に `hls.js`(`package.json` に `^1.6.16`)を依存に持っており、**HLS再生プレイヤーの土台はすでにある**。
- バックグラウンドワーカー(`clipeshare-worker.service`)はジョブキュー型のFFmpeg変換用で、常駐のライブ配信サーバーではない。

この構成には、RTMPを受け付ける入稿サーバーも、低遅延で再配信するメディアサーバーも存在しない。ライブ機能を追加するには**新しいプロセス種別(常駐のメディアサーバー)を1つ増設する**ことになる。

## 4. レイヤーA: Web上でのライブ配信機能(視聴者向け)

### 4.1 技術構成案

```
配信者(OBS)
  → RTMP配信 (rtmp://live.clipshare.link/live/{streamKey})
  → メディアサーバー (例: MediaMTX / SRS / nginx-rtmp-module のいずれか)
       - RTMP入稿を受け、HLS(および可能ならLL-HLS)にリマックス/再エンコード
       - 必要ならサムネイル抽出、録画保存(アーカイブ化)
  → Nginxで `/live-media/{streamKey}/index.m3u8` を配信
  → `/live/[user]` ページで hls.js を使い再生(既存依存を流用)
  → 配信中フラグ・視聴者数・チャットはPrisma DB + WebSocket/SSEで管理
```

- **メディアサーバー候補**: [MediaMTX](https://github.com/bluenviron/mediamtx)(Go製、単一バイナリでRTMP/RTSP/HLS/WebRTC相互変換に対応、systemdサービス化しやすい)、[SRS](https://github.com/ossrs/srs)、または`nginx-rtmp-module`をNginxに追加ビルド。いずれもDocker不要でVPS上に直接インストール可能。
- **遅延**: 通常HLS(6秒セグメント×3)で20〜30秒程度の遅延。LL-HLS(部分セグメント配信、hls.jsもLL-HLS対応)にすれば数秒まで短縮可能。ただしTopazChat並み(1秒未満)は狙わない前提(視聴者がブラウザで見る用途ならLL-HLSで十分)。
- **再エンコードの要否**: リマックスのみ(コーデック変換なし)ならCPU負荷は小さいが、複数画質配信や録画同時生成を行うなら再エンコードが必要になりCPU負荷が跳ね上がる。4GBプランでは同時配信数を絞る必要がある(既存VOD変換の「同時変換数1」という制約と同種の考慮が要る)。
- **チャット/コメント**: WebSocket(Node.jsの`ws`など)かServer-Sent Eventsで実装可能。Next.jsの標準サーバーはWebSocketの常時接続に不向きなため、別プロセス(小さなNode.jsサーバー、または既存workerプロセスに相乗り)を用意するのが現実的。
- **帯域**: CDN(Cloudflare)を使わない前提のため、視聴者数が増えるとVPSの上り帯域を直接消費する。多人数同時視聴を想定するなら、将来的にCDN連携(Cloudflare Stream、あるいは単純なCloudflareのHLSキャッシュ)の検討が必要になる。

### 4.2 既存アーキテクチャとの親和性

- Prismaでの配信ステータス管理、Auth.jsでの配信者認証・ストリームキー発行、既存の投稿/OGP機構と同様のパターンで `/live/[username]` にOGPを出すことも自然にできる。
- 既存の `clipeshare-worker` とは別に `clipeshare-media`(仮)のsystemdサービスを追加する形になり、デプロイスクリプト(`scripts/deploy-server.sh`)の拡張は小さく済む。
- **これは「TopazChatの仕組み」というより一般的な自前ライブ配信基盤(Twitch/YouTube Liveのミニ版)であり、技術的には既存プロジェクトの延長として十分実現可能。**

## 5. レイヤーB: VRChatワールドへのリアルタイム中継

TopazChatと同じ体験(配信をVRChat内のスクリーンにほぼ遅延なく映す)を目指す場合、レイヤーAの上にさらに以下が必要になる。

1. **低遅延プロトコルでの出力**: HLSではVRChat内での体感遅延が大きすぎる。RTSPまたはMPEG-TS配信を追加で用意する必要がある。MediaMTX等は RTMP → RTSP の同時出力に標準対応しているため技術的ハードルはそこまで高くない(前述のとおりPC版はRTSP、Quest版はMPEG-TS/別経路が必要)。
2. **VRChat側でのURL許可**: 上記2章のとおり、`clipshare.link`系ドメインをワールドの許可リストに登録してもらうか、ユーザーに「Allow Untrusted URLs」を有効化してもらう必要がある。自社ワールドを作ってその中に「clipshareプレイヤー」プレハブを配布する、という進め方がTopazChatと同じ立ち位置になる(=単なるサーバー実装だけでなく、Unity/Udonでのワールド側コンポーネント制作、VRChatワールド公開・配布という追加プロジェクトが必要)。
3. **帯域制限の運用**: VRChat内での安定再生のため、TopazChat同様に映像2Mbps/音声320kbps程度の低ビットレート出力に制限する必要がある(通常のクリップ共有サイトの動画品質より大幅に落とす)。
4. **プラットフォーム差異への対応**: PC/Quest両対応にするなら出力プロトコルを2系統(RTSP + MPEG-TS)用意し、ワールド側のUdonロジックも作り分ける必要がある。
5. **既存VODパイプラインとの分離**: バッチHLS変換用のFFmpeg workerとは別に、常時稼働のリアルタイムトランスコード/リレープロセスが必要になり、VPSのCPU/帯域予算を別枠で確保する必要がある。

**結論**: 技術的に不可能ではない。MediaMTXやSRSのようなOSSメディアサーバーを使えばRTMP入稿→RTSP/MPEG-TS出力という配信リレー自体は自前で構築できる。ただし、

- TopazChatのサーバー本体は非公開・非OSSであり、**「TopazChatの仕組みをそのまま流用する」ことはできない**(法的にもソースが公開されていないため模倣実装が必要)。
- VRChat内での実際の視聴体験を成立させるには、**VRChat側のURL許可リスト運用とワールド(Unity/Udon)側の実装**という、clipshareのWebアプリ開発とは別領域の作業が追加で発生する。
- 単一VPS・CDN不使用という現行方針のままで低遅延リアルタイム配信を多人数・複数同時配信でスケールさせるのはインフラ的に負荷が高い。

## 6. 推奨ロードマップ

段階を分けて進めるのが現実的。

| フェーズ | 内容 | 難易度 |
| --- | --- | --- |
| Phase 1 | `/live/[user]` でのRTMP配信受付 + HLS(hls.js)でのブラウザ視聴、配信ステータス管理、簡易チャット | 中(既存スタックの延長) |
| Phase 2 | LL-HLSやチャンクセグメント短縮による低遅延化、アーカイブ自動保存(配信終了後にVODとして投稿化) | 中 |
| Phase 3 | VRChat向けRTSP/MPEG-TS出力の追加、ビットレート制限モードの追加 | 高(メディアサーバー設定 + プロトコル知識) |
| Phase 4 | VRChat側「clipshareプレイヤー」ワールド/プレハブの制作・配布、コミュニティへの許可リスト登録の働きかけ | 高(Unity/Udon開発 + コミュニティ運用が必要、Webエンジニアリングの範囲外) |

Phase 1〜2は既存のNext.js/VPS/Prisma資産を活かして実装できる範囲。Phase 3〜4は「TopazChat相当」を狙う部分で、メディアサーバー運用とVRChatワールド開発という新しい専門領域が加わる。

## 7. まとめ

- **「ウェブ上でライブ配信を管理・放映する」こと自体(レイヤーA)は技術的に十分可能**で、既存のclipshareインフラ(VPS + Nginx + FFmpeg + hls.js依存)の延長線上で実装できる。RTMP入稿とHLS配信を仲介する常駐メディアサーバー(MediaMTXなど)を1つ追加するのが中心作業になる。
- **「TopazChatのようにVRChat内で映すこと」(レイヤーB)も技術的には可能**だが、(1) TopazChat自体のサーバー実装は非公開なので流用できず自前実装が必要、(2) VRChat側のURL許可リスト制約とプラットフォーム別プロトコル制限、(3) 低遅延を保つための帯域制限運用、(4) Unity/Udonでのワールド側コンポーネント開発という、通常のWeb開発を超えた追加要件が伴う。
- したがって、まずはPhase 1〜2の「clipshare上でのライブ配信」を先に作り、VRChat中継はニーズと工数を見ながら別プロジェクトとして切り出すのが現実的な進め方と考えられる。
