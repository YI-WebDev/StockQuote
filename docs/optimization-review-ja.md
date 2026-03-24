# 最適化・分割レビュー（コード変更なし）

## 方針
- 既存の業務ロジック・振る舞いを変えずに、**責務分割**と**保守性/性能の改善余地**のみを整理。
- 本ドキュメントは提案のみで、実装は行わない。

## 全体所見
- 画面機能は揃っているが、`ProductList` / `QuoteList` / `QuoteDetail` / `QuoteForm` に処理が集中しており、UI・I/O・変換・ユーティリティが同居している。
- 同種ロジック（CSV import/export、見積番号生成、Firestore CRUD）が複数箇所に重複している。

## 優先度 High

### 1) CSV入出力処理の共通化
- 対象: `src/pages/products/ProductList.tsx`, `src/pages/quotes/QuoteList.tsx`
- 問題:
  - `Papa.parse` + バッチ投入 + BOM付きCSV書き出しがほぼ同構造で重複。
  - 仕様変更時に2箇所以上を同時修正する必要がある。
- 提案:
  - `src/lib/csv/` に `parseCsv`, `downloadCsvWithBom`, `commitInBatches` を切り出し。
  - Products/Quotesの差分は「列マッピング関数」だけ渡す構成にする。

### 2) 見積番号生成ロジックの共通化
- 対象: `src/pages/quotes/QuoteList.tsx`, `src/pages/quotes/QuoteForm.tsx`
- 問題:
  - `generateQuoteNumber` が重複実装。
- 提案:
  - `src/lib/quoteNumber.ts` に `generateQuoteNumber()` を一本化。

### 3) QuoteDetailの責務分割
- 対象: `src/pages/quotes/QuoteDetail.tsx`
- 問題:
  - 1ファイルで「取得」「PDF生成」「Excel生成」「表示」をすべて担当（400行規模）。
- 提案:
  - `useQuoteDetail(id)`（取得）
  - `useQuoteExport()`（PDF/Excel）
  - `QuoteDocument`（表示）
  に分割。UI変更や出力仕様変更の影響範囲を縮小。

## 優先度 Medium

### 4) 一覧フィルタ/集計のメモ化
- 対象: `src/pages/products/ProductList.tsx`, `src/pages/quotes/QuoteList.tsx`
- 問題:
  - 毎レンダーで `filter` / `reduce` / `toLowerCase` を再計算。
- 提案:
  - `useMemo` で `filteredProducts`, `filteredQuotes`, 集計値をメモ化。
  - データ件数増加時の再描画コストを抑制。

### 5) QuoteForm計算処理の更新粒度最適化
- 対象: `src/pages/quotes/QuoteForm.tsx`
- 問題:
  - `items` 変更時に全行再計算し、`setValue` を複数回実行。
- 提案:
  - 変更行のみ更新する構成、または比較して差分更新。
  - `subtotal/tax/total` は算出ロジックをユーティリティ化してテスト可能に。

### 6) Firestore CRUD共通化
- 対象: Create/Edit/Detail系ページ全般
- 問題:
  - `getDoc/addDoc/updateDoc/deleteDoc` + `createdAt/updatedAt` + toast が画面ごとに重複。
- 提案:
  - `src/services/products.ts`, `src/services/quotes.ts` を作成し、UIは結果表示に専念。

## 優先度 Low

### 7) ドロップダウン外クリック制御の再利用
- 対象: `ProductList` / `QuoteList`
- 問題:
  - 同じ `mousedown` 監視が重複。
- 提案:
  - `useOutsideClick` カスタムフックに抽象化。

### 8) 型定義の集約
- 対象: pages配下の `type Product`, `type Quote` など
- 問題:
  - 似た型が各画面に点在し、微妙な差分が混入しやすい。
- 提案:
  - `src/types/domain.ts` に集約して再利用。

## 実装順（推奨）
1. 見積番号生成共通化（小規模・安全）
2. CSVユーティリティ共通化（重複削減効果大）
3. QuoteDetail分割（可読性向上）
4. Firestore service層導入
5. フィルタ/集計メモ化、計算処理差分更新

## 補足
- 本レビューは「既存挙動を変えない」前提での構造改善提案。
- ルール/仕様（税率やCSV列名、作成日保持など）は現状踏襲を前提にしている。
