export interface AccessEventReportRow {
  decisionLabel: string
  employeeLabel: string
  cardUid: string
  areaLabel: string
  deviceLabel: string
  reasonLabel: string
  occurredAtLabel: string
  receivedAtLabel: string
}

export interface AccessEventsPdfParams {
  generatedAtLabel: string
  totalInQuery: number
  filterSummary: string[]
  rows: AccessEventReportRow[]
  filename?: string
}

const PAGE_WIDTH = 792
const PAGE_HEIGHT = 612
const MARGIN_X = 36
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2 // 720 pt
const TOP_Y = PAGE_HEIGHT - 36 // 576 pt
const BOTTOM_Y = 48
const FOOTER_LINE_Y = 34
const FOOTER_TEXT_Y = 21

const TABLE_HEADER_HEIGHT = 22
const ROW_PAD_X = 5
const ROW_PAD_TOP = 6
const ROW_PAD_BOTTOM = 5
const ROW_LINE_HEIGHT = 9.5
const MIN_ROW_HEIGHT = 22

// Accesa brand & semantic colors (normalized 0..1 RGB)
const COLOR_ACCESA = '0.118 0.078 0.153' // #1E1427
const COLOR_ACCESA_MUTED = '0.290 0.243 0.337' // #4A3E56
const COLOR_TEXT_LIGHT_MUTED = '0.463 0.416 0.518' // #766A84
const COLOR_WHITE = '1 1 1'
const COLOR_BANNER_SUBTITLE = '0.867 0.835 0.902'
const COLOR_SUMMARY_BG = '0.949 0.937 0.965' // #F2EFF6
const COLOR_ZEBRA_BG = '0.980 0.976 0.988'
const COLOR_BORDER = '0.843 0.816 0.878'
const COLOR_GRID = '0.886 0.867 0.914'
const COLOR_GRANTED = '0.059 0.463 0.431' // #0F766E
const COLOR_DENIED = '0.624 0.071 0.224' // #9F1239

interface TableColumn {
  label: string
  width: number
}

const TABLE_COLUMNS: readonly TableColumn[] = [
  { label: 'Resultado', width: 64 },
  { label: 'Empleado', width: 128 },
  { label: 'Tarjeta UID', width: 88 },
  { label: 'Área / Controlador', width: 138 },
  { label: 'Motivo', width: 118 },
  { label: 'Ocurrió (lector)', width: 92 },
  { label: 'Recibido (servidor)', width: 92 },
]

// Unicode characters outside 0xA1..0xFF that have defined WinAnsi (Windows-1252) code points.
const WIN_ANSI_EXTRAS: ReadonlyMap<number, number> = new Map([
  [0x20ac, 0x80], // €
  [0x201a, 0x82], // ‚
  [0x0192, 0x83], // ƒ
  [0x201e, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x02c6, 0x88], // ˆ
  [0x2030, 0x89], // ‰
  [0x0160, 0x8a], // Š
  [0x2039, 0x8b], // ‹
  [0x0152, 0x8c], // Œ
  [0x017d, 0x8e], // Ž
  [0x2018, 0x91], // ‘
  [0x2019, 0x92], // ’
  [0x201c, 0x93], // “
  [0x201d, 0x94], // ”
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02dc, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9a], // š
  [0x203a, 0x9b], // ›
  [0x0153, 0x9c], // œ
  [0x017e, 0x9e], // ž
  [0x0178, 0x9f], // Ÿ
  [0x00a0, 0x20], // NBSP -> regular space
  [0x202f, 0x20], // Narrow NBSP -> regular space
])

type PdfFontId = 'F1' | 'F2' | 'F3'

interface StyledLine {
  text: string
  font: PdfFontId
  size: number
  color: string
}

