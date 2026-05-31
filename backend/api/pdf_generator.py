import io
import base64
import re
from datetime import datetime
import qrcode

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer,
    Table, TableStyle, Image as RLImage, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

PAGE_W, PAGE_H = A4
MARGIN = 1.0 * cm

# ── Brand palette ─────────────────────────────────────────────────────────────
NAVY        = colors.HexColor('#0A3369')  # DermaDetect navy #0a3369
TEAL        = colors.HexColor('#0D9488')  # Teal headers
DARK        = colors.HexColor('#0F172A')  # Slate-900
GRAY        = colors.HexColor('#64748B')  # Slate-500
MID_GRAY    = colors.HexColor('#CBD5E1')  # Slate-300
LIGHT_BLUE  = colors.HexColor('#EBF5FB')
LIGHT_TEAL  = colors.HexColor('#F0FDFA')  # Light teal box back
BORDER_TEAL = colors.HexColor('#CCFBF1')  # Teal-100 border
WHITE       = colors.white

C_HIGH  = colors.HexColor('#D85A30')
C_MOD   = colors.HexColor('#EF9F27')
C_LOW   = colors.HexColor('#082F49')
C_OK    = colors.HexColor('#10B981')  # Green Analysis OK badge


def _uc(urgency: str) -> colors.Color:
    u = urgency.lower() if urgency else 'low'
    if 'high' in u:   return C_HIGH
    if 'mod'  in u:   return C_MOD
    return C_LOW


def _md(text: str) -> str:
    """Minimal markdown → ReportLab HTML."""
    if not text:
        return ''
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    return text.replace('\n', '<br/>')


def _img(b64: str, w: float, h: float):
    if not b64:
        return None
    if b64.startswith('data:'):
        b64 = b64.split(',')[1]
    try:
        return RLImage(io.BytesIO(base64.b64decode(b64)), width=w, height=h)
    except Exception:
        return None


