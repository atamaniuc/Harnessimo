"""Redirect stubs for the translated copies of a retired page.

`mkdocs-redirects` knows one page tree. `mkdocs-static-i18n` builds one per
locale, English at the root and the rest under `/<locale>/`. Put a suffixed
entry in `redirect_maps` and the result is a directory called `ADOPTING.ru/`
at the root — a URL nobody has ever visited — while `/ru/ADOPTING/`, which is
the one that was published and shared, answers 404.

So the locale copies are written here instead, from the same map, after the
build. The English redirect stays with the plugin; this only fills the gap the
plugin cannot see.
"""

from pathlib import Path
import shutil

STUB = """<!doctype html>
<html lang="{locale}">
<head>
<meta charset="utf-8">
<title>Redirecting…</title>
<link rel="canonical" href="{href}">
<meta http-equiv="refresh" content="0; url={href}">
<script>var a=window.location.hash.substr(1);location.href="{href}"+(a?"#"+a:"")</script>
</head>
<body>This page moved to <a href="{href}">{href}</a>.</body>
</html>
"""


def on_post_build(config, **_):
    site = Path(config["site_dir"])
    redirects = {}
    locales = []
    for plugin_name, plugin in config["plugins"].items():
        if plugin_name.endswith("redirects"):
            redirects = plugin.config.get("redirect_maps", {})
        if plugin_name.endswith("i18n"):
            locales = [
                language.locale
                for language in plugin.config.get("languages", [])
                if not language.default
            ]

    for source, target in redirects.items():
        for locale in locales:
            suffix = f".{locale}.md"
            if not source.endswith(suffix):
                continue
            name = source[: -len(suffix)]
            destination = target[: -len(suffix)] if target.endswith(suffix) else target[:-3]

            # What the plugin produced at the root, for a URL that does not exist.
            shutil.rmtree(site / f"{name}.{locale}", ignore_errors=True)

            page = site / locale / name
            page.mkdir(parents=True, exist_ok=True)
            (page / "index.html").write_text(
                STUB.format(locale=locale, href=f"../{destination}/"),
                encoding="utf-8",
            )