interface PreparedRow {
  columns: StyledLine[][]
  height: number
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/**
 * Converts arbitrary Unicode text into a 1-byte-per-char string using WinAnsi
 * (Windows-1252) code points, replacing unsupported characters with '?'.
 */
function toWinAnsiText(input: string): string {
  const normalized = input.normalize('NFC')
  const chars: string[] = []

  for (const ch of normalized) {
    const code = ch.codePointAt(0) ?? 0x3f

    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      chars.push(' ')
    } else if (code >= 0x20 && code <= 0x7e) {
      chars.push(String.fromCharCode(code))
    } else {
      const extraByte = WIN_ANSI_EXTRAS.get(code)
      if (extraByte !== undefined) {
        chars.push(String.fromCharCode(extraByte))
      } else if (code >= 0xa1 && code <= 0xff && code !== 0xad) {
        chars.push(String.fromCharCode(code))
      } else {
        chars.push('?')
      }
    }
  }

  return chars.join('').replace(/\s+/g, ' ').trim()
}

function escapePdfLiteral(winAnsiText: string): string {
  return winAnsiText.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function estimateCharWidthFactor(char: string, font: PdfFontId): number {
  if (font === 'F3') {
    return 0.6
  }

  const boldFactor = font === 'F2' ? 1.07 : 1.0

  if (' iIljtfr.,:;!\'|()[]/\\'.includes(char)) {
    return 0.3 * boldFactor
  }
  if ('mwMW@#%&'.includes(char)) {
    return 0.84 * boldFactor
  }
  if (char >= 'A' && char <= 'Z') {
    return 0.68 * boldFactor
  }
  return 0.55 * boldFactor
}

function estimateTextWidth(winAnsiText: string, fontSize: number, font: PdfFontId): number {
  let totalFactor = 0
  for (let i = 0; i < winAnsiText.length; i += 1) {
    totalFactor += estimateCharWidthFactor(winAnsiText[i] ?? 'a', font)
  }
  return totalFactor * fontSize
}

function truncateWithEllipsis(
  winAnsiText: string,
  maxWidth: number,
  fontSize: number,
  font: PdfFontId,
): string {
  if (estimateTextWidth(winAnsiText, fontSize, font) <= maxWidth) {
    return winAnsiText
  }

  const ellipsis = '...'
  let end = winAnsiText.length
  while (end > 0) {
    const candidate = `${winAnsiText.slice(0, end).trimEnd()}${ellipsis}`
    if (estimateTextWidth(candidate, fontSize, font) <= maxWidth) {
      return candidate
    }
    end -= 1
  }
  return ellipsis
}

function wrapWinAnsiText(
  rawText: string,
  maxWidth: number,
  fontSize: number,
  font: PdfFontId,
  maxLines: number,
): string[] {
  const clean = toWinAnsiText(rawText)
  if (!clean) {
    return ['-']
  }

  const words = clean.split(' ')
  const lines: string[] = []
  let current = ''

  const pushWordSlices = (word: string) => {
    let slice = ''
    for (let i = 0; i < word.length; i += 1) {
      const next = `${slice}${word[i]}`
      if (slice.length > 0 && estimateTextWidth(next, fontSize, font) > maxWidth) {
        lines.push(slice)
        slice = word[i] ?? ''
      } else {
        slice = next
      }
    }
    if (slice) {
      current = slice
    }
  }

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (estimateTextWidth(candidate, fontSize, font) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
      current = ''
    }

    if (estimateTextWidth(word, fontSize, font) <= maxWidth) {
      current = word
    } else {
      pushWordSlices(word)
    }
  }

  if (current) {
    lines.push(current)
  }

  if (lines.length <= maxLines) {
    return lines
  }

  const kept = lines.slice(0, maxLines)
  const lastIndex = maxLines - 1
  const remaining = `${kept[lastIndex] ?? ''} ${lines.slice(maxLines).join(' ')}`.trim()
  kept[lastIndex] = truncateWithEllipsis(remaining, maxWidth, fontSize, font)
  return kept
}

function encodeLatin1Bytes(source: string): Uint8Array {
  const bytes = new Uint8Array(source.length)
  for (let i = 0; i < source.length; i += 1) {
    bytes[i] = source.charCodeAt(i) & 0xff
  }
  return bytes
}

function drawRectFill(cmds: string[], x: number, y: number, w: number, h: number, color: string) {
  cmds.push(`${color} rg ${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re f`)
}

