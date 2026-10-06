#!/usr/bin/env python3
"""Build this repo's asset trees from a Kenney "All-in-1" dump.

    python3 tools/build_tree.py ~/outside/kenney

What this repo IS: the full Kenney library (CC0), organized so an asset
service can serve any file by a stable path at a pinned commit. It
replaced a CULLED copy vendored inside the surfer UI library — 147
packs cut to 39,713 sprites by a 20 KB size rule, and no 3D at all —
and the paths here are DELIBERATELY IDENTICAL to that copy's for every
file it had: the Tulip asset index derives each sprite's five-character
id as a hash of its path, and 38k vision labels are keyed by path, so
the path scheme is load-bearing. New files (the icon packs, the big
backgrounds, everything over 20 KB, the 3D kits) simply add rows.

2D/UI/ICONS: individual sprite PNGs. Spritesheets, tilemaps, previews,
samples, vectors and overview renders are still excluded — they are
PACKAGINGS of sprites that are already here individually, not art the
library lacks. The old 20 KB ceiling is gone; a 2 MB one replaces it
(nothing in the dump exceeds it — it is a guard against a future dump,
not a cull).

3D: every kit's .glb models plus the textures they reference, laid out
so a model's own relative texture URI ("Textures/colormap.png")
resolves inside its kit directory — which is what lets the service
fetch a model, read its image URIs, and embed exactly the textures it
names, whether that is none (vertex-coloured kits), one shared
colormap, or a per-model texture (Retro Urban, Blocky Characters).
FBX-only kits (the skinned Animated Characters) are skipped: the
consumer is a static flat-shading rasterizer.

index.tsv (path, description, WxH, bytes) covers the images; the 3D
kits carry 3d/kits.tsv (slug, title, models). Colour, animation
grouping, ids and search live in the Tulip repo's generators, which
read this tree.
"""
import os
import re
import shutil
import struct
import sys

EXCLUDE = re.compile(
    r"(spritesheet|tilesheet|tilemap|packed|preview|sample|vector|/Tiled/"
    r"|overview)", re.I)
DROP_COMPONENTS = {"png", "default", "default size"}
MAX_BYTES = 2_000_000

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECTIONS = [("2D assets", "2d", "2D Assets"),
            ("UI assets", "ui", "UI Assets"),
            ("Icons", "icons", "Icons")]

SKIP_WORDS = {"kit", "pack"}


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    if len(head) < 24 or head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w, h = struct.unpack(">II", head[16:24])
    return w, h


def humanize(stem):
    s = re.sub(r"[_\-]+", " ", stem)
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", s)      # camelCase
    s = re.sub(r"(?<=[a-zA-Z])(?=\d)", " ", s)      # letter->digit
    return " ".join(w if w.isupper() else w.capitalize() for w in s.split())


def slug(kit):
    """'City Kit - Roads' -> 'city-roads'; 'Nature Kit (Classic)' ->
    'nature-classic'. The generic words go; the identity stays."""
    words = re.split(r"[^a-z0-9]+", kit.lower())
    return "-".join(w for w in words if w and w not in SKIP_WORDS)


def images(src_root):
    rows, total = [], 0
    for src_name, dst_name, label in SECTIONS:
        top = os.path.join(src_root, src_name)
        if not os.path.isdir(top):
            print("MISSING section: %s" % top)
            continue
        for dirpath, dirs, files in os.walk(top):
            dirs.sort()
            for f in sorted(files):
                if not f.lower().endswith(".png"):
                    continue
                src = os.path.join(dirpath, f)
                if EXCLUDE.search(src):
                    continue
                nbytes = os.path.getsize(src)
                if nbytes >= MAX_BYTES:
                    print("over the ceiling, skipped: %s (%d)"
                          % (src, nbytes))
                    continue
                size = png_size(src)
                if not size:
                    continue
                rel_parts = os.path.relpath(src, top).split(os.sep)
                kept = [p for p in rel_parts[:-1]
                        if p.lower() not in DROP_COMPONENTS]
                dst_rel = os.path.join(dst_name, *kept, f)
                dst = os.path.join(HERE, dst_rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)
                desc = ", ".join([label] + kept + [humanize(f[:-4])])
                total += nbytes
                rows.append((dst_rel.replace(os.sep, "/"), desc,
                             "%dx%d" % size, nbytes))
        print("%s: %d files so far" % (src_name, len(rows)))
    rows.sort()
    with open(os.path.join(HERE, "index.tsv"), "w", encoding="utf-8") as f:
        f.write("path\tdescription\tsize\tbytes\n")
        for r in rows:
            f.write("%s\t%s\t%s\t%d\n" % r)
    print("images: %d files, %.1f MB" % (len(rows), total / 1048576))


def models(src_root):
    top = os.path.join(src_root, "3D assets")
    kits, total, count = [], 0, 0
    seen = set()
    for kit in sorted(os.listdir(top)):
        kdir = os.path.join(top, kit, "Models")
        if not os.path.isdir(kdir):
            continue
        # newer kits ship Models/GLB format/, older ones keep the .glb
        # inside Models/GLTF format/ next to the .gltf
        src = None
        for sub in ("GLB format", "GLTF format"):
            d = os.path.join(kdir, sub)
            if os.path.isdir(d) and any(x.endswith(".glb")
                                        for x in os.listdir(d)):
                src = d
                break
        if src is None:
            print("no .glb (FBX/OBJ only), skipped: %s" % kit)
            continue
        s = slug(kit)
        assert s not in seen, "slug collision: %s" % s
        seen.add(s)
        n = 0
        for f in sorted(os.listdir(src)):
            if not f.endswith(".glb"):
                continue
            nbytes = os.path.getsize(os.path.join(src, f))
            if nbytes >= MAX_BYTES * 2:
                print("over the ceiling, skipped: %s/%s (%d)"
                      % (kit, f, nbytes))
                continue
            dst = os.path.join(HERE, "3d", s, f)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(os.path.join(src, f), dst)
            total += nbytes
            n += 1
        tex = os.path.join(src, "Textures")
        if os.path.isdir(tex):
            for f in sorted(os.listdir(tex)):
                if f.lower().endswith(".png"):
                    dst = os.path.join(HERE, "3d", s, "Textures", f)
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    shutil.copy2(os.path.join(tex, f), dst)
        kits.append((s, kit, n))
        count += n
    with open(os.path.join(HERE, "3d", "kits.tsv"), "w",
              encoding="utf-8") as f:
        f.write("slug\ttitle\tmodels\n")
        for r in kits:
            f.write("%s\t%s\t%d\n" % r)
    print("models: %d across %d kits, %.1f MB"
          % (count, len(kits), total / 1048576))


if __name__ == "__main__":
    src_root = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1
                                  else "~/outside/kenney")
    images(src_root)
    models(src_root)
