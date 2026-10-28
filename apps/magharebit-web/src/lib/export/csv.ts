/**
 * CSV writer for admin exports (RFC 4180, CRLF line ends).
 *
 * - Starts with a UTF-8 byte-order mark: without it Excel reads the file as ANSI and Arabic turns into mojibake.
 * - Text cells that start with = + - @ tab or CR get a leading apostrophe, so a value typed by a visitor
 *   (a lead's shop name, say) can never run as a formula when the file is opened (CSV/formula injection).
 *   Real numbers are written as numbers and are not affected.
 */

import type { Cell, ExportTable } from './table'

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let s = String(value)
  if (FORMULA_START.test(s)) s = `'${s}`
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(table: ExportTable): string {
  const lines = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
