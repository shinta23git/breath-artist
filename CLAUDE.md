# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 言語設定
- 常に日本語で会話する
- コメントも日本語で記述する
- エラーメッセージの説明も日本語で行う
- ドキュメントも日本語で生成する

## プロジェクト概要

「Breath Artist」— 心と脳を調える呼吸法サポートWebアプリ。ビルドツール不要の純粋HTML/CSS/JavaScript（ES Modules）で構成。

## 開発サーバー

任意のHTTPサーバーでルートディレクトリを配信する（ES Modulesに `file://` は不可）。
```bash
# Node.jsの場合
node -e "require('http').createServer((q,r)=>{const fs=require('fs'),p=require('path'),u=q.url==='/'?'/index.html':q.url,f=p.join(process.cwd(),u),m={'.html':'text/html','.css':'text/css','.js':'application/javascript'};fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end()}else{r.writeHead(200,{'Content-Type':m[p.extname(f)]||'text/plain'});r.end(d)}})}).listen(8080)"
# Pythonの場合
python -m http.server 8080
```

## アーキテクチャ

**画面遷移:** 入力画面 → 呼吸セッション画面 → 完了画面（アート表示）

**エントリーポイント:** `index.html` → `js/main.js`（画面遷移制御）

| ファイル | 役割 |
|---|---|
| `js/constants.js` | 50個の価値観データ、呼吸設定の定数 |
| `js/form.js` | フォーム生成・バリデーション（価値観チップ選択、最大3つ制限） |
| `js/speech.js` | Web Speech API による音声入力 |
| `js/geometry.js` | テキスト→シード変換、Canvas万華鏡描画、呼吸同期スケーリング |
| `js/audio.js` | Web Audio API で7.89Hz振幅変調（アイソクロニック・トーン） |
| `js/session.js` | 呼吸タイマー制御、geometry/audioとの連携 |
| `js/art.js` | 最終アート画像の合成（1080×1080 Canvas）・PNGダウンロード |

## 主要パターン

- **幾何学模様生成:** テキストハッシュ → シード値 → 擬似乱数で花弁数・色・対称性を決定。Before→Afterパラメータをlerp補間で遷移
- **万華鏡:** Canvasをn分割し1セグメントを描画→回転コピー。`requestAnimationFrame`ループで連続アニメーション
- **7.89Hz音響:** 可聴域以下のため180Hzキャリアに7.89Hz LFOで振幅変調。ConvolverNodeでリバーブ付与
- **画面管理:** `.screen.active` クラスの切替で表示/非表示を制御
