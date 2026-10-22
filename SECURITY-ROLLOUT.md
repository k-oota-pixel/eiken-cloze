# もんすたでぃ セキュリティ改修

## 実装

- 4リポジトリのFirebase設定は eiken-retry / 231308672297 / 1:231308672297:web:5e8b8ede3a0246c2318b38 で一致。
- AI POST全7経路でGoogleによるFirebase IDトークン検証を必須化。Originなしでも認証必須。CORSの許可は認証の代わりにしない。
- 対象: TaskQuest、準2級面接採点、ペット会話、TalkQuest、空所補充、タイトル判定、読解要約。
- 従来のGoogleログイン状態の復元を待ち、自動更新されるIDトークンを送信。未ログイン時はログイン案内を表示。4択などのローカル演習は従来どおり。
- 管理APIは管理者メール一致に加えて、Googleが返す emailVerified を必須にする。
- App CheckはreCAPTCHA Enterprise、自動更新。監視段階では取得失敗で認証済みAI利用を止めない。
- Renderは APP_CHECK_MODE=monitor が既定。missing / invalid / unavailable / valid を記録。トークン・回答・UIDは監視ログに含めない。enforce では署名・有効期限・発行元・対象プロジェクト・App IDを検証して拒否する。
- コイン計算・ショップ購入・学習記録・管理画面の既存の保存処理と保存先は維持。

## 確認済みの本番構成

Renderワークスペース task-quest、main 自動デプロイ、Singapore、Node。

| サービス | ID | 起動 |
|---|---|---|
| task-quest | srv-db28mfh7lnhs73e1qdlg | node server.mjs |
| eiken-cloze | srv-db48lnjbc2fs73b0n1mg | npm start |
| eiken-title | srv-db496irl550s73b0loag | npm start |

環境変数の秘密値は取得していない。監視モード・プロジェクト指定の実環境変数、Firebase Authの許可ドメイン、App Checkのキー登録と指標は本番反映前に確認する。

Firestoreの公開ルール実物は english-playroom/security/firestore.production.rules に記録。本人のサブツリーだけに読書きを許可。他人のデータへのアクセスを許す設定ではない。所有者によるコイン改ざんは残るため、監査結果を rules-audit.json に明記。正規のクライアント保存を壊す一律禁止は行っていない。

## App Check登録と反映順

1. Google Cloudの管理アカウントで利用規約を確認・同意し、eiken-retry にreCAPTCHA EnterpriseのスコアベースWebキーを作成。ドメイン検証を有効にし、k-oota-pixel.github.io と利用中のRender各ホストを登録。
2. Firebase App Checkの eiken-retry-web にその公開サイトキーを登録。Firestore・Authenticationの強制はまだ有効にしない。
3. 各リポジトリの app-check-config.js と public/app-check-config.js に同じ公開サイトキーを設定。秘密鍵・デバッグトークンはソースへ入れない。
4. まずPagesのクライアント変更を公開し、全呼び出し元からAuthorizationが送られることを確認してから、Renderの認証必須化を反映。main 自動デプロイのためサーバーと画面の公開順に注意。開きっぱなしの旧画面は更新が必要になる。
5. Renderは非秘密値 APP_CHECK_MODE=monitor、FIREBASE_PROJECT_ID=eiken-retry、FIREBASE_PROJECT_NUMBER=231308672297、FIREBASE_APP_IDS=上記App ID で確認。既存のGEMINIキー・管理者・サービスアカウントなどを置き換えない。
6. Googleログイン済みで教材→AI採点→学習記録→正規コイン付与→重複付与拒否を確認。ショップの正規購入・ペット・管理者一覧/詳細/コイン付与も専用テストアカウントで確認。生徒の本番データをテスト用に変更しない。
7. 未ログイン・偽トークン・他プロジェクトのトークン・非管理者の管理APIが拒否されることを確認。各AI経路がGeminiを呼ぶ前に拒否することを確認。
8. Firebase指標とRender app_checkログを通常利用期間で観察し、正常な学校端末・モバイル・各教材で valid が安定することを確認。TalkQuestなど4リポジトリ外の呼び出し元もApp Checkトークンを送る必要がある。
9. 上記確認後にのみ、Renderの APP_CHECK_MODE=enforce とFirebase各サービスの強制を段階的に有効化。Firestore強制は同じプロジェクトを使う他教材にも影響するため、4リポジトリだけの確認では実施しない。

## 戻し方

App Check強制で正常通信に問題が出た場合は Renderを monitor に戻し、Firebaseで新たに有効化したApp Check強制を解除する。Firebaseログイン必須は維持する。画面の問題は該当フロントエンドのコミットを戻す。データ移行や既存レコードの書換えは含まない。

## 検証と残作業

english-playroomの既存82件と追加クライアント4件が成功。新しい検証器8件、3サーバーの全AI経路のHTTP結合テスト、既存読解要約2件が成功。TaskQuestの管理・学習・ショップ・会話等の既存テスト22件が成功。

既存 daily-coins.test.mjs は ranked.coinsToday が undefined となり1件失敗。daily-coins.mjs とそのテストは取得時のHEADから未変更であり、今回の改修による失敗ではない。ランキングを含む実アカウントでの受け入れ確認は未完了。

App Checkサイトキーの作成・登録、本番反映、実アカウントでの受け入れ確認、App Check指標の観察は未完了。テスト成功を本番動作確認済みとは扱わない。

公式参照:
- https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- https://firebase.google.com/docs/app-check/custom-resource-backend
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
- https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/lookup
