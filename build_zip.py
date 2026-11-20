# Chrome ウェブストア提出用の zip を dist/ に作る
# 使い方: python build_zip.py
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
# 拡張機能の動作に必要なファイルだけを入れる（README などの資料は入れない）
INCLUDE = ["manifest.json", "content.js", "content.css", "icons", "_locales"]

with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as f:
    version = json.load(f)["version"]

out_dir = os.path.join(ROOT, "dist")
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, f"purchase-history-for-lcsc-{version}.zip")

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for item in INCLUDE:
        path = os.path.join(ROOT, item)
        if os.path.isfile(path):
            z.write(path, item)
            continue
        for dirpath, _, files in os.walk(path):
            for name in sorted(files):
                full = os.path.join(dirpath, name)
                # zip 内のパスは / 区切りにする
                z.write(full, os.path.relpath(full, ROOT).replace(os.sep, "/"))

with zipfile.ZipFile(out) as z:
    for n in z.namelist():
        print("  ", n)
print(f"作成しました: {out}")
