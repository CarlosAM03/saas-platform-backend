import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import type { BusinessResult } from '../../prospector-client/dto/job-event.request';

const columns = [
  'name',
  'category',
  'address',
  'phone',
  'email',
  'website',
  'source',
  'sourceIdentifier',
  'language',
  'metadata',
] as const;

@Injectable()
export class JobExportService {
  async render(
    results: BusinessResult[],
    format: 'csv' | 'xlsx',
  ): Promise<Buffer> {
    const rows = results.map((result) =>
      columns.map((key) => {
        const value = result[key];
        return value == null
          ? ''
          : typeof value === 'string'
            ? value
            : JSON.stringify(value);
      }),
    );
    if (format === 'csv') {
      const quote = (value: string) => {
        // Quote delimiters and neutralize spreadsheet formula interpretation.
        const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      return Buffer.from(
        '\uFEFF' +
          [columns, ...rows]
            .map((row) => row.map(quote).join(','))
            .join('\r\n') +
          '\r\n',
        'utf8',
      );
    }
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Prospects');
    sheet.addRow([...columns]);
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns.forEach((column) => {
      column.width = 24;
    });
    // String cells remain literal strings (never Excel formula objects).
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
