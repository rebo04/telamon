#!/usr/bin/env python3
"""
Inyecta el catálogo y el motor TIS-F0124 dentro de index.html.

index.html es un PWA de un solo archivo servido tal cual desde GitHub Pages:
no hay bundler y el service worker lo cachea completo para operar offline en
el iPad. Por eso el motor tiene que vivir también inline.

Para que la copia inline NO pueda divergir de src/, no se escribe a mano: se
deriva mecánicamente de los módulos ES quitándoles import/export. El test
tests/unit/inline-sync.test.js falla si index.html quedó desactualizado.

Uso:
    python3 tools/sync-inline.py          # inyecta
    python3 tools/sync-inline.py --check  # sólo verifica (código 1 si difiere)
"""

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INDEX = REPO / "index.html"
MODULES = [REPO / "src" / "tis-f0124.js", REPO / "src" / "defect-code.js"]

BEGIN = "// <<< TIS-F0124 AUTOGENERADO — no editar aquí, ver tools/sync-inline.py"
END = "// >>> TIS-F0124 FIN AUTOGENERADO"


def strip_module_syntax(src):
    """Convierte un módulo ES en script plano equivalente."""
    # Bloques import { ... } from '...';
    src = re.sub(r"^import\s*\{[^}]*\}\s*from\s*'[^']*';\s*$", "",
                 src, flags=re.M | re.S)
    # Bloques export { ... }; (re-exportación)
    src = re.sub(r"^export\s*\{[^}]*\};\s*$", "", src, flags=re.M | re.S)
    # export const / export function
    src = re.sub(r"^export\s+(const|function|let)\b", r"\1", src, flags=re.M)
    if "export" in re.sub(r"//.*", "", src):
        sys.exit("ERROR: quedó sintaxis de módulo sin convertir")
    return src.strip()


def build_block():
    parts = []
    for m in MODULES:
        parts.append(f"// ── {m.name} " + "─" * (56 - len(m.name)))
        parts.append(strip_module_syntax(m.read_text(encoding="utf-8")))
    body = "\n\n".join(parts)
    return f"{BEGIN}\n{body}\n{END}"


def main():
    check = "--check" in sys.argv
    html = INDEX.read_text(encoding="utf-8")
    block = build_block()

    pattern = re.compile(
        re.escape(BEGIN) + r".*?" + re.escape(END), re.S)

    if not pattern.search(html):
        sys.exit(f"ERROR: no encontré los marcadores en index.html.\n"
                 f"Inserta estas dos líneas donde deba ir el motor:\n"
                 f"  {BEGIN}\n  {END}")

    nuevo = pattern.sub(lambda _: block, html, count=1)

    if check:
        if nuevo != html:
            sys.exit("DESINCRONIZADO: index.html no refleja src/. "
                     "Corre: python3 tools/sync-inline.py")
        print("✓ index.html sincronizado con src/")
        return

    if nuevo == html:
        print("✓ index.html ya estaba sincronizado")
    else:
        INDEX.write_text(nuevo, encoding="utf-8")
        print(f"✓ index.html actualizado ({len(block.splitlines())} líneas inyectadas)")


if __name__ == "__main__":
    main()
