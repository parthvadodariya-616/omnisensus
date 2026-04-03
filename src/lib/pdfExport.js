// src/lib/pdfExport.js
// Secure client-side report export: PDF pages are rendered as images.
import jsPDF from 'jspdf';

const CANVAS_WIDTH_PX = 1440;
const CANVAS_BUFFER_HEIGHT_PX = 12000;
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;

const palette = {
  teal: '#10847E',
  tealSoft: '#E8F5F4',
  text: '#161C24',
  muted: '#6A7381',
  line: '#DFE7EE',
  alt: '#F7FAFC',
  danger: '#DC2626',
  warning: '#D97706',
  success: '#059669',
  white: '#FFFFFF',
};

const toNumber = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const pickNumber = (values, fallback = null) => {
  for (const value of values) {
    const n = toNumber(value);
    if (n != null) return n;
  }
  return fallback;
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const riskStatus = (riskPct, threshold = 35) => (riskPct >= threshold ? 'High Risk' : 'Low Risk');

const tierFromScore = (score) => {
  if (score == null) return 'Unknown';
  if (score >= 70) return 'Stable';
  if (score >= 50) return 'Borderline';
  return 'Critical';
};

const normalizeDomainRisks = (report) => {
  const raw = report?.raw_risks || {};
  const ds = report?.domain_scores || {};

  const cardiovascular = clamp(pickNumber([
    report?.cvd,
    report?.cardiovascular,
    raw?.heart_pct,
    raw?.cardiovascular_pct,
    ds?.cardiovascular != null ? 100 - Number(ds.cardiovascular) : null,
  ], 0), 0, 100);

  const metabolic = clamp(pickNumber([
    report?.meta,
    report?.metabolic,
    raw?.diabetes_pct,
    ds?.metabolic != null ? 100 - Number(ds.metabolic) : null,
  ], 0), 0, 100);

  const renal = clamp(pickNumber([
    report?.renal,
    raw?.kidney_pct,
    ds?.renal != null ? 100 - Number(ds.renal) : null,
  ], 0), 0, 100);

  return { cardiovascular, metabolic, renal };
};

const collectBiomarkers = (report) => {
  const vitals = report?.vitals || report?.input_vitals || {};
  const get = (...keys) => {
    for (const key of keys) {
      if (report?.[key] != null && report[key] !== '') return report[key];
      if (vitals?.[key] != null && vitals[key] !== '') return vitals[key];
    }
    return null;
  };

  return [
    ['Blood Glucose', get('glucose', 'blood_glucose'), 'mg/dL'],
    ['HbA1c', get('hba1c'), '%'],
    ['Systolic BP', get('bp_sys', 'blood_pressure_sys', 'sbp'), 'mmHg'],
    ['Diastolic BP', get('bp_dia', 'blood_pressure_dia', 'dbp'), 'mmHg'],
    ['eGFR', get('egfr'), 'mL/min'],
    ['Serum Creatinine', get('creatinine'), 'mg/dL'],
    ['BMI', get('bmi'), 'kg/m²'],
  ].filter(([, value]) => value != null);
};

const roundedRectPath = (ctx, x, y, w, h, radius) => {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawRoundedRect = (ctx, x, y, w, h, radius, fill, stroke, lineWidth = 1) => {
  roundedRectPath(ctx, x, y, w, h, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
};

const fitText = (ctx, value, maxWidth) => {
  const input = String(value ?? '—');
  if (ctx.measureText(input).width <= maxWidth) return input;
  let text = input;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}…`;
};

const wrapText = (ctx, value, maxWidth) => {
  const normalized = String(value ?? '—').replace(/\s+/g, ' ').trim();
  if (!normalized) return ['—'];
  const words = normalized.split(' ');
  const lines = [];
  let line = words[0] || '';

  for (let i = 1; i < words.length; i += 1) {
    const next = `${line} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
};

const applySecurityOverlay = (ctx, width, height, reportId) => {
  // Repeated diagonal watermark to reduce OCR reliability while keeping readability.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 34px Arial';
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.textAlign = 'center';
  const mark = `CONFIDENTIAL · OMNISENSUS · ${reportId}`;
  for (let y = -height; y <= height; y += 220) {
    for (let x = -width; x <= width; x += 520) {
      ctx.fillText(mark, x, y);
    }
  }
  ctx.restore();

  // Fine micro-noise layer to make browser OCR extraction less reliable.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#111827';
  for (let y = 8; y < height; y += 16) {
    const offset = ((y / 16) % 3) * 3;
    for (let x = offset; x < width; x += 19) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.restore();
};

const createPdfDoc = (ownerPassword) => {
  try {
    return new jsPDF({
      unit: 'mm',
      format: 'a4',
      compress: true,
      putOnlyUsedFonts: true,
      encryption: {
        ownerPassword,
        userPassword: '',
        userPermissions: [],
      },
    });
  } catch {
    return new jsPDF({
      unit: 'mm',
      format: 'a4',
      compress: true,
      putOnlyUsedFonts: true,
    });
  }
};

const triggerDownload = (href, fileName) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const renderReportCanvas = ({
  reportId,
  generatedDate,
  patientName,
  patientId,
  physician,
  age,
  sex,
  bloodGroup,
  score,
  tier,
  scoreColor,
  domain,
  biomarkerRows,
  diseaseRows,
  recommendationText,
}) => {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH_PX;
  canvas.height = CANVAS_BUFFER_HEIGHT_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize canvas for PDF generation.');

  ctx.fillStyle = palette.white;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = 96;
  const contentW = CANVAS_WIDTH_PX - (pad * 2);
  let y = 0;

  const drawSectionHeading = (title) => {
    ctx.textAlign = 'left';
    ctx.font = '700 34px Arial';
    ctx.fillStyle = palette.text;
    ctx.fillText(title, pad, y);

    y += 12;
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.teal;
    ctx.beginPath();
    ctx.moveTo(pad, y + 8);
    ctx.lineTo(CANVAS_WIDTH_PX - pad, y + 8);
    ctx.stroke();
    y += 44;
  };

  // Header
  const headerH = 172;
  ctx.fillStyle = palette.teal;
  ctx.fillRect(0, 0, CANVAS_WIDTH_PX, headerH);

  ctx.textAlign = 'left';
  ctx.fillStyle = palette.white;
  ctx.font = '700 56px Arial';
  ctx.fillText('OmniSensus Medical', pad, 72);
  ctx.font = '500 28px Arial';
  ctx.fillStyle = '#D7F2F0';
  ctx.fillText('AI-Powered Clinical Diagnostic Report', pad, 112);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ECFEFD';
  ctx.font = '600 24px Arial';
  ctx.fillText(`Report ID: ${reportId}`, CANVAS_WIDTH_PX - pad, 72);
  ctx.fillText(`Generated: ${generatedDate}`, CANVAS_WIDTH_PX - pad, 112);

  y = headerH + 40;

  // Patient summary
  const summaryH = 138;
  drawRoundedRect(ctx, pad, y, contentW, summaryH, 16, palette.alt, palette.line, 2);

  const colX = [pad + 26, pad + 420, pad + 670, pad + 930];
  ctx.textAlign = 'left';
  ctx.font = '700 19px Arial';
  ctx.fillStyle = palette.muted;
  ctx.fillText('PATIENT', colX[0], y + 36);
  ctx.fillText('AGE / SEX', colX[1], y + 36);
  ctx.fillText('BLOOD GROUP', colX[2], y + 36);
  ctx.fillText('PHYSICIAN', colX[3], y + 36);

  ctx.fillStyle = palette.text;
  ctx.font = '600 30px Arial';
  ctx.fillText(fitText(ctx, patientName, 360), colX[0], y + 78);

  ctx.font = '500 24px Arial';
  ctx.fillText(fitText(ctx, patientId, 360), colX[0], y + 112);
  ctx.fillText(`${age} / ${sex}`, colX[1], y + 78);
  ctx.fillText(String(bloodGroup), colX[2], y + 78);
  ctx.fillText(fitText(ctx, physician, 290), colX[3], y + 78);

  y += summaryH + 36;

  // Composite score
  drawSectionHeading('Composite Health Score');
  const scoreBoxH = 112;
  drawRoundedRect(ctx, pad, y, contentW, scoreBoxH, 14, palette.tealSoft, palette.line, 1.5);

  ctx.textAlign = 'left';
  ctx.fillStyle = scoreColor;
  ctx.font = '700 74px Arial';
  ctx.fillText(score == null ? '--' : score.toFixed(1), pad + 20, y + 80);

  ctx.fillStyle = scoreColor;
  ctx.font = '700 42px Arial';
  ctx.fillText(tier, pad + 245, y + 58);

  ctx.fillStyle = palette.muted;
  ctx.font = '500 22px Arial';
  ctx.fillText('Above 65 = Stable | 40–65 = Borderline | Below 40 = Critical', pad + 245, y + 92);

  y += scoreBoxH + 30;

  // Domain cards
  const blockGap = 18;
  const blockH = 112;
  const blockW = (contentW - (blockGap * 2)) / 3;
  const cards = [
    ['Cardiovascular', domain.cardiovascular, palette.success],
    ['Metabolic', domain.metabolic, palette.warning],
    ['Renal', domain.renal, palette.teal],
  ];

  cards.forEach(([label, val, color], index) => {
    const x = pad + (index * (blockW + blockGap));
    drawRoundedRect(ctx, x, y, blockW, blockH, 12, palette.alt, palette.line, 1.5);

    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '700 56px Arial';
    ctx.fillText(`${val.toFixed(1)}`, x + (blockW / 2), y + 68);

    ctx.fillStyle = palette.muted;
    ctx.font = '600 22px Arial';
    ctx.fillText(label, x + (blockW / 2), y + 98);
  });
  ctx.textAlign = 'left';

  y += blockH + 42;

  // Biomarker table
  drawSectionHeading('Biomarker Results');
  const tableWidth = contentW;
  const col1 = tableWidth * 0.44;
  const col2 = tableWidth * 0.18;
  const col3 = tableWidth * 0.14;
  const tx = [pad, pad + col1, pad + col1 + col2, pad + col1 + col2 + col3, pad + tableWidth];
  const headH = 46;
  const rowH = 44;

  ctx.fillStyle = palette.teal;
  ctx.fillRect(tx[0], y, tableWidth, headH);
  ctx.fillStyle = palette.white;
  ctx.font = '700 22px Arial';
  ctx.fillText('Biomarker', tx[0] + 14, y + 30);
  ctx.fillText('Value', tx[1] + 14, y + 30);
  ctx.fillText('Unit', tx[2] + 14, y + 30);
  ctx.fillText('Status', tx[3] + 14, y + 30);
  y += headH;

  biomarkerRows.forEach(([name, value, unit], index) => {
    ctx.fillStyle = index % 2 === 0 ? palette.white : palette.alt;
    ctx.fillRect(tx[0], y, tableWidth, rowH);
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tx[0], y, tableWidth, rowH);

    ctx.beginPath();
    ctx.moveTo(tx[1], y); ctx.lineTo(tx[1], y + rowH);
    ctx.moveTo(tx[2], y); ctx.lineTo(tx[2], y + rowH);
    ctx.moveTo(tx[3], y); ctx.lineTo(tx[3], y + rowH);
    ctx.stroke();

    const n = toNumber(value);
    const status = n == null ? 'N/A' : 'Normal';

    ctx.fillStyle = palette.text;
    ctx.font = '500 20px Arial';
    ctx.fillText(fitText(ctx, name, col1 - 28), tx[0] + 14, y + 28);
    ctx.fillText(n == null ? String(value ?? '—') : n.toFixed(1), tx[1] + 14, y + 28);
    ctx.fillText(unit || '—', tx[2] + 14, y + 28);
    ctx.fillStyle = status === 'N/A' ? palette.muted : palette.success;
    ctx.fillText(status, tx[3] + 14, y + 28);

    y += rowH;
  });

  y += 30;

  // Disease risk table
  drawSectionHeading('Disease-Specific Risk Probabilities (ML Model)');

  ctx.fillStyle = palette.teal;
  ctx.fillRect(tx[0], y, tableWidth, headH);
  ctx.fillStyle = palette.white;
  ctx.font = '700 22px Arial';
  ctx.fillText('Disease Domain', tx[0] + 14, y + 30);
  ctx.fillText('Risk (%)', tx[1] + 14, y + 30);
  ctx.fillText('Threshold', tx[2] + 14, y + 30);
  ctx.fillText('Status', tx[3] + 14, y + 30);
  y += headH;

  diseaseRows.forEach(([name, risk, threshold], index) => {
    ctx.fillStyle = index % 2 === 0 ? palette.white : palette.alt;
    ctx.fillRect(tx[0], y, tableWidth, rowH);
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tx[0], y, tableWidth, rowH);

    ctx.beginPath();
    ctx.moveTo(tx[1], y); ctx.lineTo(tx[1], y + rowH);
    ctx.moveTo(tx[2], y); ctx.lineTo(tx[2], y + rowH);
    ctx.moveTo(tx[3], y); ctx.lineTo(tx[3], y + rowH);
    ctx.stroke();

    const status = riskStatus(risk, threshold);
    const statusColor = status === 'High Risk' ? palette.danger : palette.success;

    ctx.fillStyle = palette.text;
    ctx.font = '500 20px Arial';
    ctx.fillText(fitText(ctx, name, col1 - 28), tx[0] + 14, y + 28);
    ctx.fillText(`${risk.toFixed(1)}%`, tx[1] + 14, y + 28);
    ctx.fillText(`${threshold}%`, tx[2] + 14, y + 28);
    ctx.fillStyle = statusColor;
    ctx.fillText(status, tx[3] + 14, y + 28);

    y += rowH;
  });

  y += 34;

  // Recommendation
  drawSectionHeading('Recommended Referral');
  ctx.font = '500 24px Arial';
  const recLines = wrapText(ctx, recommendationText, contentW - 40);
  const recLineHeight = 34;
  const recBoxH = Math.max(112, (recLines.length * recLineHeight) + 34);
  drawRoundedRect(ctx, pad, y, contentW, recBoxH, 12, palette.alt, palette.line, 1.5);

  ctx.fillStyle = palette.text;
  ctx.textAlign = 'left';
  ctx.font = '500 24px Arial';
  recLines.forEach((line, idx) => {
    ctx.fillText(line, pad + 20, y + 48 + (idx * recLineHeight));
  });

  y += recBoxH + 52;

  // Footer
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(CANVAS_WIDTH_PX - pad, y);
  ctx.stroke();

  const footer = `Electronically generated by OmniSensus AI Engine v3.0.1 | Attending Physician: ${physician} | ${formatDate(new Date())}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.muted;
  ctx.font = '500 18px Arial';
  const footerLines = wrapText(ctx, footer, contentW);
  footerLines.forEach((line, idx) => {
    ctx.fillText(line, CANVAS_WIDTH_PX / 2, y + 32 + (idx * 24));
  });

  const usedHeight = Math.min(canvas.height, Math.max(1100, Math.ceil(y + 70 + (footerLines.length * 24))));
  const trimmed = document.createElement('canvas');
  trimmed.width = CANVAS_WIDTH_PX;
  trimmed.height = usedHeight;

  const tctx = trimmed.getContext('2d');
  if (!tctx) throw new Error('Unable to finalize PDF canvas.');
  tctx.fillStyle = palette.white;
  tctx.fillRect(0, 0, trimmed.width, trimmed.height);
  tctx.drawImage(canvas, 0, 0, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  applySecurityOverlay(tctx, trimmed.width, trimmed.height, reportId);

  return { canvas: trimmed, contentHeight: usedHeight };
};

export function exportReportPdf({
  profile = {},
  report = {},
  recommendations = '',
  output = 'pdf',
  onComplete = () => {},
}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('PDF export is only available in a browser context.');
  }

  const patientName = profile?.full_name || 'Unknown Patient';
  const patientId = profile?.patient_id || report?.patient_id || '—';
  const physician = profile?.doctor_name || report?.doctor_name || '—';
  const age = profile?.age ?? report?.age ?? '—';
  const sex = profile?.gender || profile?.sex || report?.gender || report?.sex || '—';
  const bloodGroup = profile?.blood_group || report?.blood_group || '—';

  const domain = normalizeDomainRisks(report);
  const score = pickNumber([report?.health_score], null);
  const tier = report?.risk_tier || tierFromScore(score);
  const scoreColor = score == null
    ? palette.muted
    : score >= 70
      ? palette.success
      : score >= 50
        ? palette.warning
        : palette.danger;

  const biomarkerRows = collectBiomarkers(report);
  const diseaseRows = [
    ['Cardiovascular Disease', domain.cardiovascular, 35],
    ['Diabetes / Pre-Diabetes', domain.metabolic, 35],
    ['Chronic Kidney Disease', domain.renal, 35],
  ];

  const recommendationText = recommendations || report?.summary_notes || report?.recommendation || 'Clinical follow-up advised based on current risk profile.';
  const fileId = report?.accession_number || report?.report_id || report?.visit_id || Date.now();
  const ownerPassword = `omnisensus-owner-${fileId}-${Date.now()}`;

  const { canvas, contentHeight } = renderReportCanvas({
    reportId: fileId,
    generatedDate: formatDate(report?.generated_at || report?.visit_date || new Date()),
    patientName,
    patientId,
    physician,
    age,
    sex,
    bloodGroup,
    score,
    tier,
    scoreColor,
    domain,
    biomarkerRows,
    diseaseRows,
    recommendationText,
  });

  if (output === 'image') {
    const imageData = canvas.toDataURL('image/jpeg', 0.7);
    const imageName = `OmniSensus-Report-${fileId}.jpg`;
    triggerDownload(imageData, imageName);
    onComplete({
      fileName: imageName,
      output: 'image',
    });
    return;
  }

  const doc = createPdfDoc(ownerPassword);
  const pageHeightPx = Math.floor((CANVAS_WIDTH_PX * PAGE_HEIGHT_MM) / PAGE_WIDTH_MM);
  const pages = Math.max(1, Math.ceil(contentHeight / pageHeightPx));

  for (let i = 0; i < pages; i += 1) {
    const sliceY = i * pageHeightPx;
    const sliceHeight = Math.min(pageHeightPx, contentHeight - sliceY);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = CANVAS_WIDTH_PX;
    pageCanvas.height = sliceHeight;
    const pctx = pageCanvas.getContext('2d');
    if (!pctx) throw new Error('Unable to build PDF page image.');

    pctx.fillStyle = palette.white;
    pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pctx.drawImage(canvas, 0, sliceY, CANVAS_WIDTH_PX, sliceHeight, 0, 0, CANVAS_WIDTH_PX, sliceHeight);

    const imageData = pageCanvas.toDataURL('image/jpeg', 0.78);
    const pageHeightMm = (sliceHeight * PAGE_WIDTH_MM) / CANVAS_WIDTH_PX;

    if (i > 0) doc.addPage();
    doc.addImage(imageData, 'JPEG', 0, 0, PAGE_WIDTH_MM, pageHeightMm, undefined, 'MEDIUM');
  }

  const pdfName = `OmniSensus-Report-${fileId}.pdf`;
  doc.save(pdfName);
  onComplete({
    fileName: pdfName,
    output: 'pdf',
  });
}
