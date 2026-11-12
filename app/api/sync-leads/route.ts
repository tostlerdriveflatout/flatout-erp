import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  digitsOnly,
  parseLeadRows,
  type LeadSourceKey,
  type ParsedLead,
} from '@/lib/leads-sheet'

export const runtime = 'nodejs'

// Only form responses submitted on or after this date are imported.
// Override with the LEADS_IMPORT_START_DATE environment variable (YYYY-MM-DD).
const DEFAULT_START_DATE = '2026-11-12'

type SourceConfig = {
  key: LeadSourceKey
  label: string
  sheetIdEnv: string
  tabEnv: string
}

const SOURCES: SourceConfig[] = [
  {
    key: 'rig',
    label: 'Rig build form',
    sheetIdEnv: 'GOOGLE_RIG_LEADS_SHEET_ID',
    tabEnv: 'GOOGLE_RIG_LEADS_TAB',
  },
  {
    key: 'franchise',
    label: 'Franchise form',
    sheetIdEnv: 'GOOGLE_FRANCHISE_LEADS_SHEET_ID',
    tabEnv: 'GOOGLE_FRANCHISE_LEADS_TAB',
  },
]

type CustomerLite = { id: string; name: string; email: string | null; phone: string | null }

type SourceResult = {
  source: string
  rows_found: number
  imported: number
  already_imported: number
  skipped_before_start_date: number
  skipped_invalid: number
  errors: string[]
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the user is logged into Flatout ERP (same approach as the Price Guide sync)
    const authHeader = request.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log into Flatout ERP.' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.substring(7)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase environment variables are missing.' },
        { status: 500 }
      )
    }

    const authSupabase = createClient(supabaseUrl, supabaseKey)
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Your login session is invalid or expired.' },
        { status: 401 }
      )
    }

    // 2. Supabase client acting as the logged-in user, so the normal database rules apply
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })

    // 3. Google connection (same service account as the Price Guide)
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!serviceAccountEmail || !privateKey) {
      return NextResponse.json(
        { error: 'Google service account environment variables are missing.' },
        { status: 500 }
      )
    }

    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })

    const startDate = process.env.LEADS_IMPORT_START_DATE || DEFAULT_START_DATE

    // 4. Load existing customers once so people are matched, not duplicated
    const customers: CustomerLite[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('customers')
        .select('id,name,email,phone')
        .range(from, from + 999)
      if (error) {
        return NextResponse.json(
          { error: 'Customers could not be loaded.', details: error.message },
          { status: 500 }
        )
      }
      customers.push(...((data || []) as CustomerLite[]))
      if (!data || data.length < 1000) break
    }

    const byEmail = new Map<string, string>()
    const byPhone = new Map<string, string>()
    const indexCustomer = (c: CustomerLite) => {
      if (c.email) byEmail.set(c.email.trim().toLowerCase(), c.id)
      const digits = digitsOnly(c.phone)
      if (digits.length >= 10) byPhone.set(digits.slice(-10), c.id)
    }
    customers.forEach(indexCustomer)

    async function findOrCreateCustomer(lead: ParsedLead): Promise<string> {
      if (lead.email && byEmail.has(lead.email)) return byEmail.get(lead.email)!
      const digits = digitsOnly(lead.phone)
      if (digits.length >= 10 && byPhone.has(digits.slice(-10))) {
        return byPhone.get(digits.slice(-10))!
      }

      const { data, error } = await supabase
        .from('customers')
        .insert({ name: lead.name, email: lead.email, phone: lead.phone })
        .select('id,name,email,phone')
        .single()
      if (error || !data) {
        throw new Error(`Customer not created: ${error?.message || 'Unknown error'}`)
      }
      indexCustomer(data as CustomerLite)
      return (data as CustomerLite).id
    }

    // 5. Import each sheet
    const results: SourceResult[] = []

    for (const source of SOURCES) {
      const result: SourceResult = {
        source: source.label,
        rows_found: 0,
        imported: 0,
        already_imported: 0,
        skipped_before_start_date: 0,
        skipped_invalid: 0,
        errors: [],
      }
      results.push(result)

      const spreadsheetId = process.env[source.sheetIdEnv]
      if (!spreadsheetId) {
        result.errors.push(`${source.sheetIdEnv} is not set in Vercel.`)
        continue
      }
      const tab = process.env[source.tabEnv] || 'Form Responses 1'

      let rows: unknown[][] = []
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${tab}'!A:AZ`,
          valueRenderOption: 'FORMATTED_VALUE',
        })
        rows = (response.data.values || []) as unknown[][]
      } catch (error: any) {
        result.errors.push(
          `The sheet could not be read. Check that it is shared with the service account as Viewer. (${error?.message || error})`
        )
        continue
      }

      let parsed
      try {
        parsed = parseLeadRows(rows, source.key, startDate)
      } catch (error: any) {
        result.errors.push(error?.message || String(error))
        continue
      }

      result.rows_found = parsed.rowsFound
      result.skipped_before_start_date = parsed.skippedOld
      result.skipped_invalid = parsed.skippedInvalid

      for (const lead of parsed.leads) {
        // Claim the row first. If it is already in the log, it was imported before
        // (or another click is importing it right now), so skip it.
        const claim = await supabase
          .from('lead_import_log')
          .insert({ source: source.key, row_key: lead.rowKey })
          .select('id')
          .single()

        if (claim.error || !claim.data) {
          if (claim.error?.code === '23505') {
            result.already_imported += 1
          } else {
            result.errors.push(
              `${lead.name}: import log not written (${claim.error?.message || 'Unknown error'})`
            )
          }
          continue
        }
        const claimId = (claim.data as { id: string }).id

        try {
          const customerId = await findOrCreateCustomer(lead)

          const leadInsert = await supabase
            .from('leads')
            .insert({
              customer_id: customerId,
              lead_type: lead.leadType,
              source: lead.source,
              interest: lead.interest,
              stage: lead.stage,
              follow_up_date: lead.followUpDate,
            })
            .select('id')
            .single()

          if (leadInsert.error || !leadInsert.data) {
            throw new Error(
              `Lead not created: ${leadInsert.error?.message || 'Unknown error'}`
            )
          }
          const leadId = (leadInsert.data as { id: string }).id

          const noteInsert = await supabase
            .from('lead_notes')
            .insert({ lead_id: leadId, note: lead.note, author: 'Form sync' })
          if (noteInsert.error) {
            result.errors.push(
              `${lead.name}: lead created, but its note was not saved (${noteInsert.error.message})`
            )
          }

          await supabase
            .from('lead_import_log')
            .update({ lead_id: leadId })
            .eq('id', claimId)

          result.imported += 1
        } catch (error: any) {
          // Release the claim so the next sync tries this row again.
          await supabase.from('lead_import_log').delete().eq('id', claimId)
          result.errors.push(`${lead.name}: ${error?.message || String(error)}`)
        }
      }
    }

    const imported = results.reduce((sum, r) => sum + r.imported, 0)
    const errors = results.flatMap((r) => r.errors.map((e) => `${r.source}: ${e}`))

    return NextResponse.json({
      success: errors.length === 0,
      start_date: startDate,
      imported,
      results,
      errors,
      synced_by: user.email,
      synced_at: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Lead sync failed:', error)
    return NextResponse.json(
      { error: 'Lead sync failed.', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
