import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ConsultationRecord } from './consultations';
import { flattenSummary } from './consultations';

/* ============================================================================
 *  consultationDoc — downloadable artefacts for a consultation record.
 *
 *  PDF  : built entirely in the browser with **jsPDF** (+ the jspdf-autotable
 *         plugin for the medication table). No server, no dependency on a
 *         print dialog — one click saves a clean clinical document.
 *  TXT  : the raw meeting transcript, exactly as spoken.
 * ==========================================================================*/

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function safeName(r: ConsultationRecord): string {
  const d = (r.endedAt ?? r.createdAt).slice(0, 10);
  const who = (r.patientName || 'patient').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `consultation-${who}-${d}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The complete meeting record as a plain-text file. */
export function downloadConsultationTxt(r: ConsultationRecord) {
  const header = [
    'CONSULTATION TRANSCRIPT',
    `Patient : ${r.patientName || '—'}`,
    `Doctor  : ${r.doctorName || '—'}`,
    `Reason  : ${r.reason || '—'}`,
    `Started : ${fmtDateTime(r.startedAt)}`,
    `Ended   : ${fmtDateTime(r.endedAt)}`,
    '='.repeat(60),
  ].join('\n');

  const summary = r.summaryText || flattenSummary(r.summary);
  const parts = [
    header,
    '',
    r.transcript.trim() || '(no speech was captured for this visit)',
    '',
    '='.repeat(60),
    'SUMMARY & ADVICE',
    '',
    summary || '(summary not available)',
    '',
  ];

  triggerDownload(
    new Blob([parts.join('\n')], { type: 'text/plain;charset=utf-8' }),
    `${safeName(r)}.txt`,
  );
}

/** A structured, printable clinical PDF (summary + advice, then full transcript). */
export function downloadConsultationPdf(r: ConsultationRecord) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const contentW = pageW - M * 2;
  let y = M;

  const ensure = (need: number) => {
    if (y + need > pageH - M) {
      doc.addPage();
      y = M;
    }
  };

  const heading = (text: string) => {
    ensure(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 43, 60);
    doc.text(text.toUpperCase(), M, y);
    y += 6;
    doc.setDrawColor(224, 236, 233);
    doc.line(M, y, M + contentW, y);
    y += 16;
  };

  const para = (text: string, opts: { bullet?: boolean; muted?: boolean } = {}) => {
    if (!text) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(opts.muted ? 120 : 32, opts.muted ? 130 : 40, opts.muted ? 135 : 46);
    const indent = opts.bullet ? 14 : 0;
    const lines = doc.splitTextToSize(text, contentW - indent) as string[];
    lines.forEach((ln, i) => {
      ensure(15);
      if (opts.bullet && i === 0) doc.text('•', M, y);
      doc.text(ln, M + indent, y);
      y += 15;
    });
  };

  const field = (label: string, value: string) => {
    if (!value) return;
    ensure(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(92, 118, 128);
    doc.text(`${label}: `, M, y);
    const w = doc.getTextWidth(`${label}: `);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(32, 40, 46);
    const lines = doc.splitTextToSize(value, contentW - w) as string[];
    lines.forEach((ln, i) => {
      ensure(15);
      doc.text(ln, M + (i === 0 ? w : 0), y);
      y += 15;
    });
  };

  // ---- Masthead -----------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(14, 156, 143);
  doc.text('MyHospital', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 130, 135);
  doc.text('Consultation summary', pageW - M, y, { align: 'right' });
  y += 12;
  doc.setDrawColor(14, 156, 143);
  doc.setLineWidth(1.4);
  doc.line(M, y, M + contentW, y);
  doc.setLineWidth(1);
  y += 22;

  // ---- Visit particulars ------------------------------------------------
  field('Patient', r.patientName || '—');
  field('Doctor', r.doctorName || '—');
  field('Reason for visit', r.reason || '—');
  field('Started', fmtDateTime(r.startedAt));
  field('Ended', fmtDateTime(r.endedAt));
  field(
    'Status',
    `${r.status === 'final' ? 'Finalised by clinician' : 'Draft'}` +
      (r.summaryStatus === 'ready' ? ' · AI-structured summary' : ''),
  );
  y += 10;

  const s = r.summary;

  if (s.patientSummary) {
    heading('In plain language');
    para(s.patientSummary);
    y += 8;
  }

  if (s.reason || s.history || s.examination || s.assessment) {
    heading('Clinical summary');
    field('Reason', s.reason);
    field('History', s.history);
    field('Examination / findings', s.examination);
    field('Assessment', s.assessment);
    y += 8;
  }

  if (s.advice.length) {
    heading("Doctor's advice");
    s.advice.forEach((a) => para(a, { bullet: true }));
    y += 8;
  }

  if (s.medications.length) {
    heading('Medications');
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Medication', 'Dose', 'Instructions']],
      body: s.medications.map((m) => [m.name, m.dose || '—', m.instructions || '—']),
      styles: { fontSize: 9.5, cellPadding: 6, textColor: [32, 40, 46] },
      headStyles: { fillColor: [14, 156, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 250, 249] },
      theme: 'grid',
    });
    // @ts-expect-error — autotable augments the doc instance at runtime
    y = (doc.lastAutoTable?.finalY ?? y) + 20;
  }

  if (s.followUp) {
    heading('Follow-up');
    para(s.followUp);
    y += 8;
  }

  if (s.redFlags.length) {
    heading('Seek urgent care if');
    s.redFlags.forEach((f) => para(f, { bullet: true }));
    y += 8;
  }

  if (!r.summaryText && !s.reason && !s.advice.length) {
    heading('Summary');
    para(
      r.summaryStatus === 'pending'
        ? 'The structured summary is still being generated. The full transcript below is the complete record of the visit.'
        : 'An automatic summary is not available for this visit. The full transcript below is the complete record.',
      { muted: true },
    );
    y += 8;
  }

  // ---- Full transcript --------------------------------------------------
  doc.addPage();
  y = M;
  heading('Full consultation transcript');
  para('Verbatim speech-to-text captured live during the visit.', { muted: true });
  y += 6;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 48, 54);
  const tLines = doc.splitTextToSize(
    r.transcript.trim() || '(no speech was captured for this visit)',
    contentW,
  ) as string[];
  tLines.forEach((ln) => {
    ensure(13);
    doc.text(ln, M, y);
    y += 13;
  });

  // ---- Footer on every page ------------------------------------------
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 158, 162);
    doc.text(
      `MyHospital · generated ${new Date().toLocaleString()} · not a substitute for the medical record`,
      M,
      pageH - 24,
    );
    doc.text(`${p} / ${total}`, pageW - M, pageH - 24, { align: 'right' });
  }

  doc.save(`${safeName(r)}.pdf`);
}
