# 英検 Reading Lab（Render版）
GitHubのリポジトリ直下に、このフォルダーの中身をアップロードします。
publicフォルダーもそのままアップロードしてください。

Render: New > Web Service > GitHubリポジトリを接続。
Language: Node / Branch: main / Root Directory: 空欄
Build Command: npm install
Start Command: npm start
Health Check Path: /health
Environment: GEMINI_API_KEY = ご自身のキー
任意: GEMINI_MODEL = 利用可能なテキストモデル名（既定 gemini-flash-latest）

APIキーをソースやHTMLに書き込む必要はありません。
APIキーは先生がRenderに設定し、生徒はURLから利用できます。

Renderを無料プランで利用する場合のスリープ等はRenderの最新条件をご確認ください。
参考: https://render.com/docs/deploy-node-express-app
参考: https://ai.google.dev/gemini-api/docs/api-key

ローカル確認: 環境変数GEMINI_API_KEYを設定して npm start。
API未設定でも４択モード（空所補充サイト）は使えます。
17題を収録。2025年度第2・3回のみ公式解答照合済み。他は推定解答です。

サーバーは登録された教材だけを判定し、入力長と同時アクセスを制限します。
本番Geminiの通信確認には有効なキーが必要です。
