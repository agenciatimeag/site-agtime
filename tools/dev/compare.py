# Junta print original (esquerda) e local (direita) em pedaços para revisão visual.
import sys, os
from PIL import Image
orig, local, out = sys.argv[1], sys.argv[2], sys.argv[3]
chunk = int(sys.argv[4]) if len(sys.argv) > 4 else 1800
scale = float(sys.argv[5]) if len(sys.argv) > 5 else 0.5
a, b = Image.open(orig).convert("RGB"), Image.open(local).convert("RGB")
print("sizes", a.size, b.size)
h = max(a.height, b.height)
os.makedirs(out, exist_ok=True)
i = 0
for y in range(0, h, chunk):
    w = a.width + b.width + 20
    im = Image.new("RGB", (w, chunk), (255, 0, 255))
    im.paste(a.crop((0, y, a.width, min(a.height, y + chunk))), (0, 0))
    im.paste(b.crop((0, y, b.width, min(b.height, y + chunk))), (a.width + 20, 0))
    im = im.resize((int(w * scale), int(chunk * scale)))
    im.save(f"{out}/{i:02d}.jpg", quality=70)
    i += 1
print("chunks", i)
