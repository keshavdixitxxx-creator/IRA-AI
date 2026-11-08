"""Generate simple, valid Word, Excel, and PowerPoint files using only stdlib.

Agents return text/CSV/slide outlines; this module packages that work as OOXML in
memory. Files are returned to the browser as downloads and never written to Git.
"""

from __future__ import annotations

import csv
import io
import json
import re
import zipfile
from datetime import datetime, timezone
from xml.sax.saxutils import escape

MIME = {
    "word": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "powerpoint": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
EXTENSION = {"word": "docx", "excel": "xlsx", "powerpoint": "pptx"}
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
DOC_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
XML_SPACE = 'xml:space="preserve"'


def _xml(value) -> str:
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(value or ""))
    return escape(text, {"\"": "&quot;"})


def _clean(content) -> str:
    text = str(content or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    text = re.sub(r"^```(?:\w+)?\s*\n", "", text)
    text = re.sub(r"\n```\s*$", "", text)
    return text[:180_000]


def _filename(title: str, extension: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9]+", "-", title or "IRA-Office").strip("-")[:64] or "IRA-Office"
    return f"{stem}.{extension}"


def _zip(parts: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, xml in parts.items():
            archive.writestr(name, xml.encode("utf-8"))
    return buffer.getvalue()


def _root_relationship(target: str) -> str:
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{DOC_REL}/officeDocument" Target="{target}"/></Relationships>'''


def _core_properties(title: str) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>{_xml(title)}</dc:title><dc:creator>IRA Office</dc:creator><cp:lastModifiedBy>IRA Office</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified></cp:coreProperties>'''


def _word_paragraph(line: str, index: int) -> str:
    stripped = line.strip()
    if not stripped:
        return "<w:p/>"
    style = ""
    text = stripped
    if index == 0:
        style = '<w:pPr><w:pStyle w:val="Title"/></w:pPr>'
    elif re.match(r"^#{1,3}\s+", stripped):
        level = len(stripped) - len(stripped.lstrip("#"))
        text = stripped[level:].strip()
        style = f'<w:pPr><w:pStyle w:val="Heading{min(level, 2)}"/></w:pPr>'
    elif stripped.endswith(":") and len(stripped) < 100:
        style = '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>'
        text = stripped[:-1]
    if re.match(r"^[-*]\s+", text):
        text = "• " + text[2:].strip()
    return f'<w:p>{style}<w:r><w:t {XML_SPACE}>{_xml(text)}</w:t></w:r></w:p>'


def make_docx(title: str, content: str) -> bytes:
    paragraphs = "\n".join(_word_paragraph(line, index) for index, line in enumerate(_clean(content).split("\n")))
    document = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="17365D"/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="1F4E79"/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="2E75B6"/><w:sz w:val="25"/></w:rPr></w:style></w:styles>'''
    return _zip({
        "[Content_Types].xml": '''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>''',
        "_rels/.rels": _root_relationship("word/document.xml").replace("</Relationships>", f'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'),
        "word/document.xml": document,
        "word/styles.xml": styles,
        "word/_rels/document.xml.rels": f'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{DOC_REL}/styles" Target="styles.xml"/></Relationships>''',
        "docProps/core.xml": _core_properties(title),
    })


def _table_rows(content: str) -> list[list]:
    text = _clean(content)
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            parsed = parsed.get("rows") or parsed.get("data") or []
        if isinstance(parsed, list) and parsed:
            if isinstance(parsed[0], dict):
                headers = list(dict.fromkeys(key for row in parsed for key in row))
                return [headers] + [[row.get(key, "") for key in headers] for row in parsed]
            return [list(row) if isinstance(row, (list, tuple)) else [row] for row in parsed]
    except ValueError:
        pass
    lines = [line for line in text.split("\n") if line.strip()]
    if lines and "|" in lines[0]:
        rows = []
        for line in lines:
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells):
                continue
            rows.append(cells)
        return rows
    delimiter = "\t" if "\t" in text else ","
    return list(csv.reader(lines, delimiter=delimiter))


def _cell_ref(column: int, row: int) -> str:
    letters = ""
    value = column + 1
    while value:
        value, remainder = divmod(value - 1, 26)
        letters = chr(65 + remainder) + letters
    return f"{letters}{row}"


def _excel_cell(value, column: int, row: int) -> str:
    ref = _cell_ref(column, row)
    style = ' s="1"' if row == 1 else ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}"{style}><v>{value}</v></c>'
    text = str(value or "").strip()
    if row > 1 and re.fullmatch(r"=(?:SUM|AVERAGE|MIN|MAX|COUNT)\([A-Z]{1,3}\d+(?::[A-Z]{1,3}\d+)?\)", text, re.I):
        return f'<c r="{ref}"{style}><f>{_xml(text[1:].upper())}</f></c>'
    if row > 1 and re.fullmatch(r"-?(?:\d+\.?\d*|\.\d+)", text):
        return f'<c r="{ref}"{style}><v>{text}</v></c>'
    return f'<c r="{ref}" t="inlineStr"{style}><is><t {XML_SPACE}>{_xml(text)}</t></is></c>'


