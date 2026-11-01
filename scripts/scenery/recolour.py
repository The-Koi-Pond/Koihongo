# Recolours Xel's pixel art for each colour theme (src/theme.ts): the banner
# scenery and the panel frame. (The wordmark takes its colours from the theme
# directly: src/ui/Wordmark.tsx.)
#
# Run from the repo root (needs Python 3 and Pillow: `pip install pillow`):
#
#     python scripts/scenery/recolour.py
#
# It reads the original pictures in src/assets/ (never changing them) and
# writes recoloured copies next to them, in a folder named after the theme:
# scenery/hills.png → scenery/night-water/hills.png.
#
# Each colour is swapped by its lightness: the darkest colour in a picture
# becomes the first colour of the theme's ramp, the lightest becomes the last,
# and everything in between is blended along the ramp in OKLab (a colour space
# where equal steps look equally different). So the pixel art's shading
# survives while its hue changes. Transparent pixels and the picture sizes
# stay as they are.
#
# Not recoloured: treeline-front.png (only a stencil; CSS paints it) and the
# cherry blossoms (kept as they are in every theme).

from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parents[2] / "src" / "assets"

# The bushes' ramps start at the theme's page colour, like the original's
# darkest navy is the purple page colour, so the bushes melt into the page.
# Most of a bush is a dark mid-tone, so the ramp climbs quickly from there.
BUSHES_NIGHT_WATER = ["#0b171b", "#10404a", "#1a5e66", "#2f8085", "#6cb8b2", "#d2f4ee"]
BUSHES_LANTERN_DUSK = ["#141b1b", "#173f37", "#215a4d", "#327563", "#78a88a", "#e6efcf"]

# Per theme, per picture (path inside src/assets/): the ramp, dark to light.
THEMES = {
    # Cold and moonlit: teal hills with pale moonlit ridges, deep teal bushes,
    # a jade frame.
    "night-water": {
        "scenery/hills.png": ["#0f2a30", "#1b4a52", "#2a6a70", "#4f9aa0", "#b8ecea"],
        "scenery/newTreesLeft.png": BUSHES_NIGHT_WATER,
        "scenery/newTreesRight.png": BUSHES_NIGHT_WATER,
        "ui/frame.png": ["#0b2a30", "#2f6a70", "#5f9c98", "#9fd4c8", "#e8fff8"],
    },
    # Warm dusk: dark teal-stone hills whose lit ridges (the pink rims) go amber,
    # deep jade bushes. The hills stay teal until the rims, so the middle never
    # turns olive. A copper frame.
    "lantern-dusk": {
        "scenery/hills.png": ["#17201f", "#1f2c2b", "#283a37", "#334a44", "#42594f", "#7f6e57", "#c79860", "#f2c46d"],
        "scenery/newTreesLeft.png": BUSHES_LANTERN_DUSK,
        "scenery/newTreesRight.png": BUSHES_LANTERN_DUSK,
        "ui/frame.png": ["#2a1a12", "#6b4530", "#a0704c", "#e0b07a", "#fff0d6"],
    },
}


# --- OKLab (https://bottosson.github.io/posts/oklab/) ---

def to_linear(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def from_linear(c):
    c = 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return max(0, min(255, round(c * 255)))


def rgb_to_oklab(rgb):
    r, g, b = (to_linear(c) for c in rgb)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )


def oklab_to_rgb(lab):
    L, a, b = lab
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return (
        from_linear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        from_linear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        from_linear(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
    )


def hex_to_rgb(colour):
    return tuple(int(colour[i : i + 2], 16) for i in (1, 3, 5))


# --- the recolour ---

def along_ramp(ramp, t):
    """The colour at t (0 to 1) along the ramp, blended in OKLab."""
    x = t * (len(ramp) - 1)
    k = min(len(ramp) - 2, int(x))
    f = x - k
    a, b = ramp[k], ramp[k + 1]
    return oklab_to_rgb(tuple(a[i] * (1 - f) + b[i] * f for i in range(3)))


def recolour(image, ramp_hex):
    ramp = [rgb_to_oklab(hex_to_rgb(c)) for c in ramp_hex]
    pixels = image.load()
    width, height = image.size

    # The picture's own colours (ignoring fully transparent pixels) and their lightness.
    colours = {pixels[x, y][:3] for y in range(height) for x in range(width) if pixels[x, y][3] > 0}
    lightness = {c: rgb_to_oklab(c)[0] for c in colours}
    lo, hi = min(lightness.values()), max(lightness.values())
    new = {c: along_ramp(ramp, (l - lo) / (hi - lo) if hi > lo else 0) for c, l in lightness.items()}

    for y in range(height):
        for x in range(width):
            r, g, b, alpha = pixels[x, y]
            if alpha > 0:
                pixels[x, y] = (*new[(r, g, b)], alpha)
    return image


def main():
    for theme, pictures in THEMES.items():
        for path, ramp in pictures.items():
            original = ASSETS / path
            out = original.parent / theme / original.name
            out.parent.mkdir(exist_ok=True)
            image = Image.open(original).convert("RGBA")
            recolour(image, ramp).save(out)
            print(f"wrote {out}")


if __name__ == "__main__":
    main()
