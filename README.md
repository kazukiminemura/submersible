# ABYSSAL SCOUT

潜水艇で深海を自由に探索し、5つの生体サンプルを回収する短編3Dゲームです。

## 遊び方

1. `npm install`
2. `npm run start`
3. 表示されたローカルURLをブラウザで開きます。

WASD / 矢印キーで進行と旋回、Space で浮上、Shift で潜航、E で近くの青いビーコンを回収します。

## Blenderアセット

Blender 4.5.3 LTSで生成した詳細モデルを実際にゲームへ読み込んでいます。

- 編集用：`blender/abyssal_scout.blend`
- ゲーム用：`public/models/submersible.glb`
- 再生成：`blender --background --python blender/build_realistic.py`

このPCではポータブル版が `.tools/blender-4.5.3-windows-x64/blender.exe` にあります（Git対象外）。モデル生成スクリプトは現在のBlenderシーンを消去するため、バックグラウンドの新規プロセスで実行してください。旧 `create_submersible.py` は初期試作です。

船体・観測窓・ボルト・補強リング・推進器・着底脚・マニピュレーターをBlenderで作成。ブラウザ側で砂の凹凸、海底地形、岩、サンゴ、浮遊物、前照灯を描画します。開始にはモデル読み込みの完了が必要です。サンプルは3 m以内で回収でき、エネルギー切れでも再出発できます。