def make_xlsx(title: str, content: str) -> bytes:
    rows = _table_rows(content) or [["No data supplied"]]
    width = max(len(row) for row in rows)
    rows = [list(row) + [""] * (width - len(row)) for row in rows[:501]]
    sheet_rows = []
    for row_index, row in enumerate(rows, 1):
        cells = "".join(_excel_cell(value, column, row_index) for column, value in enumerate(row))
        sheet_rows.append(f'<row r="{row_index}">{cells}</row>')
    widths = []
    for column in range(width):
        size = min(42, max(10, max(len(str(row[column])) for row in rows[:100]) + 3))
        widths.append(f'<col min="{column + 1}" max="{column + 1}" width="{size}" customWidth="1"/>')
    sheet = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:{_cell_ref(width - 1, len(rows))}"/><cols>{''.join(widths)}</cols><sheetData>{''.join(sheet_rows)}</sheetData><autoFilter ref="A1:{_cell_ref(width - 1, len(rows))}"/></worksheet>'''
    workbook = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="{DOC_REL}"><sheets><sheet name="{_xml(title[:31] or 'IRA Data')}" sheetId="1" r:id="rId1"/></sheets></workbook>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'''
    return _zip({
        "[Content_Types].xml": '''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>''',
        "_rels/.rels": _root_relationship("xl/workbook.xml").replace("</Relationships>", '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'),
        "xl/workbook.xml": workbook,
        "xl/_rels/workbook.xml.rels": f'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{DOC_REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="{DOC_REL}/styles" Target="styles.xml"/></Relationships>''',
        "xl/worksheets/sheet1.xml": sheet,
        "xl/styles.xml": styles,
        "docProps/core.xml": _core_properties(title),
    })


def _slides(content: str, title: str) -> list[dict]:
    text = _clean(content)
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            parsed = parsed.get("slides") or []
        if isinstance(parsed, list) and parsed:
            return [{"title": str(item.get("title") or f"Slide {index + 1}"),
                     "bullets": [str(x) for x in (item.get("bullets") or item.get("points") or [])]}
                    for index, item in enumerate(parsed) if isinstance(item, dict)]
    except ValueError:
        pass
    slides = []
    current = None
    for raw in text.split("\n"):
        line = raw.strip()
        match = re.match(r"^(?:#+\s*)?(?:slide(?:\s*\d+)?\s*[:.\-])\s*(.+)$", line, re.I)
        if match:
            if current:
                slides.append(current)
            current = {"title": match.group(1).strip(), "bullets": []}
        elif line:
            if current is None:
                current = {"title": title, "bullets": []}
            current["bullets"].append(re.sub(r"^[-*•]\s*", "", line))
    if current:
        slides.append(current)
    if not slides:
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        for start in range(0, len(lines), 4):
            chunk = lines[start:start + 4]
            slides.append({"title": chunk[0] if start == 0 else f"Key points {start // 4 + 1}",
                           "bullets": chunk[1:] if start == 0 else chunk})
    return slides[:12] or [{"title": title, "bullets": ["Prepared by IRA Office"]}]


def _shape(shape_id: int, name: str, x: int, y: int, cx: int, cy: int, paragraphs: str) -> str:
    return f'''<p:sp><p:nvSpPr><p:cNvPr id="{shape_id}" name="{_xml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/>{paragraphs}</p:txBody></p:sp>'''


def _text_paragraph(text: str, size: int, color: str, bold: bool = False, bullet: bool = False) -> str:
    properties = ' marL="285750" indent="-171450"' if bullet else ""
    bullet_xml = '<a:buChar char="•"/>' if bullet else '<a:buNone/>'
    return f'''<a:p><a:pPr{properties}>{bullet_xml}</a:pPr><a:r><a:rPr lang="en-US" sz="{size}" b="{1 if bold else 0}" dirty="0"><a:solidFill><a:srgbClr val="{color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>{_xml(text)}</a:t></a:r></a:p>'''


