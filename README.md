# 在庫・見積管理アプリ (React + Express + Prisma)

このプロジェクトは、在庫管理と見積作成を連携して行えるシンプルなWebアプリケーションです。

## 主な機能

1. **在庫管理 (Products)**
   - 商品の登録、編集、削除、一覧表示
   - 商品名やメーカーでの検索
   - 在庫数や単価の管理

2. **見積管理 (Quotes)**
   - 見積書の作成、編集、削除、一覧表示
   - 在庫マスタからの商品検索・自動入力
   - 数量と単価からの自動計算（小計、消費税10%、合計）
   - 見積書のPDF出力（ブラウザレンダリングを活用した日本語対応）
   - 見積書のExcel出力（SheetJSを利用した構造化データ出力）
   - 印刷用レイアウト対応

## 技術スタック

- **フロントエンド**: React 18, React Router, Tailwind CSS, React Hook Form, Zod, Lucide React, react-hot-toast
- **バックエンド**: Node.js, Express
- **データベース**: SQLite, Prisma ORM
- **ビルドツール**: Vite
- **出力機能**: html2canvas, jsPDF, xlsx

## 起動手順

以下の手順で、ローカル環境でアプリケーションを起動できます。

1. **依存パッケージのインストール**
   ```bash
   npm install
   ```

2. **データベースのセットアップ**
   SQLiteデータベースを作成し、初期データ（シード）を投入します。
   ```bash
   npm run db:push
   npm run db:seed
   ```

3. **開発サーバーの起動**
   ```bash
   npm run dev
   ```
   起動後、ブラウザで `http://localhost:3000` にアクセスしてください。

## データモデル

- **Product (商品)**: `id`, `code`, `name`, `manufacturer`, `price`, `stock`, `unit`, `note`, `createdAt`, `updatedAt`
- **Quote (見積)**: `id`, `quoteNumber`, `subject`, `customerName`, `issueDate`, `expiryDate`, `note`, `subtotal`, `tax`, `total`, `createdAt`, `updatedAt`
- **QuoteItem (見積明細)**: `id`, `quoteId`, `productId`, `productName`, `manufacturer`, `price`, `quantity`, `amount`, `createdAt`, `updatedAt`

## API エンドポイント

- **Products**
  - `GET /api/products` : 商品一覧取得
  - `GET /api/products/:id` : 商品詳細取得
  - `POST /api/products` : 商品登録
  - `PUT /api/products/:id` : 商品更新
  - `DELETE /api/products/:id` : 商品削除

- **Quotes**
  - `GET /api/quotes` : 見積一覧取得
  - `GET /api/quotes/:id` : 見積詳細取得
  - `POST /api/quotes` : 見積作成
  - `PUT /api/quotes/:id` : 見積更新
  - `DELETE /api/quotes/:id` : 見積削除

*(※ PDFおよびExcel出力は、サーバーサイドではなくクライアントサイドのライブラリを用いてブラウザ上で生成・ダウンロードする仕組みを採用しています。これにより、日本語フォントのレンダリングやレイアウトの再現性を高めています。)*

## 今後の改善案 (Future Work)

MVP（Minimum Viable Product）として基本的な機能は網羅していますが、実運用に向けて以下の機能追加が考えられます。

- **顧客マスタの追加**: 現在は宛名をテキスト入力していますが、顧客マスタを作成し、選択式にすることで入力の手間を省き、表記揺れを防ぎます。
- **認証・認可機能**: 複数ユーザーでの利用を想定し、ログイン機能や権限管理（管理者・一般ユーザー）を追加します。
- **ダッシュボード**: 月別の売上予測や、在庫が少ない商品の警告などを可視化するダッシュボード画面を追加します。
- **サーバーサイドでのPDF生成**: 現在はクライアントサイド（ブラウザ）でPDFを生成していますが、より厳密なレイアウト制御や一括出力のために、サーバーサイド（Puppeteer等）でのPDF生成を検討します。
- **消費税率の柔軟な設定**: 現在は10%固定ですが、商品ごとの軽減税率（8%）や、将来的な税率変更に対応できる設計にします。
