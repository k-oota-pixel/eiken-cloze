# もんすたでぃ セキュリティ改修状況

2026年10月23日（日本時間）

## 本番へ反映した内容

- english-playroom、task-quest、eiken-cloze、eiken-title の変更をマージ・公開。Renderの3サービスで最終コミットの live を確認。
- AIの全7経路でFirebaseログインを必須化。GoogleによるIDトークンの検証を、入力処理・利用上限の消費・Gemini呼出しの前に実施。Originなしの直接アクセスも認証必須。
- 既存のGoogleログイン状態を復元し、IDトークンを自動送信。ログイン済みの利用者に新しいログイン操作を求めない。未ログインのAI利用はログインが必要。
- 管理者APIでは、管理者メールの一致に加え、Googleが返すメール確認済みフラグを確認。
- reCAPTCHA EnterpriseのスコアベースWebキーを作成して、既存の eiken-retry-web にApp Checkを登録。許可ホストは k-oota-pixel.github.io とRenderの3ホスト。画像選択などのチャレンジは使用しない。
- App Checkは監視段階。Firebaseの強制は有効にしていない。Renderの実応答で3サービスとも appCheckMode=monitor を確認。正常な証明は署名・発行元・有効期限・プロジェクト番号・App IDを検証する。
- 同じAPIを使うTalkQuestにもApp Check送信を追加。既存ログイン、会話、履歴、報酬の処理を維持。
- コイン、ショップ、学習記録、ペットの保存先・既存の正規処理を維持。データの一括更新・移行は行っていない。途中で追加されていたホームの文言変更も保持。

## 本番で確認したこと

| 確認 | 結果 |
|---|---|
| Renderの3サービス | live、aiAuthRequired=true、appCheckMode=monitor |
| 全7つのAI APIへ認証なしでPOST | 7件とも401 |
| 同じ7経路へ偽トークンでPOST | 7件とも401 |
| GitHub Pagesの対象3教材 | 認証ヘッダー送信コードと公開サイトキーを確認 |
| CORS | Authorization / X-Firebase-AppCheck を許可、OPTIONSは204 |
| 本体からタイトル教材へのログイン引継ぎ | 追加ログインなしで既存の本人の状態・進捗を表示 |
| ペット会話 | Firebase認証・App Check成功、AIの返答まで確認 |
| 学習ダッシュボード | 本人の保存済み12教材分の学習状況を表示 |
| App Checkの実際の証明 | Renderログで pet-chat とタイトル採点の state=valid を確認 |

タイトル採点は、認証とApp Checkを通過した後、Geminiの応答待ちが2回タイムアウトした。401/403による拒否ではない。Geminiのモデル・キー・呼出し・待ち時間の既存コードは今回変更しておらず、タイトル採点の成功までは確認できていない。AI機能全体の本番受け入れが完了したとは扱わない。

## Security Rulesの実物確認

Firebase Consoleで eiken-retry / (default) の公開ルールを確認。`users/{userId}/{document=**}` は、ログイン済みかつ本人UID一致のときだけ読書き可能。他人のサブツリーや未ログインのアクセスを許す設定ではなかった。公開ルールのスナップショットと監査結果は english-playroom/security/ に保存。

現行ルールは変更していない。クライアントからの正規のコイン付与・購入・ペット・学習保存を維持するため、本人の書込みを一律に禁止していない。

残る制約として、本人は自分のコインや購入済みアイテムを直接改変できる余地があり、フィールドの型・サイズ検証も限定的。App Checkではこの種の改ざんは防げない。対処には、報酬・支出の信頼できるサーバー側トランザクションへの移管と、全呼び出し元の移行後のフィールド制限が必要。

## テスト

- english-playroom: 既存82件＋追加4件が成功。GitHubのセキュリティチェック・猫の描画テストも成功。
- 新しい検証器8件、クライアント4件、各サーバーのHTTP結合テスト、既存の読解要約2件が成功。
- TaskQuestの管理・学習・ショップ・会話等の既存22件が成功。
- モックFirebaseを使ったブラウザーテストで、管理画面、ペット保存・会話、読解コインの二重付与防止、ログアウト、スマホ表示を確認。
- TalkQuestの既存2件、会話・認証ヘッダー・履歴・再試行・コイン・終了/再開・入力操作のブラウザーテストとGitHubチェックが成功。
- 既存の daily-coins.test.mjs は ranked.coinsToday が undefined となる1件の失敗がある。該当実装・テストは今回未変更。成功したチェックだけで全既存テスト成功とはしていない。

## 今後App Checkを強制する条件と戻し方

1. 学校の通常端末・モバイル・各教材で、正規リクエストの valid が安定することを監視。
2. タイトル採点のGemini待ちタイムアウトを切り分け、AI機能の正常終了を確認。
3. Renderを強制する場合は、全AI呼び出し元からApp Checkトークンが送られていることを確認して APP_CHECK_MODE=enforce に変更し、該当デプロイ後に確認。認証必須化は維持する。
4. Firestoreを強制する場合は、対象4リポジトリだけでなく、同じFirebaseプロジェクトを使う全教材を確認してからFirebase Consoleで段階的に適用する。
5. 強制後に正常通信が失敗した場合は、Renderをmonitorへ戻し、Firebaseで新たに適用したApp Check強制を解除。Firebaseログイン必須は解除しない。

現段階では強制していないため、上記の解除操作は不要。

## 反映したPR

- [english-playroom #33](https://github.com/k-oota-pixel/english-playroom/pull/33)
- [task-quest #10](https://github.com/k-oota-pixel/task-quest/pull/10)
- [eiken-cloze #1](https://github.com/k-oota-pixel/eiken-cloze/pull/1)
- [eiken-title #1](https://github.com/k-oota-pixel/eiken-title/pull/1)
- [talk-quest #4](https://github.com/k-oota-pixel/talk-quest/pull/4)

Firebase構成: eiken-retry / 231308672297 / 1:231308672297:web:5e8b8ede3a0246c2318b38。
秘密キー、サービスアカウント、既存の管理者メールを置き換える操作は行っていない。

