#NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
#SAHIL JABIR KHAN 24AD1199
#
# TEST FILES FOR THE BROWSER CHECKS
#   python tools/make_test_files.py        -> web/e2e/assets/
#
# Writes one story (a library reopening) as four outlets in four formats - .txt, .md, .pdf (with a real
# text layer) and .docx - plus files that must be rejected with a clear message: a PDF without text
# (like a scan), a damaged PDF, a .docx that is not a Word file, an empty .txt and an unsupported .rtf.
# Only the standard library is used: the PDF and DOCX are assembled by hand.

import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "e2e", "assets")

STORY = {
    "city-wire.txt": ("Source: City Wire\nEvent: L1\nTitle: Central library reopens\n\n",
        ["The central library reopened on Saturday after a two year renovation.",
         "The mayor cut the ribbon in front of several hundred residents.",
         "The building now has a children's wing and a rooftop reading garden.",
         "The renovation cost 46 crore rupees, according to the municipal corporation.",
         "Opening hours have been extended until ten at night on weekdays."]),
    "morning-ledger.md": ("Source: Morning Ledger\nEvent: L1\n\n",
        ["After two years of renovation work, the central library opened its doors again on Saturday.",
         "Residents gathered as the mayor cut the ribbon at the main entrance.",
         "A new children's wing and a reading garden on the roof have been added.",
         "The municipal corporation said the project cost 46 crore rupees.",
         "Membership fees for students have been waived for the first year."]),
    "harbour-post.pdf": (None,
        ["The renovated central library was reopened by the mayor on Saturday.",
         "The two year project added a children's wing and a rooftop garden for readers.",
         "Officials put the total cost of the work at 46 crore rupees.",
         "The library will now stay open until ten at night on weekdays.",
         "Several staff members said the old card catalogue has been fully digitised."]),
    "evening-herald.docx": (None,
        ["Saturday saw the central library reopen after renovation lasting two years.",
         "The mayor opened the building in front of a crowd of residents.",
         "Readers can now use a dedicated children's wing and a garden on the roof.",
         "Some residents complained that parking near the library is still very limited."]),
}


def pdf_escape(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def write_pdf(path, lines):
    """A one-page PDF with a Helvetica text layer (lines=None draws only a rectangle, like a scan)."""
    if lines:
        body = ["BT", "/F1 11 Tf", "14 TL", "72 740 Td"]
        for ln in lines:
            body.append("(%s) Tj T*" % pdf_escape(ln))
        body.append("ET")
    else:
        body = ["0.6 g", "72 400 450 300 re f"]
    stream = "\n".join(body).encode("latin-1")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    with open(path, "wb") as fh:
        fh.write(out)


def xml_escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def write_docx(path, paragraphs):
    W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    body = "".join("<w:p><w:r><w:t xml:space=\"preserve\">%s</w:t></w:r></w:p>" % xml_escape(p) for p in paragraphs)
    files = {
        "[Content_Types].xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '</Types>'),
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="word/document.xml"/></Relationships>'),
        "word/document.xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="%s"><w:body>%s</w:body></w:document>' % (W, body)),
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            # fixed timestamp so the file is byte-identical on every run
            z.writestr(zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0)), data, zipfile.ZIP_DEFLATED)


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (header, sents) in STORY.items():
        path = os.path.join(OUT, name)
        if name.endswith(".pdf"):
            write_pdf(path, ["Source: Harbour Post", "Event: L1", ""] + sents)
        elif name.endswith(".docx"):
            write_docx(path, ["Source: Evening Herald", "Event: L1", ""] + sents)
        else:
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(header + " ".join(sents) + "\n")
    write_pdf(os.path.join(OUT, "scanned-page.pdf"), None)
    with open(os.path.join(OUT, "damaged.pdf"), "wb") as fh:
        fh.write(b"%PDF-1.4\nthis is not really a pdf file at all\n")
    with open(os.path.join(OUT, "not-word.docx"), "wb") as fh:
        fh.write(b"plain text pretending to be a Word document")
    open(os.path.join(OUT, "empty.txt"), "wb").close()
    with open(os.path.join(OUT, "notes.rtf"), "w", encoding="utf-8") as fh:
        fh.write("{\\rtf1 Not supported here.}")
    print("wrote", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
