import re

_MD_IMAGE_LINK = re.compile(r'!\[([^\]]*)\]\((?:https?|ftp)://[^\s)]+(?:\s+"[^"]*")?\)')
_MD_LINK = re.compile(r'\[([^\]]+)\]\((?:https?|ftp)://[^\s)]+(?:\s+"[^"]*")?\)')
_RAW_URL = re.compile(r'(?<!\()(?<!\[)\b(?:https?|ftp)://[^\s)>\]}]+')
_HTML_A = re.compile(r'<a\s+[^>]*href="[^"]+"[^>]*>(.*?)</a>', re.IGNORECASE)

def strip_links(text: str) -> str:
    """
    删除/去除各种形式的链接：
    - Markdown 图片/超链接: ![alt](url), [text](url) -> 仅保留可读文本
    - 裸露 URL: http(s)://... -> 删除
    - HTML <a href="...">text</a> -> 仅保留 text
    """
    if not text:
        return text
    # 先去图片链接再去普通链接，避免相互影响
    text = _MD_IMAGE_LINK.sub(r'\1', text)
    text = _MD_LINK.sub(r'\1', text)
    text = _HTML_A.sub(r'\1', text)
    text = _RAW_URL.sub('', text)
    # 可选：把多余的空格收一收
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return text