function drawRectFillStroke(
  cmds: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: string,
  strokeColor: string,
  lineWidth = 0.6,
) {
  cmds.push(
    `${fmt(lineWidth)} w ${fillColor} rg ${strokeColor} RG ${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re B`,
  )
}

function drawLine(
  cmds: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth = 0.5,
) {
  cmds.push(`${fmt(lineWidth)} w ${color} RG ${fmt(x1)} ${fmt(y1)} m ${fmt(x2)} ${fmt(y2)} l S`)
}

function drawText(
  cmds: string[],
  x: number,
  y: number,
  winAnsiText: string,
  font: PdfFontId,
  size: number,
  color: string,
) {
  const escaped = escapePdfLiteral(winAnsiText)
  cmds.push(`BT /${font} ${fmt(size)} Tf ${color} rg 1 0 0 1 ${fmt(x)} ${fmt(y)} Tm (${escaped}) Tj ET`)
}

function resolveDecisionColor(decisionLabel: string): string {
  const lower = decisionLabel.toLowerCase()
  if (lower.includes('conced') || lower === 'granted') {
    return COLOR_GRANTED
  }
  if (lower.includes('deneg') || lower === 'denied') {
    return COLOR_DENIED
  }
  return COLOR_ACCESA
}

function countDecisions(rows: AccessEventReportRow[]): { granted: number; denied: number } {
  let granted = 0
  let denied = 0

  for (const row of rows) {
    const lower = row.decisionLabel.toLowerCase()
    if (lower.includes('conced') || lower === 'granted') {
      granted += 1
    } else if (lower.includes('deneg') || lower === 'denied') {
      denied += 1
    }
  }

  return { granted, denied }
}

function prepareRow(row: AccessEventReportRow): PreparedRow {
  const colWidths = TABLE_COLUMNS.map((col) => col.width - ROW_PAD_X * 2)

  const col0Lines = wrapWinAnsiText(row.decisionLabel, colWidths[0] ?? 54, 7.5, 'F2', 2).map(
    (text): StyledLine => ({
      text,
      font: 'F2',
      size: 7.5,
      color: resolveDecisionColor(row.decisionLabel),
    }),
  )

  const col1Lines = wrapWinAnsiText(row.employeeLabel, colWidths[1] ?? 118, 7.5, 'F1', 3).map(
    (text): StyledLine => ({
      text,
      font: 'F1',
      size: 7.5,
      color: COLOR_ACCESA,
    }),
  )

  const col2Lines = wrapWinAnsiText(row.cardUid, colWidths[2] ?? 78, 7.5, 'F3', 3).map(
    (text): StyledLine => ({
      text,
      font: 'F3',
      size: 7.5,
      color: COLOR_ACCESA,
    }),
  )

  const areaLines = wrapWinAnsiText(row.areaLabel, colWidths[3] ?? 128, 7.5, 'F1', 2).map(
    (text): StyledLine => ({
      text,
      font: 'F1',
      size: 7.5,
      color: COLOR_ACCESA,
    }),
  )
  const deviceLines = wrapWinAnsiText(row.deviceLabel, colWidths[3] ?? 128, 7, 'F1', 2).map(
    (text): StyledLine => ({
      text,
      font: 'F1',
      size: 7,
      color: COLOR_ACCESA_MUTED,
    }),
  )
  const col3Lines = [...areaLines, ...deviceLines]

  const col4Lines = wrapWinAnsiText(row.reasonLabel, colWidths[4] ?? 108, 7.5, 'F1', 3).map(
    (text): StyledLine => ({
      text,
      font: 'F1',
      size: 7.5,
      color: COLOR_ACCESA_MUTED,
    }),
  )

  const col5Lines = wrapWinAnsiText(row.occurredAtLabel, colWidths[5] ?? 82, 7, 'F1', 3).map(
    (text): StyledLine => ({
      text,
      font: 'F1',
      size: 7,
      color: COLOR_ACCESA,
    }),
  )

  const col6Lines = wrapWinAnsiText(row.receivedAtLabel, colWidths[6] ?? 82, 7, 'F1', 3).map(
    (text): StyledLine => ({
      text,
      font: 'F1',
      size: 7,
      color: COLOR_ACCESA,
    }),
  )

  const columns = [col0Lines, col1Lines, col2Lines, col3Lines, col4Lines, col5Lines, col6Lines]
  const maxLines = Math.max(1, ...columns.map((lines) => lines.length))
  const height = Math.max(MIN_ROW_HEIGHT, ROW_PAD_TOP + maxLines * ROW_LINE_HEIGHT + ROW_PAD_BOTTOM)

  return { columns, height }
}

