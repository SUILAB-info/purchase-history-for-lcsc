# Chrome ウェブストア 登録用メモ

デベロッパー ダッシュボード（https://chrome.google.com/webstore/devconsole）に入力する内容です。
英語を既定の言語にし、日本語の掲載情報を追加します。

## 1. パッケージ

- `dist/purchase-history-for-lcsc-<version>.zip` をアップロードする
- 名前と概要は manifest（`_locales`）から自動で入る
  - en: Purchase History for LCSC (Unofficial)
  - ja: 購入履歴チェッカー for LCSC（非公式）

## 2. ストアの掲載情報

- カテゴリ: Shopping（ショッピング）
- 言語: 英語（既定）、日本語

### 説明（English）

```
See at a glance whether you have already bought a part on LCSC.

When you open an LCSC product page, this extension looks up your own order history and shows, right above the price box:

• whether you have bought this part before
• the total quantity and number of orders
• the date, quantity, unit price, order number and status of each order (the order number links to the order page)

Cancelled, expired and unpaid orders are shown but not counted in the total.

How it works
• Uses your existing signed-in LCSC session. You never enter a password into the extension.
• Talks only to LCSC's own servers. No analytics, no tracking, no data sent to the developer or third parties.
• Order line items are cached locally in your browser to keep things fast.

Notes
• Quantities are as ordered; partial refunds for out-of-stock items are not reflected.
• This is an unofficial extension and is not affiliated with, endorsed by, or sponsored by LCSC Electronics. It may stop working if LCSC changes its website.
```

### 説明（日本語）

```
LCSCで、その部品をもう買ったことがあるかがひと目でわかります。

LCSCの商品ページを開くと、あなた自身の注文履歴を調べて、価格欄のすぐ上に次の情報を表示します。

• この部品を過去に買ったことがあるか
• 合計の数量と注文回数
• 注文ごとの購入日・数量・単価・注文番号・状態（注文番号から注文ページへ移動できます）

キャンセル・期限切れ・未払いの注文も表示しますが、合計には含めません。

しくみ
• ログイン中のLCSCのセッションを使います。拡張機能にパスワードを入力することはありません。
• 通信先はLCSCのサーバーだけです。アクセス解析やトラッキングはなく、開発者や第三者にデータを送ることもありません。
• 表示を速くするため、注文の明細をブラウザ内に保存します。

ご注意
• 数量は注文時の数です。欠品による一部返金などは反映されません。
• LCSC Electronics とは関係のない非公式の拡張機能です。LCSCのサイトが変わると動かなくなることがあります。
```

### 画像

| 項目 | サイズ | 状態 |
|---|---|---|
| ストア用アイコン | 128×128 | `icons/icon128.png` を使う |
| スクリーンショット（1枚以上） | 1280×800 | 英語の掲載情報に `store/screenshot-en.png`、日本語に `store/screenshot-ja.png`（注文データ・アカウント名はダミー） |
| プロモーション用タイル（小） | 440×280 | 任意 |

## 3. プライバシー

### 単一用途の説明

```
Shows, on LCSC product pages, whether the signed-in user has bought that part before, with the order dates and quantities from their own LCSC order history.
```

### 権限が必要な理由

- **storage**
  ```
  Caches the line items (part number, quantity, unit price, status) of the user's own orders locally so the same order is not fetched from LCSC again on every product page.
  ```
- **ホスト権限（www.lcsc.com / lcsc.com へのコンテンツスクリプト）**
  ```
  The content script reads the part number from the LCSC product page URL, requests the user's own order history from LCSC's order API using the user's existing session, and inserts a small purchase-history box into the page. It runs on all lcsc.com pages because the site can move between pages without a full reload; it does nothing on pages other than product pages.
  ```

### リモートコード

- 「いいえ、リモートコードは使用していません」を選ぶ

### データの使用

収集するデータの種類（データは端末の外に送らないが、扱う内容に合わせて申告しておく）:

- [x] 財務情報と支払い情報（注文履歴：品番・数量・単価・注文の状態）
- それ以外はチェックしない

次の3つの宣言にすべてチェックする:

- [x] 承認されている用途以外で、ユーザーデータを第三者に販売または譲渡しない
- [x] 拡張機能の単一用途と関係のない目的で、ユーザーデータを使用または譲渡しない
- [x] 信用力の判断や融資の目的で、ユーザーデータを使用または譲渡しない

### プライバシー ポリシーの URL

GitHub リポジトリの PRIVACY.md の URL を入れる
（例: https://github.com/SUILAB-info/purchase-history-for-lcsc/blob/main/PRIVACY.md）。

## 4. 配布

- 公開設定: 公開
- 地域: すべての地域
