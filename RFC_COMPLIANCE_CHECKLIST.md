# RFC準拠改善チェックリスト

## プロジェクト概要

- **目標**: RFC Draft IETF Idempotency-Key Header準拠率を70% → 95%+に向上
- **期間**: 4フェーズに分けて段階的実装
- **優先度**: Critical → Moderate → Testing → Minor

---

## 🔴 Phase 1: Critical Issues (MUST Fix)

### Step 1.1: RFC8941構造化ヘッダー解析実装

- [ ] `structured-headers` パッケージの依存関係追加
- [ ] `src/utils/rfc8941.ts` - 構造化ヘッダーパーサー作成
  - [ ] 引用符付き文字列の解析
  - [ ] エスケープシーケンス処理
  - [ ] ABNF文法検証
- [ ] `src/middleware.ts:94` - raw string抽出を構造化解析に変更
- [ ] 構造化ヘッダー解析のユニットテスト作成

### Step 1.2: エラーレスポンスのドキュメントリンク

- [ ] `src/config/documentation.ts` - 設定可能ドキュメントURL作成
- [ ] `src/constants/response.ts` - 全エラーに`type`フィールド追加
  - [ ] IDEMPOTENCY_KEY_MISSING_ERROR_RESPONSE更新
  - [ ] IDEMPOTENCY_KEY_CONFLICT_ERROR_RESPONSE更新
  - [ ] IDEMPOTENCY_KEY_PAYLOAD_MISMATCH_ERROR_RESPONSE更新
- [ ] HTTPリンクヘッダー代替サポート追加
- [ ] RFC7807 Problem Details準拠確認

---

## 🟡 Phase 2: Moderate Issues (SHOULD Fix)

### Step 2.1: HTTPメソッド制限

- [ ] `src/config/methods.ts` - 設定可能メソッドフィルター作成
- [ ] `src/middleware.ts` - POST/PATCH以外をバイパスするロジック追加
- [ ] デフォルトメソッド設定: `["POST", "PATCH"]`
- [ ] メソッドフィルタリングのテスト作成

### Step 2.2: セキュリティキー検証フレームワーク

- [ ] `src/security/validators.ts` - キー検証ユーティリティ作成
  - [ ] UUID検証
  - [ ] 時間ベースID検証
  - [ ] カスタムパターン検証
- [ ] `src/security/patterns.ts` - 標準パターン定義
- [ ] `src/server/specification.ts` - セキュリティガイダンス統合
- [ ] セキュリティ検証のテスト作成

### Step 2.3: デフォルト戦略変更

- [ ] `src/middleware.ts:79` - デフォルト戦略を`"always"`から`"opt-in"`に変更
- [ ] 型定義の更新
- [ ] ドキュメントの更新
- [ ] デフォルト戦略変更のテスト作成

---

## 🧪 Phase 3: Test Coverage

### Step 3.1: RFC準拠テストスイート

- [ ] `tests/rfc8941/` ディレクトリ作成
  - [ ] 構造化ヘッダー解析テスト
  - [ ] エッジケーステスト
- [ ] `tests/compliance/` ディレクトリ作成
  - [ ] RFC準拠検証テスト
  - [ ] エラーレスポンス形式テスト
- [ ] `tests/security/` ディレクトリ作成
  - [ ] セキュリティパターンテスト
  - [ ] 攻撃耐性テスト
- [ ] 既存テストの拡張
  - [ ] RFC例との照合テスト
  - [ ] メソッドフィルタリングテスト

---

## 🟢 Phase 4: Minor Issues (MAY Fix)

### Step 4.1: エラータイプ差別化

- [ ] `src/constants/response.ts` - 形式エラー vs 欠如エラーの区別
- [ ] より詳細なエラーメッセージの追加
- [ ] エラータイプ差別化のテスト作成

### Step 4.2: ロック有効期限処理

- [ ] `src/storage/adapter.ts` - TTLサポート拡張
- [ ] `src/storage/cleanup.ts` - デッドロック予防機能
- [ ] ロック有効期限のテスト作成

---

## 📊 進捗管理

### 完了確認

- [ ] Phase 1完了 → 基本RFC準拠達成
- [ ] Phase 2完了 → セキュリティ・互換性向上
- [ ] Phase 3完了 → テストカバレッジ確保
- [ ] Phase 4完了 → 細部調整完了

### 最終検証

- [ ] 全RFC準拠テストパス
- [ ] セキュリティテストパス
- [ ] パフォーマンステスト実行
- [ ] ドキュメント更新完了
- [ ] 95%+準拠率達成確認

---

## 📝 実装ガイドライン

### 効率的なタスク実行のための指示

1. **Phase順序の遵守**: Critical → Moderate → Testing → Minor
2. **テスト駆動開発 (TDD)**: 各機能実装前にテスト作成 - **必須**
3. **段階的確認**: 各Stepでの動作確認を徹底
4. **RFC仕様参照**: 実装時は必ず対応するRFC章節を確認
5. **セキュリティ優先**: セキュリティ関連機能は最優先で実装

### ⚠️ 重要な但し書き

- **TDD必須**: 全ての新機能・修正は必ずテストファーストで実装
- **実装前テスト**: コード実装前に失敗するテストを書く
- **Red-Green-Refactor**: 失敗→成功→改善のサイクルを遵守
- **テストカバレッジ**: 新規コードは100%カバレッジを目標

### コードレビューポイント

- RFC8941準拠性の確認
- セキュリティベストプラクティスの適用
- テストカバレッジの確保
- パフォーマンスへの影響評価

---

_チェックリスト作成日: 2025-07-14_
_Based on: RFC Draft IETF-HTTPAPI-IDEMPOTENCY-KEY-HEADER-06_
