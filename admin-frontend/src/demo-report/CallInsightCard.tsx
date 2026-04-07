import React, { useRef } from 'react';
import type { CallInsightDetail } from './types';
import { ReportHeader } from './ReportHeader';
import { ReportSections } from './ReportSections';
import { exportReportPdf } from './exportPdf';

export function CallInsightCard(props: { detail: CallInsightDetail }) {
  const { detail } = props;
  const reportExportRef = useRef<HTMLDivElement | null>(null);

  async function handleExportReportPdf() {
    const root = reportExportRef.current;
    if (!root) return;
    try {
      await exportReportPdf(root);
    } catch (e) {
      console.error('PDF export failed', e);
    }
  }

  return (
    <div ref={reportExportRef} className="demo-report-export-root space-y-4">
      <ReportHeader detail={detail} onExportPdf={() => void handleExportReportPdf()} />

      {detail.processingError && (
        <div className="rounded-xl admin-card-inner px-3 py-2 text-xs text-danger">
          {detail.processingError}
        </div>
      )}

      <ReportSections detail={detail} />
    </div>
  );
}

