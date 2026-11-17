# Checks the cleaned files decode to the very same pixels, keep orientation, and lost GPS.
from PIL import Image
import numpy as np, pathlib
d = pathlib.Path(__file__).parent / "fixtures"
for f in ["gps.jpg", "prog.jpg", "t.png", "e.webp"]:
    a, b = Image.open(d / f), Image.open(d / "out" / f)
    assert np.array_equal(np.asarray(a.convert("RGB")), np.asarray(b.convert("RGB"))), f + " pixels differ"
    ex = b.getexif()
    assert 0x8825 not in ex and 0x010f not in ex, f + " metadata left"
    if f.endswith(".jpg"):
        assert ex.get(0x0112) == 6, f + " orientation lost"
print("pixels identical, GPS gone, orientation kept")
