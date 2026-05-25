import io
import base64
import re
from datetime import datetime
import qrcode

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer,
    Table, TableStyle, Image as RLImage, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm

# DermaDetect Branding Colors
C_BLUE     = colors.HexColor('#0077b6')
LIGHT_BLUE = colors.HexColor('#e0f2fe')
DARK       = colors.HexColor('#181c1e')
GRAY       = colors.HexColor('#555f71')
LIGHT_GRAY = colors.HexColor('#bccac1')


def _markdown_to_rl(text: str) -> str:
    """Very basic markdown to ReportLab HTML conversion."""
    if not text:
        return ""
    # Convert **bold** to <b>bold</b>
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    # Convert newlines
    text = text.replace('\n', '<br/>')
    return text


def build_pdf(
    case_id: str,
    patient: dict,
    clinical: dict,
    images: dict
) -> str:
    """
    Builds the DermaDetect PDF report.
    Returns base64-encoded PDF string.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN,  bottomMargin=MARGIN,
    )

    styles = _build_styles()
    story  = []

    # ── Header ──────────────────────────────────────────────────────
    story.append(Paragraph("DermaDetect", styles['title']))
    story.append(Paragraph("AI-Assisted Dermatology Analysis Report", styles['subtitle']))
    story.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} | Case ID: {case_id}",
        styles['meta']
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=C_BLUE, spaceAfter=12))

    # ── Patient Context ──────────────────────────────────────────────
    p_name = patient.get('name', 'Unknown Patient')
    p_age  = patient.get('age', 'N/A')
    p_sex  = patient.get('sex', 'N/A')
    story.append(Paragraph(f"<b>Patient:</b> {p_name} | <b>Age:</b> {p_age} | <b>Sex:</b> {p_sex}", styles['body']))
    story.append(Spacer(1, 12))

    # ── Prediction summary table ─────────────────────────────────────
    story.append(Paragraph("AI Triage Summary", styles['section']))
    story.append(Spacer(1, 6))

    primary_finding = clinical.get('primaryFinding', 'Unknown')
    confidence      = clinical.get('confidence', 0)
    urgency         = clinical.get('urgency', 'Unknown')

    summary_data = [
        ['Primary Finding', 'Confidence', 'Urgency Level'],
        [primary_finding, f"{confidence}%", urgency.upper()],
    ]

    table = Table(summary_data, colWidths=[7*cm, 4*cm, 5*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND',  (0,0), (-1,0), C_BLUE),
        ('TEXTCOLOR',   (0,0), (-1,0), colors.white),
        ('FONTNAME',    (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',    (0,0), (-1,0), 10),
        ('BACKGROUND',  (0,1), (-1,-1), LIGHT_BLUE),
        ('FONTSIZE',    (0,1), (-1,-1), 10),
        ('ALIGN',       (0,0), (-1,-1), 'CENTER'),
        ('VALIGN',      (0,0), (-1,-1), 'MIDDLE'),
        ('ROWHEIGHT',   (0,0), (-1,-1), 22),
        ('GRID',        (0,0), (-1,-1), 0.5, C_BLUE),
    ]))
    story.append(table)
    story.append(Spacer(1, 16))

    # ── Images ──────────────────────────────────────────────────────
    story.append(Paragraph("Visual Analysis", styles['section']))
    story.append(Spacer(1, 6))

    img_row = []
    img_labels = []

    for key, label in [
        ('original_b64', 'Original Lesion'),
        ('heatmap_b64',  'AI Saliency Map'),
    ]:
        b64 = images.get(key)
        if b64:
            # Strip data URI scheme if present
            if b64.startswith("data:"):
                b64 = b64.split(",")[1]
            try:
                img_buf = io.BytesIO(base64.b64decode(b64))
                rl_img  = RLImage(img_buf, width=6*cm, height=6*cm)
                img_row.append(rl_img)
                img_labels.append(label)
            except Exception:
                pass

    if img_row:
        img_table = Table(
            [img_row, [Paragraph(l, styles['img_label']) for l in img_labels]],
            colWidths=[6.5*cm] * len(img_row)
        )
        img_table.setStyle(TableStyle([
            ('ALIGN',  (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(img_table)
        story.append(Spacer(1, 16))

    # ── Clinical report sections ──────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GRAY, spaceAfter=8))
    story.append(Paragraph("AI Clinical Evaluation", styles['section']))
    story.append(Spacer(1, 6))

    referral_note = clinical.get('referralNote', '')
    if referral_note:
        html_note = _markdown_to_rl(referral_note)
        for part in html_note.split('<br/>'):
            if part.strip():
                story.append(Paragraph(part.strip(), styles['body']))
                story.append(Spacer(1, 4))
    
    story.append(Spacer(1, 12))

    # Treatment Notes (Legacy)
    t_notes = clinical.get('treatmentNotes', [])
    if t_notes:
        story.append(Paragraph("Treatment Action Plan", styles['subsection']))
        for note in t_notes:
            story.append(Paragraph(f"• {note}", styles['body_bullet']))
        story.append(Spacer(1, 8))

    # Therapy Regimen
    regimen = clinical.get('therapyRegimen', {})
    if regimen:
        story.append(Paragraph("Prescribed Therapy Regimen", styles['subsection']))
        story.append(Paragraph(f"<b>Medication:</b> {regimen.get('medication', 'N/A')}", styles['body']))
        story.append(Paragraph(f"<b>Dosage:</b> {regimen.get('dosage', 'N/A')}", styles['body']))
        story.append(Paragraph(f"<b>Duration:</b> {regimen.get('duration', 'N/A')}", styles['body']))
        story.append(Paragraph(f"<b>Instructions:</b> {regimen.get('instructions', 'N/A')}", styles['body']))
        story.append(Spacer(1, 8))

    # Patient Handout (Dos and Don'ts)
    handout = clinical.get('patientHandout', {})
    if handout:
        story.append(Paragraph("Patient Handout", styles['subsection']))
        dos = handout.get('dos', [])
        donts = handout.get('donts', [])
        if dos:
            story.append(Paragraph("<b>Do's:</b>", styles['body']))
            for item in dos:
                story.append(Paragraph(f"• {item}", styles['body_bullet']))
        if donts:
            story.append(Paragraph("<b>Don'ts:</b>", styles['body']))
            for item in donts:
                story.append(Paragraph(f"• {item}", styles['body_bullet']))
        story.append(Spacer(1, 8))

    # Recommended Action
    action = clinical.get('recommendedAction', '')
    if action:
        story.append(Paragraph("Recommended Action", styles['subsection']))
        story.append(Paragraph(action, styles['body']))
        story.append(Spacer(1, 8))

    # ── Footer / Signature ─────────────────────────────────────────────
    # Push to bottom visually
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GRAY, spaceBefore=12, spaceAfter=12))

    # Generate QR Code
    qr = qrcode.QRCode(box_size=3, border=1)
    qr.add_data(f"https://secure.dermadetect.app/verify/{case_id}")
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    rl_qr = RLImage(qr_buf, width=2.5*cm, height=2.5*cm)
    
    hw_name = patient.get('healthWorkerName') or 'K. Mensah'
    
    sig_cell = Paragraph(
        f"<font color='#555f71' size=8><i>Digital Verified Signature</i></font><br/><br/>"
        f"<font size=14><b>{hw_name}</b></font><br/>"
        f"<font color='#181c1e'>________________________</font>",
        styles['body']
    )
    
    qr_text = Paragraph(
        "<font size=7 color='#3d4943'><b>Verify on<br/>DermaDetect Secure<br/>Web Cloud</b></font>",
        styles['body']
    )
    
    sig_table = Table([[sig_cell, rl_qr, qr_text]], colWidths=[10*cm, 3*cm, 3.5*cm])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (0,0), 'LEFT'),
        ('ALIGN', (1,0), (2,0), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
    ]))
    story.append(sig_table)
    
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Disclaimer: This assessment is AI-assisted using the advanced <b>DermaVision</b> language model "
        "developed by <b>PreWorks</b>. It is intended to support, not replace, clinical judgment "
        "by a qualified healthcare professional.",
        styles['disclaimer']
    ))

    doc.build(story)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def _build_styles() -> dict:
    base = getSampleStyleSheet()
    return {
        'title': ParagraphStyle('title',
            fontSize=22, fontName='Helvetica-Bold',
            textColor=C_BLUE, alignment=TA_CENTER, spaceAfter=4, leading=26),
        'subtitle': ParagraphStyle('subtitle',
            fontSize=11, fontName='Helvetica',
            textColor=DARK, alignment=TA_CENTER, spaceAfter=2, leading=14),
        'meta': ParagraphStyle('meta',
            fontSize=8, fontName='Helvetica',
            textColor=GRAY, alignment=TA_CENTER, spaceAfter=10, leading=10),
        'section': ParagraphStyle('section',
            fontSize=13, fontName='Helvetica-Bold',
            textColor=C_BLUE, spaceAfter=8, leading=16),
        'subsection': ParagraphStyle('subsection',
            fontSize=11, fontName='Helvetica-Bold',
            textColor=DARK, spaceAfter=4, leading=14),
        'body': ParagraphStyle('body',
            fontSize=10, fontName='Helvetica',
            textColor=DARK, leading=14, alignment=TA_LEFT),
        'body_bullet': ParagraphStyle('body_bullet',
            fontSize=10, fontName='Helvetica',
            textColor=DARK, leading=14, alignment=TA_LEFT, leftIndent=12),
        'img_label': ParagraphStyle('img_label',
            fontSize=8, fontName='Helvetica-Bold',
            textColor=GRAY, alignment=TA_CENTER),
        'disclaimer': ParagraphStyle('disclaimer',
            fontSize=8, fontName='Helvetica',
            textColor=GRAY, alignment=TA_CENTER),
    }
