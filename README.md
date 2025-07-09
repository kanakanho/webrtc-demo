# WebRTC Demo

このリポジトリは、WebRTC を用いた P2P ビデオチャットのデモアプリです。

## 構成

- **frontend/**: TypeScript + Vite 製の Web フロントエンド
- **backend/**: Go 製のシグナリングサーバ
- **PostgreSQL**: backend 用 DB（docker-compose で起動）

## セットアップ手順

### 1. バックエンド（Go + PostgreSQL）

```sh
cd backend
# DB・Goサーバを起動（初回はイメージビルドも実行）
make up
```

Go サーバはデフォルトで `http://localhost:8000` で起動します。

### 2. フロントエンド

```sh
cd frontend
pnpm install
pnpm dev
```

デフォルトで `http://localhost:5173` で起動します。

#### シグナリングサーバの URL 設定

`.env` または `vite.config.ts` で `VITE_SIGNARING_URL` を設定してください。
例:

```.env
VITE_SIGNARING_URL="http://localhost:8000"
```

## 使い方

1. 2 つのブラウザ/端末でフロントエンドにアクセス
2. 片方はそのまま、もう片方は URL 末尾に `?answer` を付与してアクセス
   - 例: `http://localhost:5173/?answer`
3. 双方でカメラ・マイクの許可を与えると、P2P で映像・音声がつながります

## 注意

- HTTPS 環境で利用する場合、シグナリングサーバも HTTPS で起動してください（Mixed Content 対策）
- 2 回目以降の接続も正常に動作します（サーバ側で状態リセット実装済み）
- ローカルネットワーク外で利用する場合は STUN/TURN サーバの追加が必要です

## ライセンス

MIT License
