# bake-nature-assets.py — stage the Quaternius "Stylized Nature MegaKit" (CC0) into
# public/models/nature/ for runtime GLTFLoader use.
#
# The raw MegaKit (source, gitignored) ships 2K bark/leaf/rock PNGs and per-model
# normal maps — far too heavy for a web game. This one-time baker:
#   * copies a CURATED set of .gltf + .bin geometry files,
#   * strips the `normalTexture` from every material (the game is flat/matte — no
#     normal mapping) so GLTFLoader never even requests the *_Normal.png files,
#   * resizes only the still-referenced base-colour textures down to web sizes.
#
# Requires Pillow (PIL). Run from the repo root:
#   python tools/bake-nature-assets.py
# Pack: https://quaternius.com  (CC0 1.0). Drop the "Stylized Nature MegaKit[Standard]"
# folder in the repo root (it stays gitignored); the baked output under public/ is committed.
import json, os, shutil, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# The raw pack folder stays gitignored; point NATURE_SRC at it if it lives elsewhere
# (e.g. a shared checkout). Defaults to the pack sitting in the repo root.
_pack = os.environ.get("NATURE_SRC") or os.path.join(ROOT, "Stylized Nature MegaKit[Standard]")
SRC = os.path.join(_pack, "glTF") if os.path.basename(_pack) != "glTF" else _pack
OUT = os.path.join(ROOT, "public", "models", "nature")

# Curated model list (file stem, no extension). Variants that share a texture set
# merge into the same draw-call bucket at runtime, so extra variants are ~free.
MODELS = [
    # broadleaf trees (Bark_NormalTree + Leaves_NormalTree_C)
    "CommonTree_1", "CommonTree_2", "CommonTree_3", "CommonTree_4", "CommonTree_5",
    # pines (Bark_NormalTree + Leaf_Pine_C)
    "Pine_1", "Pine_2", "Pine_3", "Pine_4", "Pine_5",
    # bushes / shrubs
    "Bush_Common", "Bush_Common_Flowers", "Plant_1", "Plant_7",
    # ground foliage
    "Fern_1",
    "Grass_Common_Short", "Grass_Common_Tall", "Grass_Wispy_Short", "Grass_Wispy_Tall",
    "Flower_3_Group", "Flower_4_Group", "Clover_1", "Clover_2",
    "Mushroom_Common", "Mushroom_Laetiporus",
    # rocks
    "Rock_Medium_1", "Rock_Medium_2", "Rock_Medium_3",
    "Pebble_Round_1", "Pebble_Round_2", "Pebble_Round_3", "Pebble_Round_4", "Pebble_Round_5",
]

# max edge (px) per texture, matched by case-insensitive substring of the filename.
def target_size(name):
    n = name.lower()
    if "mushroom" in n: return 256
    if "flower" in n: return 512
    return 512  # bark / leaves / grass / rocks / pathrocks

def main():
    if not os.path.isdir(SRC):
        print("ERROR: source not found:", SRC); sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    needed_tex = {}  # uri -> None
    for stem in MODELS:
        gp = os.path.join(SRC, stem + ".gltf")
        if not os.path.isfile(gp):
            print("  MISSING", stem); continue
        j = json.load(open(gp, "r", encoding="utf-8"))
        # strip normal maps from every material
        for m in j.get("materials", []):
            m.pop("normalTexture", None)
        # figure out which images survive (referenced by some texture used by a material)
        used_tex_idx = set()
        for m in j.get("materials", []):
            pbr = m.get("pbrMetallicRoughness", {})
            for key in ("baseColorTexture", "metallicRoughnessTexture"):
                if key in pbr: used_tex_idx.add(pbr[key]["index"])
            for key in ("emissiveTexture", "occlusionTexture"):
                if key in m: used_tex_idx.add(m[key]["index"])
        textures = j.get("textures", [])
        images = j.get("images", [])
        for ti in used_tex_idx:
            src_img = images[textures[ti]["source"]]
            needed_tex[src_img["uri"]] = None
        # write the trimmed gltf + copy the .bin verbatim
        json.dump(j, open(os.path.join(OUT, stem + ".gltf"), "w", encoding="utf-8"), separators=(",", ":"))
        shutil.copyfile(os.path.join(SRC, stem + ".bin"), os.path.join(OUT, stem + ".bin"))
    # --- Coconut palm: a standalone OBJ pack (folder "Coconut palm tree" beside the
    # MegaKit). Copy the .obj verbatim + downsize its single base-colour PNG to 512.
    palm = os.environ.get("COCONUT_SRC") or os.path.join(os.path.dirname(_pack), "Coconut palm tree")
    pobj = os.path.join(palm, "CoconutPalmTree.obj")
    if os.path.isfile(pobj):
        shutil.copyfile(pobj, os.path.join(OUT, "CoconutPalmTree.obj"))
        ptex = os.path.join(palm, "CoconutPalmTree_BaseColor.png")
        im = Image.open(ptex).convert("RGB")
        if max(im.size) > 512:
            r = 512 / max(im.size)
            im = im.resize((round(im.size[0] * r), round(im.size[1] * r)), Image.LANCZOS)
        im.save(os.path.join(OUT, "CoconutPalmTree_BaseColor.png"), optimize=True)
        print("  coconut palm (obj) staged")
    else:
        print("  coconut palm NOT found at", palm)

    # resize + copy every referenced base texture
    for uri in sorted(needed_tex):
        src = os.path.join(SRC, uri)
        if not os.path.isfile(src):
            print("  TEX MISSING", uri); continue
        im = Image.open(src)
        mx = target_size(uri)
        if max(im.size) > mx:
            r = mx / max(im.size)
            im = im.resize((max(1, round(im.size[0] * r)), max(1, round(im.size[1] * r))), Image.LANCZOS)
        im.save(os.path.join(OUT, uri), optimize=True)
        print(f"  tex {uri:28} -> {im.size}")
    print(f"Done. {len(MODELS)} models, {len(needed_tex)} textures -> {OUT}")

if __name__ == "__main__":
    main()