def make_pptx(title: str, content: str) -> bytes:
    slides = _slides(content, title)
    parts = {}
    overrides = []
    slide_ids = []
    presentation_rels = [f'<Relationship Id="rId1" Type="{DOC_REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>']
    group = '''<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'''
    for index, slide in enumerate(slides, 1):
        title_text = _text_paragraph(slide["title"][:180], 3000 if index == 1 else 2600, "79C7FF", True)
        bullets = slide["bullets"][:7] or [" "]
        body_text = "".join(_text_paragraph(item[:280], 1900, "E4F2FF", False, True) for item in bullets)
        accent = '<p:sp><p:nvSpPr><p:cNvPr id="4" name="Accent"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="650000" y="1250000"/><a:ext cx="1500000" cy="45000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="2E9BFF"/></a:solidFill></p:spPr></p:sp>'
        footer = _shape(5, "Footer", 650000, 6350000, 9000000, 300000, _text_paragraph("IRA OFFICE · GENERATED WORKSPACE", 900, "6B8DAE"))
        slide_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{DOC_REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="07152F"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>{group}{_shape(2, 'Title', 650000, 520000, 10800000, 650000, title_text)}{accent}{_shape(3, 'Content', 800000, 1650000, 10300000, 4050000, body_text)}{footer}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'''
        parts[f"ppt/slides/slide{index}.xml"] = slide_xml
        parts[f"ppt/slides/_rels/slide{index}.xml.rels"] = f'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{DOC_REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'''
        overrides.append(f'<Override PartName="/ppt/slides/slide{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>')
        slide_ids.append(f'<p:sldId id="{255 + index}" r:id="rId{index + 1}"/>')
        presentation_rels.append(f'<Relationship Id="rId{index + 1}" Type="{DOC_REL}/slide" Target="slides/slide{index}.xml"/>')
    parts["ppt/presentation.xml"] = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{DOC_REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>{''.join(slide_ids)}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'''
    parts["ppt/_rels/presentation.xml.rels"] = f'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{REL}">{''.join(presentation_rels)}</Relationships>'''
    parts["ppt/slideMasters/slideMaster1.xml"] = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{DOC_REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>{group}</p:spTree></p:cSld><p:clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3000"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1900"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>'''
    parts["ppt/slideMasters/_rels/slideMaster1.xml.rels"] = f'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{DOC_REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="{DOC_REL}/theme" Target="../theme/theme1.xml"/></Relationships>'''
    parts["ppt/slideLayouts/slideLayout1.xml"] = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{DOC_REL}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="IRA Blank"><p:spTree>{group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'''
    parts["ppt/slideLayouts/_rels/slideLayout1.xml.rels"] = f'''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{DOC_REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'''
    colors = {"dk1":"07152F","lt1":"FFFFFF","dk2":"10294D","lt2":"E4F2FF","accent1":"2E9BFF","accent2":"79C7FF","accent3":"41D9C0","accent4":"8D7CFF","accent5":"4D83C4","accent6":"A8C8E8","hlink":"79C7FF","folHlink":"8D7CFF"}
    color_xml = "".join(f'<a:{name}><a:srgbClr val="{value}"/></a:{name}>' for name, value in colors.items())
    parts["ppt/theme/theme1.xml"] = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="IRA Blue"><a:themeElements><a:clrScheme name="IRA Blue">{color_xml}</a:clrScheme><a:fontScheme name="IRA"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="IRA"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'''
    parts["[Content_Types].xml"] = f'''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>{''.join(overrides)}</Types>'''
    parts["_rels/.rels"] = _root_relationship("ppt/presentation.xml").replace("</Relationships>", '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>')
    parts["docProps/core.xml"] = _core_properties(title)
    return _zip(parts)


def create_office_file(kind: str, title: str, content: str) -> tuple[str, str, bytes]:
    if kind not in MIME:
        raise ValueError("File type must be word, excel, or powerpoint.")
    title = " ".join((title or "IRA Office Work").split())[:120]
    if not _clean(content):
        raise ValueError("Document content is required.")
    makers = {"word": make_docx, "excel": make_xlsx, "powerpoint": make_pptx}
    payload = makers[kind](title, content)
    return _filename(title, EXTENSION[kind]), MIME[kind], payload