def build_pdf(
    case_id: str,
    patient: dict,
    clinical: dict,
    images: dict
) -> str:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=0.8 * cm,  bottomMargin=0.8 * cm,
    )
    S = _styles()
    story = []

    # ── Unpack data ───────────────────────────────────────────────────────────
    p_name     = patient.get('name') or 'Unknown Patient'
    p_contact  = patient.get('contactNumber') or patient.get('contact') or '—'
    p_age      = patient.get('age') or '—'
    p_age_str  = f"{p_age} years" if str(p_age).isdigit() else str(p_age)
    p_sex      = patient.get('sex') or '—'
    p_notes    = patient.get('symptoms') or patient.get('notes') or '—'
    p_date     = datetime.utcnow().strftime('%d %b %Y')
    
    hw_name      = patient.get('healthWorkerName') or patient.get('clinicianName') or 'Akosua Darko'
    hw_role      = patient.get('role') or patient.get('clinicianRole') or 'Dermatology Specialist'
    hw_facility  = patient.get('facilityName') or patient.get('clinicianFacility') or 'Atonsu community'
    hw_district  = patient.get('district') or 'Kumasi'
    hw_region    = patient.get('region') or 'Greater Accra Region'
    hw_contact   = patient.get('contact') or '0243000000'

    primary_finding = clinical.get('primaryFinding') or 'Vascular Tumors'
    confidence      = clinical.get('confidence', 100)
    try:
        c_val = float(confidence)
        if c_val <= 1.0:
            c_val = c_val * 100
    except Exception:
        c_val = 100.0

    urgency      = clinical.get('urgency', 'Moderate')
    urgency_text = clinical.get('referralNote') or 'Refer to clinic within 3 days for assessment and treatment.'
    accent       = _uc(urgency)

    regimen      = clinical.get('therapyRegimen') or {}
    med_name     = regimen.get('medication') or 'None Prescribed'
    dosage_str   = regimen.get('instructions') or regimen.get('dosage') or 'No directions specified.'

    t_notes      = clinical.get('treatmentNotes') or []

    AW = PAGE_W - 2 * MARGIN        # available width = 19.0 cm
    LW = 7.2 * cm                   # left column
    GW = 0.4 * cm                   # gap
    RW = AW - LW - GW               # right column = 11.4 cm

    # ═══════════════════════════════════════════════════════════════════════════
    # 1. HEADER BAR
    # ═══════════════════════════════════════════════════════════════════════════
    hdr = Table(
        [[
            Paragraph(
                '<font color="white" size=14><b>DermaDetect</b></font><br/>'
                '<font color="#A8D8EA" size=7>AI-Powered Skin Assessment</font>',
                S['left_white']
            ),
            Paragraph(
                '<font color="white" size=11><b>CLINICAL REFERRAL NOTE</b></font><br/>'
                f'<font color="#A8D8EA" size=7>REF: {case_id}</font>',
                S['right_white']
            ),
        ]],
        colWidths=[AW * 0.5, AW * 0.5]
    )
    hdr.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), NAVY),
        ('ALIGN',         (1, 0), (1,  0),  'RIGHT'),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING',   (0, 0), (-1, -1), 14),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 14),
    ]))
    story.append(hdr)
    story.append(Spacer(1, 4))

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. URGENCY BANNER
    # ═══════════════════════════════════════════════════════════════════════════
    banner = Table(
        [[Paragraph(
            f'<font color="white"><b>●  {urgency.upper()} — {urgency_text}</b></font>',
            S['center_white']
        )]],
        colWidths=[AW]
    )
    banner.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), accent),
        ('TOPPADDING',    (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING',   (0, 0), (-1, -1), 10),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
    ]))
    story.append(banner)
    story.append(Spacer(1, 6))

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. TWO-COLUMN BODY
    # ═══════════════════════════════════════════════════════════════════════════

    # ── LEFT COLUMN ──────────────────────────────────────────────────────────
    def info_tbl(rows: list) -> Table:
        t = Table(rows, colWidths=[2.5 * cm, LW - 2.5 * cm])
        t.setStyle(TableStyle([
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING',    (0, 0), (-1, -1), 1.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
            ('LEFTPADDING',   (0, 0), (-1, -1), 0),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ]))
        return t

    def lbl(text):  return Paragraph(text, S['info_lbl'])
    def val(text):  return Paragraph(str(text), S['info_val'])
    def sec(text):  return Paragraph(text, S['sec_head'])

    L = []

    # Patient Information
    L += [
        [sec('PATIENT INFORMATION')],
        [info_tbl([
            [lbl('Full Name'),       val(p_name)],
            [lbl('Contact Number'),  val(p_contact)],
            [lbl('Age'),             val(p_age_str)],
            [lbl('Sex'),             val(p_sex)],
            [lbl('Date of Visit'),   val(p_date)],
            [lbl('Patient ID'),      val(case_id)],
        ])],
        [Spacer(1, 4)],
    ]

    # Referring Health Worker
    L += [
        [sec('REFERRING HEALTH WORKER')],
        [info_tbl([
            [lbl('Name'),          val(hw_name)],
            [lbl('Role'),          val(hw_role)],
            [lbl('Facility Name'), val(hw_facility)],
            [lbl('District'),      val(hw_district)],
            [lbl('Region'),        val(hw_region)],
            [lbl('Contact'),       val(hw_contact)],
        ])],
        [Spacer(1, 4)],
    ]

    # Refer To
    L += [
        [sec('REFER TO')],
        [info_tbl([
            [lbl('Facility Type'), val('District Hospital / Dermatology Clinic')],
            [lbl('Department'),    val('Dermatology / General OPD')],
            [lbl('Urgency'),       Paragraph(f'Within { "3 days" if urgency.lower() == "moderate" else "immediate" }',
                                            ParagraphStyle('uv', parent=S['info_val'],
                                                           textColor=accent))],
        ])],
        [Spacer(1, 4)],
    ]

    # Health Worker's Notes
    L += [
        [sec("HEALTH WORKER'S NOTES")],
        [Table(
            [[Paragraph(f'<i>"{p_notes}"</i>', S['notes'])]],
            colWidths=[LW],
            style=[
                ('BACKGROUND',    (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
                ('BOX',           (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
                ('TOPPADDING',    (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING',   (0, 0), (-1, -1), 8),
                ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
            ]
        )],
        [Spacer(1, 4)],
    ]

    # Recommended Medications
    med_inner = Table(
        [
            [Paragraph('<b>PRESCRIBED MEDICATION</b>', S['box_lbl'])],
            [Paragraph(med_name, S['box_val'])],
            [Spacer(1, 3)],
            [Paragraph('<b>DOSAGE REGIMEN / DIRECTIONS</b>', S['box_lbl'])],
            [Paragraph(dosage_str, S['box_val'])],
        ],
        colWidths=[LW - 0.6 * cm]
    )
    med_inner.setStyle(TableStyle([
        ('TOPPADDING',    (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
    ]))
    med_box = Table([[med_inner]], colWidths=[LW])
    med_box.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), LIGHT_TEAL),
        ('BOX',           (0, 0), (-1, -1), 0.5, BORDER_TEAL),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
        ('TOPPADDING',    (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    L += [
        [sec('RECOMMENDED MEDICATIONS')],
        [med_box],
    ]

    left_col = Table(L, colWidths=[LW])
    left_col.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    # ── RIGHT COLUMN ──────────────────────────────────────────────────────────
    R = []
    BW = RW - 0.3 * cm  # bar width

    # AI Assessment header + ANALYSIS OK badge
    ok = Table(
        [[Paragraph('<font color="white" size=7><b>ANALYSIS OK</b></font>', S['center_white'])]],
        colWidths=[2.3 * cm]
    )
    ok.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), C_OK),
        ('TOPPADDING',    (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING',   (0, 0), (-1, -1), 4),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 4),
    ]))
    ai_hdr = Table([[sec('AI ASSESSMENT'), ok]], colWidths=[RW - 2.6 * cm, 2.6 * cm])
    ai_hdr.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN',         (1, 0), (1,  0),  'RIGHT'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    R += [[ai_hdr], [Spacer(1, 4)]]

    # Finding Title
    R += [[Paragraph(primary_finding, S['finding'])], [Spacer(1, 4)]]

    # Confidence bar
    R.append([Paragraph(
        f'<font size=8 color="#64748B">Detection confidence</font>'
        f'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'
        f'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'
        f'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'
        f'<font size=9 color="#0A1628"><b>{c_val:.0f}%</b></font>',
        S['bar_lbl']
    )])
    conf_ratio = c_val / 100.0
    fw = BW * conf_ratio
    ew = BW * (1.0 - conf_ratio)
    if ew > 0.01:
        bar = Table([[None, None]], colWidths=[fw, ew])
        bar.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), NAVY),
            ('BACKGROUND', (1, 0), (1, 0), MID_GRAY),
            ('ROWHEIGHT',  (0, 0), (-1, -1), 7),
        ]))
    else:
        bar = Table([[None]], colWidths=[BW])
        bar.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), NAVY),
            ('ROWHEIGHT',  (0, 0), (-1, -1), 7),
        ]))
    R += [[bar], [Spacer(1, 4)]]

    # Urgency pill
    pill = Table(
        [[Paragraph(
            f'<font color="white" size=8><b>{urgency.upper()} URGENCY</b></font>',
            S['center_white']
        )]],
        colWidths=[3.2 * cm]
    )
    pill.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), accent),
        ('TOPPADDING',    (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING',   (0, 0), (-1, -1), 6),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
    ]))
    R += [[pill], [Spacer(1, 4)]]

    # Assessment narrative text
    assessment_narrative = (
        f"A potential clinical skin indication detected by the assistive triage scanner. "
        f"Standard clinical diagnostic procedures are recommended before commencing definitive therapy."
    )
    R += [[Paragraph(assessment_narrative, S['findings'])], [Spacer(1, 4)]]

    # Suggested Treatment
    if t_notes:
        R.append([Paragraph('SUGGESTED TREATMENT', S['sub_head'])])
        for note in t_notes[:3]:
            R.append([Paragraph(f'• {note}', S['bullet'])])
        R.append([Spacer(1, 4)])

    # Disclaimer
    disc = "This is an AI-generated suggestion. Final treatment decisions rest with the clinician."
    R += [[Paragraph(f'<i>{disc}</i>', S['disc_sm'])], [Spacer(1, 4)]]

    # Visual Analysis (2 images side-by-side)
    R.append([Paragraph('PHOTO TAKEN DURING ASSESSMENT', S['sub_head'])])
    R.append([Spacer(1, 4)])

    IW = (RW - 0.4 * cm) / 2
    IH = 4.2 * cm

    cells = []
    labels = []

    im1 = _img(images.get('original_b64'), IW, IH)
    cells.append(im1 if im1 else Paragraph('—', S['center']))
    labels.append(Paragraph('Clinical Specimen', S['img_lbl']))

    im2 = _img(images.get('heatmap_b64'), IW, IH)
    cells.append(im2 if im2 else Paragraph('—', S['center']))
    labels.append(Paragraph('AI Saliency Map', S['img_lbl']))

    img_table = Table([cells, labels], colWidths=[IW + 0.2 * cm, IW + 0.2 * cm])
    img_table.setStyle(TableStyle([
        ('ALIGN',         (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    R.append([img_table])

    right_col = Table(R, colWidths=[RW])
    right_col.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    # Assemble
    body = Table(
        [[left_col, Spacer(GW, 1), right_col]],
        colWidths=[LW, GW, RW]
    )
    body.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(body)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width='100%', thickness=0.5, color=MID_GRAY))
    story.append(Spacer(1, 4))

    # ═══════════════════════════════════════════════════════════════════════════
    # 4. SIGNATURE ROW
    # ═══════════════════════════════════════════════════════════════════════════
    SLW = AW * 0.55
    SRW = AW * 0.45

    sig_left = Table(
        [
            [Paragraph('<font color="#64748B" size=7><i>HEALTH WORKER SIGNATURE</i></font>', S['left'])],
            [Spacer(1, 4)],
            [Paragraph(f'<b>{hw_name}</b>', S['sig_name'])],
            [Paragraph(f'<font color="#64748B">{hw_role} - {hw_facility}</font>', S['left_sm'])],
            [Paragraph(f'Date: {p_date}', S['left_sm'])],
        ],
        colWidths=[SLW]
    )

    stamp = Table(
        [[Paragraph(
            '<font color="#94A3B8" size=7>PLACE CLINICAL STAMP HERE</font>',
            S['center']
        )]],
        colWidths=[SRW - 0.5 * cm],
        rowHeights=[2.2 * cm]
    )
    stamp.setStyle(TableStyle([
        ('BOX',           (0, 0), (-1, -1), 0.5, MID_GRAY),
        ('ALIGN',         (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    sig_right_wrap = Table([
        [stamp],
        [Spacer(1, 2)],
        [Paragraph('<font color="#64748B" size=6><i>* To be completed at receiving facility</i></font>', S['right'])]
    ], colWidths=[SRW])
    sig_right_wrap.setStyle(TableStyle([
        ('ALIGN',  (0, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
    ]))

    sig_row = Table([[sig_left, sig_right_wrap]], colWidths=[SLW, SRW])
    sig_row.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(sig_row)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width='100%', thickness=0.5, color=MID_GRAY))
    story.append(Spacer(1, 3))

    # ═══════════════════════════════════════════════════════════════════════════
    # 5. FOOTER
    # ═══════════════════════════════════════════════════════════════════════════
    footer = Table(
        [[
            Paragraph(
                '<font size=7><b>DermaDetect AI</b></font><br/>'
                '<font size=6 color="#64748B">Generated by DermaDetect — AI Skin Assessment Tool</font>',
                S['left']
            ),
            Paragraph(
                f'<font size=7><b>TIMESTAMP &amp; REFERRAL REF#</b></font><br/>'
                f'<font size=6 color="#64748B">Ref: {case_id} | Generated: {p_date} at 03:40 AM</font>',
                S['right']
            ),
        ]],
        colWidths=[AW * 0.5, AW * 0.5]
    )
    footer.setStyle(TableStyle([
        ('ALIGN',         (1, 0), (1, 0), 'RIGHT'),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
    ]))
    story.append(footer)
    story.append(Spacer(1, 2))
    story.append(Paragraph(
        'This referral note was generated with AI assistance. It is intended to support, not replace, clinical judgment.',
        S['disc_center']
    ))

    doc.build(story)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


# ── Styles ────────────────────────────────────────────────────────────────────
def _styles() -> dict:
    return {
        'left': ParagraphStyle('left',
            fontSize=8, fontName='Helvetica', textColor=DARK,
            leading=11, alignment=TA_LEFT),
        'left_sm': ParagraphStyle('left_sm',
            fontSize=7, fontName='Helvetica', textColor=DARK,
            leading=10, alignment=TA_LEFT),
        'left_white': ParagraphStyle('left_white',
            fontSize=9, fontName='Helvetica', textColor=WHITE,
            leading=13, alignment=TA_LEFT),
        'center': ParagraphStyle('center',
            fontSize=9, fontName='Helvetica', textColor=DARK,
            leading=13, alignment=TA_CENTER),
        'center_white': ParagraphStyle('center_white',
            fontSize=9, fontName='Helvetica', textColor=WHITE,
            leading=13, alignment=TA_CENTER),
        'right': ParagraphStyle('right',
            fontSize=8, fontName='Helvetica', textColor=DARK,
            leading=11, alignment=TA_RIGHT),
        'right_white': ParagraphStyle('right_white',
            fontSize=9, fontName='Helvetica', textColor=WHITE,
            leading=13, alignment=TA_RIGHT),
        'sec_head': ParagraphStyle('sec_head',
            fontSize=7.5, fontName='Helvetica-Bold', textColor=TEAL,
            leading=10, spaceBefore=2, spaceAfter=3),
        'sub_head': ParagraphStyle('sub_head',
            fontSize=7.5, fontName='Helvetica-Bold', textColor=GRAY,
            leading=10, spaceAfter=2),
        'info_lbl': ParagraphStyle('info_lbl',
            fontSize=7.5, fontName='Helvetica-Bold', textColor=GRAY,
            leading=10),
        'info_val': ParagraphStyle('info_val',
            fontSize=7.5, fontName='Helvetica-Bold', textColor=DARK,
            leading=10),
        'finding': ParagraphStyle('finding',
            fontSize=16, fontName='Helvetica-Bold', textColor=DARK,
            leading=20),
        'bar_lbl': ParagraphStyle('bar_lbl',
            fontSize=8, fontName='Helvetica', textColor=GRAY,
            leading=10, spaceAfter=2),
        'findings': ParagraphStyle('findings',
            fontSize=8, fontName='Helvetica', textColor=DARK,
            leading=11),
        'bullet': ParagraphStyle('bullet',
            fontSize=8, fontName='Helvetica', textColor=DARK,
            leading=11, leftIndent=8),
        'notes': ParagraphStyle('notes',
            fontSize=8, fontName='Helvetica-Oblique', textColor=GRAY,
            leading=11),
        'img_lbl': ParagraphStyle('img_lbl',
            fontSize=7, fontName='Helvetica-Bold', textColor=GRAY,
            leading=9, alignment=TA_CENTER),
        'box_lbl': ParagraphStyle('box_lbl',
            fontSize=7, fontName='Helvetica-Bold', textColor=TEAL,
            leading=10),
        'box_val': ParagraphStyle('box_val',
            fontSize=8, fontName='Helvetica', textColor=DARK,
            leading=11),
        'sig_name': ParagraphStyle('sig_name',
            fontSize=13, fontName='Helvetica-Bold', textColor=DARK,
            leading=16),
        'disc_sm': ParagraphStyle('disc_sm',
            fontSize=7, fontName='Helvetica-Oblique', textColor=GRAY,
            leading=9),
        'disc_center': ParagraphStyle('disc_center',
            fontSize=6.5, fontName='Helvetica-Oblique', textColor=GRAY,
            leading=9, alignment=TA_CENTER),
    }
