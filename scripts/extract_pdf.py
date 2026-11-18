"""Extrai páginas reais. Nunca infere texto ou inventa paginação."""
import json, sys
try:
    import fitz
except ImportError:
    print('Instale PyMuPDF: python -m pip install pymupdf', file=sys.stderr)
    sys.exit(2)
doc = fitz.open(sys.argv[1])
pages, warnings = [], []
for i, page in enumerate(doc):
    text = page.get_text('text', sort=True)
    if not text.strip():
        try:
            tp = page.get_textpage_ocr(language='por+eng', dpi=150, full=True)
            text = page.get_text(textpage=tp)
        except Exception:
            warnings.append(f'Página {i+1}: sem texto; OCR não disponível ou falhou.')
    pages.append({'page': i+1, 'text': text, 'section': None})
print(json.dumps({'pages': pages, 'warnings': warnings}, ensure_ascii=False))
