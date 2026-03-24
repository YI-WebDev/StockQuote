# 最適化・分割レビュー（コード変更なし）

## 方針
- 既存の業務ロジック・振る舞いを変えずに、**責務分割**と**保守性/性能の改善余地**のみを整理。
- 本ドキュメントは提案のみで、実装は行わない。

---

## 現状サマリー

| ファイル | 行数 | 主な問題 |
|---|---|---|
| `ProductList.tsx` | 641行 | CSV処理・フィルタ・テーブルが混在 |
| `QuoteList.tsx` | 589行 | 同上 |
| `QuoteDetail.tsx` | 403行 | 取得・PDF・Excel・表示が混在 |
| `QuoteForm.tsx` | 387行 | Firestoreクエリ・計算・UIが混在 |

**現在存在しないディレクトリ:** `src/types/`, `src/services/`, `src/hooks/`

---

## 優先度 High

### 1) 型定義の集約（他すべての前提作業）

- **対象:** `ProductList.tsx`（L16-26）, `QuoteList.tsx`（L16-27）, `QuoteDetail.tsx`（L13-32）, `QuoteForm.tsx`（L12-23）
- **問題:**
  - `Product`, `Quote`, `QuoteDetail`, `ProductForSelect` などが各ファイル内で個別定義。
  - `QuoteDetail`型と`Quote`型は微妙に異なる（`items`フィールドの有無など）にもかかわらず別名で管理されており、差分が混入しやすい。
  - バリデーション型（Zod由来）と実行時型が分離していて統一感がない。
- **提案:**
  - `src/types/models.ts` … `Product`, `Quote`, `QuoteItem` などドメインモデル型
  - `src/types/forms.ts` … `QuoteFormValues`, `ProductFormValues` など入力型
  - `src/lib/validations.ts` の Zod スキーマから型を `export type` で再利用する構成に統一。
- **備考:** この作業を最初に行うことで、後続のリファクタリング全体が型の恩恵を受けられる。

---

### 2) 見積番号生成ロジックの共通化

- **対象:** `QuoteList.tsx`（L29-38）, `QuoteForm.tsx`（L25-34）
- **問題:**
  - `generateQuoteNumber()` が完全に同一の実装で2箇所に存在。
- **提案:**
  - `src/lib/quoteNumber.ts` に一本化。
  - 単体テストを添えることで「挙動を変えていない」ことを担保できる（後述）。

---

### 3) CSV入出力処理の共通化

- **対象:** `ProductList.tsx`（L45-167）, `QuoteList.tsx`（L68-186）
- **問題:**
  - `Papa.parse` + `writeBatch`（BATCH_COMMIT_SIZE=490）+ BOM付きCSV書き出しがほぼ同構造で重複。
  - toast通知・エラーハンドリング・言語切り替えロジックも同パターン。
  - 仕様変更時に2箇所以上を同時修正する必要がある。
- **提案:**
  - `src/lib/csv/parseCsv.ts` … `Papa.parse` ラッパー
  - `src/lib/csv/downloadCsvWithBom.ts` … BOM付きダウンロード
  - `src/lib/csv/commitInBatches.ts` … Firestore バッチ投入
  - Products/Quotes の差分は「列マッピング関数」だけを引数で渡す設計にする。
  - `src/config/` 配下に `productCsvMappings.ts`, `quoteCsvMappings.ts` でフィールド名定義を集約。

---

### 4) QuoteDetailの責務分割

- **対象:** `QuoteDetail.tsx`（403行）
- **問題:**
  - 1ファイルでデータ取得・PDF生成・Excel生成・画面表示をすべて担当。
- **提案:**
  - `useQuoteDetail(id)` … Firestoreからの取得・購読
  - `useQuoteExport()` … PDF/Excel生成ロジック
  - `QuoteDocument` … 表示コンポーネント
  - UI変更と出力仕様変更の影響範囲を分離できる。

---

## 優先度 Medium

### 5) Firestore CRUD のサービス層導入

- **対象:** Create/Edit/Detail/List 系ページ全般
- **問題:**
  - `getDoc / addDoc / updateDoc / deleteDoc` + `createdAt/updatedAt` 付与 + toast通知が画面ごとに重複。
  - `onSnapshot` クエリも各ファイルで独立しており、コレクション名や orderBy 条件が分散。
- **提案:**
  - `src/services/products.ts` … 商品CRUD + onSnapshot ラッパー
  - `src/services/quotes.ts` … 見積CRUD + onSnapshot ラッパー
  - UI側は結果表示に専念できる。

---

### 6) カスタムフックによるリスト状態の分離

- **対象:** `ProductList.tsx`（useState × 13個）, `QuoteList.tsx`（useState × 8個）
- **問題:**
  - 検索・フィルタ・ページネーション・UIステート（ドロップダウン開閉等）が1コンポーネントに混在。
- **提案:**
  - `useListState()` … フィルタ・ページネーション状態をまとめたフック
  - `useFirestoreList(collectionName, query)` … onSnapshot + ローディング・エラー管理
  - フックに切り出すことでコンポーネント本体のロジック量を大幅に削減できる。

---

### 7) 一覧フィルタ・集計のメモ化

- **対象:** `ProductList.tsx`, `QuoteList.tsx`
- **問題:**
  - 毎レンダーで `filter` / `reduce` / `toLowerCase` を再計算。