function drawTableHeader(cmds: string[], yTop: number): number {
  const yBottom = yTop - TABLE_HEADER_HEIGHT
  drawRectFill(cmds, MARGIN_X, yBottom, CONTENT_WIDTH, TABLE_HEADER_HEIGHT, COLOR_ACCESA)

  let cursorX = MARGIN_X
  for (const col of TABLE_COLUMNS) {
    drawText(cmds, cursorX + ROW_PAD_X, yTop - 14.5, toWinAnsiText(col.label), 'F2', 8, COLOR_WHITE)
    cursorX += col.width
  }

  return yBottom
}

function drawTableRow(cmds: string[], row: PreparedRow, yTop: number, isOddRow: boolean): number {
  const yBottom = yTop - row.height

  if (isOddRow) {
    drawRectFill(cmds, MARGIN_X, yBottom, CONTENT_WIDTH, row.height, COLOR_ZEBRA_BG)
  }

  drawLine(cmds, MARGIN_X, yBottom, MARGIN_X + CONTENT_WIDTH, yBottom, COLOR_BORDER, 0.45)

  let cursorX = MARGIN_X
  drawLine(cmds, cursorX, yTop, cursorX, yBottom, COLOR_GRID, 0.45)

  for (let colIdx = 0; colIdx < TABLE_COLUMNS.length; colIdx += 1) {
    const col = TABLE_COLUMNS[colIdx]
    const lines = row.columns[colIdx] ?? []
    if (!col) continue

    let lineY = yTop - ROW_PAD_TOP - 6.5
    for (const line of lines) {
      drawText(cmds, cursorX + ROW_PAD_X, lineY, line.text, line.font, line.size, line.color)
      lineY -= ROW_LINE_HEIGHT
    }

    cursorX += col.width
    drawLine(cmds, cursorX, yTop, cursorX, yBottom, COLOR_GRID, 0.45)
  }

  return yBottom
}

function drawPageFooter(cmds: string[], pageNumber: number, totalPages: number) {
  drawLine(cmds, MARGIN_X, FOOTER_LINE_Y, MARGIN_X + CONTENT_WIDTH, FOOTER_LINE_Y, COLOR_BORDER, 0.6)
  drawText(
    cmds,
    MARGIN_X,
    FOOTER_TEXT_Y,
    'Accesa - Sistema de Control de Acceso RFID',
    'F1',
    8,
    COLOR_TEXT_LIGHT_MUTED,
  )

  const pageLabel = `Página ${pageNumber} de ${totalPages}`
  const pageLabelWidth = estimateTextWidth(pageLabel, 8, 'F1')
  drawText(
    cmds,
    MARGIN_X + CONTENT_WIDTH - pageLabelWidth,
    FOOTER_TEXT_Y,
    pageLabel,
    'F1',
    8,
    COLOR_TEXT_LIGHT_MUTED,
  )
}

