/**
 * A table ready to be written as CSV or XLSX: localized headers plus rows of plain cell values.
 * Numbers stay numbers (Excel can sum them); everything else is already formatted text.
 */

export type Cell = string | number | null

export interface ExportTable {
  /** Sheet name and the base of the file name (ASCII). */
  name: string
  headers: string[]
  rows: Cell[][]
  /** Right-to-left sheet (Arabic export). */
  rtl?: boolean
}

export type ExportFormat = 'csv' | 'xlsx'

export const EXPORT_MIME: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