- **提案:**
  - `useMemo` で `filteredProducts`, `filteredQuotes`, 集計値をメモ化。
  - データ件数増加時の再描画コストを抑制。

---

### 8) QuoteForm 計算処理の整理

- **対象:** `QuoteForm.tsx`
- **問題:**
  - `items` 変更時に全行再計算して `setValue` を複数回実行。
  - `subtotal / tax / total` の計算ロジックがコンポーネント内に埋め込まれていてテスト困難。
- **提案:**
  - `src/lib/quoteCalculations.ts` に計算関数を切り出してユーティリティ化（テスト可能にする）。
  - 変更行のみ更新する構成、または差分更新を検討（件数が多い場合の対策）。
  - **注:** 件数が少ない間は全行再計算でも実害は小さいため、ユーティリティ化を先行して差分更新は後回しで可。

---

## 優先度 Low

### 9) ドロップダウン外クリック制御の再利用

- **対象:** `ProductList.tsx`（L169-181）, `QuoteList.tsx`（L54-66）, `QuoteForm.tsx`（L126-180）
- **問題:**
  - `document.addEventListener('mousedown', ...)` のパターンが3箇所で重複。
- **提案:**
  - `useOutsideClick(ref, callback)` カスタムフックに抽象化。

---

### 10) テーブル・カードビューのコンポーネント分割

- **対象:** `ProductList.tsx`（デスクトップテーブル L434-532、モバイルカード L535-619）, `QuoteList.tsx`（同様）
- **問題:**
  - テーブルビューとモバイルカードビューが同一ファイルに長大なJSXとして存在。
  - ページネーションやローディング・空状態の表示も同コンポーネントが担当。
- **提案:**
  - `ProductTable.tsx` / `QuoteTable.tsx` … デスクトップテーブル
  - `ProductCard.tsx` / `QuoteCard.tsx` … モバイルカード
  - `EmptyState.tsx`, `LoadingState.tsx` … 共通化
  - `Pagination.tsx` … 共通ページネーション（現在各所に同じUIが存在）

---

### 11) トースト・エラーメッセージの定数化

- **対象:** 全ページ
- **問題:**
  - 「読み込みに失敗しました」「保存しました」などのメッセージ文字列が各ファイルにハードコード。
- **提案:**
  - `src/config/messages.ts` に集約して、文言変更を一箇所で対応可能にする。

---

## テスト戦略（新規追加）

リファクタリングの大前提として「挙動を変えていない」ことを担保するテストを整備する。

| 対象 | テスト種別 | 優先度 |
|---|---|---|
| `src/lib/quoteNumber.ts` | 単体テスト（フォーマット検証） | High |
| `src/lib/quoteCalculations.ts` | 単体テスト（tax/subtotal/total） | High |
| `src/lib/csv/` 各ユーティリティ | 単体テスト（parse・download） | Medium |
| `src/services/` | モックを使った統合テスト | Medium |
| 各カスタムフック | `renderHook` によるフックテスト | Low |

- **推奨フレームワーク:** Vitest + React Testing Library（既存のVite構成と親和性が高い）
- **方針:** UIテストより純粋関数・フックのテストを優先。ビジネスロジックが切り出されてから導入する。

---

## セキュリティ・品質チェックポイント（新規追加）

現状のコードを確認した際に気になった点を補足として記載する。

### Firestore セキュリティルール
- **確認推奨:** `firestore.rules` でコレクションごとの読み書き権限が適切に設定されているか。現状は認証済みユーザー全員が全コレクションを操作できる状態になっていないか要確認。

### CSVインポートの入力バリデーション
- **確認推奨:** CSVインポート時の各フィールドに対して `price`, `stock` などの数値型チェックや、文字数制限が行われているか。現状は `parseInt` / `parseFloat` のみで不正値がそのままFirestoreに投入される可能性がある。

### エラーハンドリングの統一
- **確認推奨:** Firestoreの操作失敗時に `console.error` のみで握りつぶされているケースがないか（ユーザーへの通知漏れ）。

---

## 実装順（推奨）

```
Phase 1: 土台整備（安全・小規模）
  1. 型定義の集約（src/types/）
  2. 見積番号生成の共通化（src/lib/quoteNumber.ts）+ 単体テスト

Phase 2: 重複削減（効果大）
  3. CSVユーティリティ共通化（src/lib/csv/）+ 単体テスト
  4. QuoteForm計算処理のユーティリティ化（src/lib/quoteCalculations.ts）+ 単体テスト

Phase 3: 構造改善
  5. QuoteDetailの責務分割（useQuoteDetail / useQuoteExport / QuoteDocument）
  6. Firestoreサービス層の導入（src/services/）

Phase 4: パフォーマンス・UX改善
  7. フィルタ・集計のuseMemoメモ化
  8. カスタムフック化（useOutsideClick, useListState, useFirestoreList）

Phase 5: コンポーネント整理（任意）
  9. テーブル・カードビューの分割
  10. トーストメッセージの定数化
```

---

## 補足
- 本レビューは「既存挙動を変えない」前提での構造改善提案。
- 税率・CSV列名・作成日保持などのルール/仕様は現状踏襲を前提にしている。
- Phase 1-2 はリスクが低く即着手可能。Phase 3 以降は関連ページへの影響があるため、リリーススケジュールと相談しながら進めることを推奨。
