"""Draws the app icons (a die showing five on green) with only the standard library.

Usage: python3 scripts/make-icons.py
"""
import struct
import zlib
from pathlib import Path

GREEN = (40, 167, 69)
WHITE = (255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / 'public' / 'icons'


def draw(size):
    # Keep the die inside the maskable safe zone (central 80%).
    die_half = size * 0.30
    corner = size * 0.07
    pip_r = size * 0.055
    c = size / 2
    pip_offset = die_half * 0.55
    pips = [(c, c)] + [(c + dx * pip_offset, c + dy * pip_offset) for dx in (-1, 1) for dy in (-1, 1)]

    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            dx = max(abs(px - c) - (die_half - corner), 0)
            dy = max(abs(py - c) - (die_half - corner), 0)
            in_die = dx * dx + dy * dy <= corner * corner
            on_pip = any((px - qx) ** 2 + (py - qy) ** 2 <= pip_r ** 2 for qx, qy in pips)
            row.extend(GREEN if on_pip or not in_die else WHITE)
        rows.append(bytes(row))
    return b''.join(rows)


def png(size):
    def chunk(kind, data):
        body = kind + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body))

    header = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header)
            + chunk(b'IDAT', zlib.compress(draw(size), 9)) + chunk(b'IEND', b''))


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        (OUT / f'icon-{size}x{size}.png').write_bytes(png(size))
        print(f'wrote icons/icon-{size}x{size}.png')
