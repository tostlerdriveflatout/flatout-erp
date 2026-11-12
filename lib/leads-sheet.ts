import { createHash } from 'crypto'

// Turns rows from a Google Form responses sheet into lead records.
// Columns are found by header name, never by position, so reordering columns
// or adding new questions to a form does not break the sync.

export type LeadSourceKey = 'rig' | 'franchise'

export type ParsedLead = {
  rowKey: string
  name: string
  email: string | null
  phone: string | null
  leadType: 'Rig build' | 'Franchise'
  source: string
  interest: string
  stage: 'New' | 'Contacted'
  followUpDate: string | null
  submittedDate: string
  note: string
}

export type ParseResult = {
  leads: ParsedLead[]
  rowsFound: number
  skippedOld: number
  skippedInvalid: number
}

const SOURCE_INFO: Record<
  LeadSourceKey,
  { leadType: 'Rig build' | 'Franchise'; source: string }
> = {
  rig: { leadType: 'Rig build', source: 'Rig build form' },
  franchise: { leadType: 'Franchise', source: 'Franchise form' },
}

// Friendlier labels for long question headings. Anything not listed uses its own heading.
const LABELS: Array<[string, string]> = [
  ['which region', 'Region'],
  ['if you selected', 'Region detail'],
  ['what is your primary motivation', 'Motivation'],
  ['preferred date', 'Consultation date'],
  ['preferred time', 'Consultation time'],
  ['please rate your urgency', 'Urgency'],
  ['please list any', 'Questions or comments'],
  ['if yes, please let us know', 'Preferred hardware details'],
  ['do you require a pc', 'PC or console'],
  ['hardware preferences', 'Hardware preferences'],
  ['motion / haptics', 'Motion / haptics'],
  ['display(s)', 'Displays'],
]

const norm = (value: unknown) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const clean = (value: unknown) => String(value ?? '').trim()

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Returns YYYY-MM-DD, or null. Accepts M/D/YYYY (with optional time), YYYY-MM-DD, or a written date.
export function parseSheetDate(value: unknown): string | null {
  const text = clean(value)
  if (!text) return null

  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (us) {
    const month = Number(us[1])
    const day = Number(us[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${us[3]}-${pad(month)}-${pad(day)}`
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return null
  const d = new Date(parsed)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isChecked(value: unknown) {
  const v = norm(value)
  return v === 'true' || v === 'yes' || v === 'x' || v === '✓' || v === '1'
}

export function digitsOnly(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

export function parseLeadRows(
  rows: unknown[][],
  sourceKey: LeadSourceKey,
  startDate: string
): ParseResult {
  const info = SOURCE_INFO[sourceKey]
  const empty: ParseResult = {
    leads: [],
    rowsFound: Math.max(0, rows.length - 1),
    skippedOld: 0,
    skippedInvalid: 0,
  }
  if (rows.length < 2) return empty

  const headers = rows[0].map((h) => clean(h))
  const normHeaders = headers.map(norm)

  const exact = (...names: string[]) =>
    normHeaders.findIndex((h) => names.includes(h))
  const startsWith = (prefix: string) =>
    normHeaders.findIndex((h) => h.startsWith(prefix))

  const timestampIdx = exact('timestamp')
  if (timestampIdx === -1) {
    throw new Error(
      `A "Timestamp" column was not found. Headings seen: ${headers.join(' | ')}`
    )
  }
  const emailIdx = exact('email address', 'email')
  const nameIdx = exact('full name', 'name')
  const phoneIdx =
    exact('phone number', 'phone') !== -1
      ? exact('phone number', 'phone')
      : startsWith('phone number')
  const contactedIdx = exact('contacted')
  const budgetIdx = exact('budget')
  const regionIdx = startsWith('which region')
  const consultDateIdx = startsWith('preferred date')

  const core = new Set(
    [timestampIdx, emailIdx, nameIdx, phoneIdx, contactedIdx].filter(
      (i) => i !== -1
    )
  )

  const result: ParseResult = { ...empty, leads: [] }

  rows.slice(1).forEach((row) => {
    const get = (idx: number) => (idx === -1 ? '' : clean(row[idx]))

    const timestampRaw = get(timestampIdx)
    const submittedDate = parseSheetDate(timestampRaw)
    if (!timestampRaw || !submittedDate) {
      // Blank spacer rows and stray text are ignored quietly.
      if (row.some((cell) => clean(cell))) result.skippedInvalid += 1
      return
    }

    if (submittedDate < startDate) {
      result.skippedOld += 1
      return
    }

    const email = get(emailIdx).toLowerCase() || null
    const phone = get(phoneIdx) || null
    const name = get(nameIdx) || email || phone
    if (!name) {
      result.skippedInvalid += 1
      return
    }

    const lines: string[] = []
    headers.forEach((header, idx) => {
      if (core.has(idx)) return
      const value = get(idx)
      if (!value) return
      const h = norm(header)
      const label = LABELS.find(([prefix]) => h.startsWith(prefix))?.[1] || header
      lines.push(`${label}: ${value}`)
    })

    const budget = get(budgetIdx)
    const region = get(regionIdx)
    const interest =
      sourceKey === 'rig'
        ? budget
          ? `Rig build · Budget ${budget}`
          : 'Rig build'
        : region
          ? `Franchise · ${region}`
          : 'Franchise'

    const consultDate =
      sourceKey === 'franchise' && consultDateIdx !== -1
        ? parseSheetDate(get(consultDateIdx))
        : null

    const rowKey = createHash('sha256')
      .update(`${sourceKey}|${timestampRaw}|${email || ''}|${name.toLowerCase()}`)
      .digest('hex')

    result.leads.push({
      rowKey,
      name,
      email,
      phone,
      leadType: info.leadType,
      source: info.source,
      interest,
      stage: isChecked(get(contactedIdx)) ? 'Contacted' : 'New',
      followUpDate: consultDate,
      submittedDate,
      note: [`Imported from the ${info.source} (submitted ${timestampRaw}).`, ...lines].join('\n'),
    })
  })

  return result
}
