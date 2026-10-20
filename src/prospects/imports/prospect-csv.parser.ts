import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { isEmail, isURL } from 'class-validator';

export const CSV_MAX_BYTES = 5 * 1024 * 1024;
export const CSV_MAX_ROWS = 1000;
export const CSV_FIELDS = [
  'name',
  'category',
  'address',
  'phone',
  'email',
  'website',
  'language',
  'status',
] as const;
export type ImportValues = {
  name: string;
  category?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  language?: string | null;
  status?: 'ACTIVO' | 'INACTIVO';
};
export interface ImportRow {
  record: number;
  values: ImportValues;
  errors: { field: string; message: string }[];
}
export const normalizeName = (name: string): string =>
  name.trim().replace(/\s+/gu, ' ').toLowerCase();

@Injectable()
export class ProspectCsvParser {
  parse(buffer: Buffer): ImportRow[] {
    if (!buffer.length || buffer.length > CSV_MAX_BYTES) {
      throw new BadRequestException('CSV must contain between 1 byte and 5 MB');
    }
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new BadRequestException('CSV must be UTF-8');
    }
    if (text.includes('\0'))
      throw new BadRequestException('Invalid CSV content');
    const candidates: string[][][] = [];
    for (const delimiter of [',', ';']) {
      try {
        const records = parse(text, {
          delimiter,
          bom: true,
          skip_empty_lines: true,
          relax_column_count: true,
          max_record_size: CSV_MAX_BYTES,
        });
        const header = records[0];
        if (
          header?.includes('name') &&
          header.every((field) =>
            (CSV_FIELDS as readonly string[]).includes(field),
          ) &&
          new Set(header).size === header.length
        )
          candidates.push(records);
      } catch {
        // A candidate delimiter is accepted only with a valid complete parse.
      }
    }
    if (
      candidates.length === 2 &&
      JSON.stringify(candidates[0]) === JSON.stringify(candidates[1])
    )
      candidates.pop();
    if (candidates.length !== 1) {
      throw new BadRequestException(
        'Invalid, repeated or unknown CSV headers, missing name, malformed CSV or ambiguous delimiter',
      );
    }
    const [header, ...records] = candidates[0];
    if (records.length > CSV_MAX_ROWS)
      throw new BadRequestException('CSV exceeds 1000 records');
    const rows: ImportRow[] = records
      .map((cells, index) => {
        const row: ImportRow = {
          record: index + 1,
          values: { name: '' },
          errors: [],
        };
        if (cells.every((cell) => !cell.trim())) return row;
        if (cells.length !== header.length) {
          row.errors.push({
            field: 'record',
            message: 'Column count does not match header',
          });
          return row;
        }
        const values: Record<string, string | null> = {};
        header.forEach((field, i) => {
          const value = cells[i];
          const empty = !value.trim();
          if (value.length > 2000)
            row.errors.push({
              field,
              message: 'Maximum length is 2000 characters',
            });
          if (field === 'name') {
            values[field] = value;
            if (empty) row.errors.push({ field, message: 'Name is required' });
          } else if (field === 'status') {
            if (value !== 'ACTIVO' && value !== 'INACTIVO')
              row.errors.push({
                field,
                message: 'Status must be ACTIVO or INACTIVO',
              });
            else values[field] = value;
          } else {
            values[field] = empty ? null : value;
            if (!empty && field === 'email' && !isEmail(value))
              row.errors.push({ field, message: 'Invalid email' });
            if (
              !empty &&
              field === 'website' &&
              !isURL(value, { require_protocol: true })
            )
              row.errors.push({ field, message: 'Invalid URL with protocol' });
          }
        });
        row.values = values as ImportValues;
        return row;
      })
      .filter((row, index) => !records[index].every((cell) => !cell.trim()));
    if (!rows.length)
      throw new BadRequestException('CSV contains no data records');
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = normalizeName(row.values.name);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const row of rows) {
      if ((counts.get(normalizeName(row.values.name)) ?? 0) > 1) {
        row.errors.push({
          field: 'name',
          message: 'Repeated normalized name in CSV; correct all occurrences',
        });
      }
    }
    return rows;
  }
}