function drawFirstPageHeader(cmds: string[], params: AccessEventsPdfParams): number {
  const bannerHeight = 54
  const bannerBottom = TOP_Y - bannerHeight // 522

  drawRectFill(cmds, MARGIN_X, bannerBottom, CONTENT_WIDTH, bannerHeight, COLOR_ACCESA)

  const title = 'Accesa - Reporte de Bitácora de Accesos'
  drawText(cmds, MARGIN_X + 14, TOP_Y - 22, title, 'F2', 14.5, COLOR_WHITE)

  const rightTag = 'AUDITORÍA RFID'
  const rightTagWidth = estimateTextWidth(rightTag, 8.5, 'F2')
  drawText(
    cmds,
    MARGIN_X + CONTENT_WIDTH - 14 - rightTagWidth,
    TOP_Y - 21,
    rightTag,
    'F2',
    8.5,
    COLOR_BANNER_SUBTITLE,
  )

  const generatedAt = toWinAnsiText(params.generatedAtLabel)
  const subtitle = `Generado: ${generatedAt}   |   Registros incluidos: ${params.rows.length}   |   Total en consulta: ${params.totalInQuery}`
  drawText(
    cmds,
    MARGIN_X + 14,
    TOP_Y - 40,
    truncateWithEllipsis(subtitle, CONTENT_WIDTH - 28, 8.5, 'F1'),
    'F1',
    8.5,
    COLOR_BANNER_SUBTITLE,
  )

  // Summary + active filters box
  const summaryTop = bannerBottom - 10 // 512
  const { granted, denied } = countDecisions(params.rows)
  const kpiLine = toWinAnsiText(
    `Resumen del lote exportado: ${params.rows.length} registros   |   Concedidos: ${granted}   |   Denegados: ${denied}   |   Total de la consulta: ${params.totalInQuery}`,
  )

  const filterRaw =
    params.filterSummary.length > 0
      ? params.filterSummary.join(' | ')
      : 'Sin filtros aplicados (vista general)'
  const filterLines = wrapWinAnsiText(
    `Filtros activos: ${filterRaw}`,
    CONTENT_WIDTH - 24,
    8,
    'F1',
    5,
  )

  const summaryHeight = 12 + 13 + filterLines.length * 10.5 + 6
  const summaryBottom = summaryTop - summaryHeight

  drawRectFillStroke(
    cmds,
    MARGIN_X,
    summaryBottom,
    CONTENT_WIDTH,
    summaryHeight,
    COLOR_SUMMARY_BG,
    COLOR_BORDER,
    0.6,
  )

  drawText(
    cmds,
    MARGIN_X + 12,
    summaryTop - 15,
    truncateWithEllipsis(kpiLine, CONTENT_WIDTH - 24, 8.5, 'F2'),
    'F2',
    8.5,
    COLOR_ACCESA,
  )

  let filterY = summaryTop - 28.5
  for (const line of filterLines) {
    drawText(cmds, MARGIN_X + 12, filterY, line, 'F1', 8, COLOR_ACCESA_MUTED)
    filterY -= 10.5
  }

  return summaryBottom - 12
}

function drawContinuationPageHeader(cmds: string[], generatedAtLabel: string): number {
  drawText(
    cmds,
    MARGIN_X,
    TOP_Y - 12,
    'Accesa - Reporte de Bitácora de Accesos (continuación)',
    'F2',
    10,
    COLOR_ACCESA,
  )

  const rightText = toWinAnsiText(`Generado: ${generatedAtLabel}`)
  const rightWidth = estimateTextWidth(rightText, 8, 'F1')
  drawText(
    cmds,
    MARGIN_X + CONTENT_WIDTH - rightWidth,
    TOP_Y - 12,
    rightText,
    'F1',
    8,
    COLOR_TEXT_LIGHT_MUTED,
  )

  drawLine(cmds, MARGIN_X, TOP_Y - 20, MARGIN_X + CONTENT_WIDTH, TOP_Y - 20, COLOR_ACCESA, 0.8)
  return TOP_Y - 30
}

/**
 * Generates a pure PDF 1.4 document with WinAnsiEncoding containing the access
 * events report table, filter summary, decision totals, and automatic pagination.
 */
