import re

def strip_links(text: str) -> str:
    """
    仅删除裸露的 http(s) URL，不破坏 Markdown/LaTeX 格式。
    例如：
      "See http://example.com" -> "See "
      "Refer to [Doc](http://example.com)" -> 保留 "[Doc](http://example.com)"
      "\\frac{a}{b}" -> 保留不变
    """
    if not text:
        return text
    text = re.sub(
        r'(?<!\]\()https?://[^\s)]+',
        '',
        text
    )

    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()