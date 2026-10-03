"""Small, closed HTML vocabulary. No URLs, CSS, SVG or embedded media survive."""
from html import escape
from html.parser import HTMLParser

TAGS = {"p", "br", "div", "strong", "b", "em", "i", "u", "s", "strike", "h1", "h2", "h3", "ol", "ul", "li", "sup", "sub", "span"}
DROP = {"script", "style", "iframe", "object", "embed", "svg", "math", "template"}
MAX_CONTENT = 60000


class Cleaner(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.html, self.plain, self.stack = [], [], []
        self.blocked = 0
        self.math_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in DROP:
            self.blocked += 1
        if self.blocked:
            return
        if tag not in TAGS:
            return
        attributes = dict(attrs)
        math = attributes.get("data-math") if tag in {"span", "div"} else None
        suffix = ""
        if math is not None:
            if len(math) > 4000:
                raise ValueError("Formula exceeds 4000 characters")
            suffix = f' data-math="{escape(math, quote=True)}" data-display="{'block' if attributes.get("data-display") in {"block", "true"} else 'inline'}"'
            if not self.math_depth:
                self.plain.append(math)
                self.math_depth = len(self.stack) + 1
        self.html.append(f"<{tag}{suffix}>")
        if tag != "br":
            if len(self.stack) >= 100:
                raise ValueError("Rich content nesting exceeds 100 levels")
            self.stack.append(tag)
        else:
            self.plain.append("\n")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag != "br":
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in DROP and self.blocked:
            self.blocked -= 1
            return
        if self.blocked or tag not in self.stack:
            return
        while self.stack:
            closing = self.stack.pop()
            self.html.append(f"</{closing}>")
            if closing in {"p", "div", "li", "h1", "h2", "h3"}:
                self.plain.append("\n")
            if self.math_depth and len(self.stack) < self.math_depth:
                self.math_depth = 0
            if closing == tag:
                break

    def handle_data(self, data):
        if not self.blocked and not self.math_depth:
            self.html.append(escape(data))
            self.plain.append(data)


def sanitize_rich(value: str | None) -> tuple[str | None, str | None]:
    if value is None:
        return None, None
    if len(value) > MAX_CONTENT:
        raise ValueError("Rich content exceeds 60000 characters")
    parser = Cleaner()
    parser.feed(value)
    parser.close()
    while parser.stack:
        parser.html.append(f"</{parser.stack.pop()}>")
    return "".join(parser.html), "".join(parser.plain).strip()


def has_content(item, text_field="options_text"):
    return bool(getattr(item, text_field, "").strip() or getattr(item, "image_media_id", None) or getattr(item, "audio_media_id", None))