export function buildAccessEventsPdf(params: AccessEventsPdfParams): Uint8Array {
  const preparedRows = params.rows.map(prepareRow)
  const pageCommandsList: string[][] = []

  let currentCmds: string[] = []
  let tableTop = drawFirstPageHeader(currentCmds, params)
  let cursorY = drawTableHeader(currentCmds, tableTop)
  let rowsOnPage = 0

  if (preparedRows.length === 0) {
    const emptyHeight = 28
    drawRectFillStroke(
      currentCmds,
      MARGIN_X,
      cursorY - emptyHeight,
      CONTENT_WIDTH,
      emptyHeight,
      COLOR_ZEBRA_BG,
      COLOR_BORDER,
      0.5,
    )
    drawText(
      currentCmds,
      MARGIN_X + 12,
      cursorY - 17,
      'No se incluyeron eventos en este reporte.',
      'F1',
      8.5,
      COLOR_ACCESA_MUTED,
    )
    pageCommandsList.push(currentCmds)
  } else {
    for (const row of preparedRows) {
      if (rowsOnPage > 0 && cursorY - row.height < BOTTOM_Y) {
        pageCommandsList.push(currentCmds)
        currentCmds = []
        tableTop = drawContinuationPageHeader(currentCmds, params.generatedAtLabel)
        cursorY = drawTableHeader(currentCmds, tableTop)
        rowsOnPage = 0
      }

      cursorY = drawTableRow(currentCmds, row, cursorY, rowsOnPage % 2 === 1)
      rowsOnPage += 1
    }
    pageCommandsList.push(currentCmds)
  }

  const totalPages = pageCommandsList.length
  const pageStreams = pageCommandsList.map((cmds, index) => {
    drawPageFooter(cmds, index + 1, totalPages)
    return cmds.join('\n')
  })

  // Allocate PDF object numbers:
  // 1: Catalog
  // 2: Pages
  // 3: Helvetica (/F1)
  // 4: Helvetica-Bold (/F2)
  // 5: Courier (/F3)
  // 6 + 2*i: Page object i
  // 7 + 2*i: Content stream object i
  const pageObjectIds = pageStreams.map((_, index) => 6 + index * 2)
  const totalObjects = 5 + pageStreams.length * 2

  const objectBodies: string[] = new Array(totalObjects + 1).fill('')
  objectBodies[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objectBodies[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageStreams.length} >>`
  objectBodies[3] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objectBodies[4] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  objectBodies[5] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'

  for (let i = 0; i < pageStreams.length; i += 1) {
    const pageObjId = 6 + i * 2
    const contentObjId = pageObjId + 1
    const streamData = pageStreams[i] ?? ''

    objectBodies[pageObjId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjId} 0 R >>`
    objectBodies[contentObjId] =
      `<< /Length ${streamData.length} >>\nstream\n${streamData}\nendstream`
  }

  const parts: string[] = ['%PDF-1.4\n']
  let byteOffset = parts[0]?.length ?? 0
  const offsets: number[] = new Array(totalObjects + 1).fill(0)

  for (let id = 1; id <= totalObjects; id += 1) {
    offsets[id] = byteOffset
    const objChunk = `${id} 0 obj\n${objectBodies[id] ?? ''}\nendobj\n`
    parts.push(objChunk)
    byteOffset += objChunk.length
  }

  const xrefOffset = byteOffset
  const xrefLines: string[] = [
    'xref',
    `0 ${totalObjects + 1}`,
    '0000000000 65535 f ',
  ]
  for (let id = 1; id <= totalObjects; id += 1) {
    const offsetStr = String(offsets[id] ?? 0).padStart(10, '0')
    xrefLines.push(`${offsetStr} 00000 n `)
  }

  const trailer = [
    ...xrefLines,
    'trailer',
    `<< /Size ${totalObjects + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n')

  parts.push(trailer)
  return encodeLatin1Bytes(parts.join(''))
}

function getDefaultPdfFilename(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `accesa-bitacora-accesos-${year}-${month}-${day}.pdf`
}

/**
 * Generates the access events PDF and triggers a browser file download.
 * Returns the generated filename.
 */
export function downloadAccessEventsPdf(params: AccessEventsPdfParams): string {
  const rawName = params.filename?.trim()
  const filename = rawName
    ? rawName.toLowerCase().endsWith('.pdf')
      ? rawName
      : `${rawName}.pdf`
    : getDefaultPdfFilename()

  const pdfBytes = buildAccessEventsPdf(params)
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })

  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(blob)
    if (typeof document !== 'undefined') {
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
    setTimeout(() => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl)
      }
    }, 1000)
  }

  return filename
}
