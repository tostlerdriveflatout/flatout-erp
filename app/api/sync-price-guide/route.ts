import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SHEET_TAB = 'Price Guide'

function cleanMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  const cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .trim()

  if (!cleaned) return null

  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null

  const text = String(value).trim()
  return text || null
}

// A price change of this size (either direction) is flagged "Needs review" in the app,
// because it is often a typo in the Price Guide rather than a real change.
const FLAG_PERCENT = 25

type ChangeRow = {
  product_id: string | null
  sku: string | null
  name: string | null
  vendor: string | null
  change_type: 'new' | 'changed' | 'missing'
  field?: 'sell_price' | 'cost'
  old_value?: number | null
  new_value?: number | null
  pct_change?: number | null
  sell_price?: number | null
  cost?: number | null
  last_seen?: string | null
  flagged?: boolean
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// Compares the saved prices with the new ones from the sheet.
function priceChanges(
  before: { sell_price?: unknown; cost?: unknown },
  after: { sell_price: number; cost: number | null }
) {
  const result: Array<{
    field: 'sell_price' | 'cost'
    old_value: number | null
    new_value: number | null
    pct_change: number | null
    flagged: boolean
  }> = []

  for (const field of ['sell_price', 'cost'] as const) {
    const oldValue = toNumber(before[field])
    const newValue = toNumber(after[field])

    if (oldValue === null && newValue === null) continue
    if (oldValue !== null && newValue !== null && Math.abs(oldValue - newValue) < 0.005) continue

    let pct: number | null = null
    if (oldValue !== null && newValue !== null && oldValue !== 0) {
      pct = Math.round(((newValue - oldValue) / Math.abs(oldValue)) * 10000) / 100
    }

    // Flag a big swing, or a price that disappeared from the sheet.
    const flagged =
      (oldValue !== null && newValue === null) ||
      (pct !== null && Math.abs(pct) >= FLAG_PERCENT)

    result.push({ field, old_value: oldValue, new_value: newValue, pct_change: pct, flagged })
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    // -------------------------------------------------------
    // 1. Verify the user is logged into Flatout ERP
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // 2. Create a Supabase client using the logged-in user
    // -------------------------------------------------------

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    // -------------------------------------------------------
    // 3. Connect securely to the Google Price Guide
    // -------------------------------------------------------

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    const spreadsheetId = process.env.GOOGLE_PRICE_GUIDE_SHEET_ID

    if (!serviceAccountEmail || !privateKey || !spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Price Guide environment variables are missing.' },
        { status: 500 }
      )
    }

    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({
      version: 'v4',
      auth,
    })

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_TAB}'!A:Z`,
    })

    const rows = response.data.values || []

    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'No Price Guide data was found.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------
    // 4. Find Price Guide columns
    // -------------------------------------------------------

    const headers = rows[0].map((header) =>
      String(header || '').trim().toLowerCase()
    )

    const findColumn = (...names: string[]) =>
      headers.findIndex((header) =>
        names.some((name) => header === name.toLowerCase())
      )

    const categoryIndex = findColumn('Category')
    const companyIndex = findColumn('Company')
    const descriptionIndex = findColumn('Description')
    const retailIndex = findColumn('Retail')
    const costIndex = findColumn('Our Price')
    const skuIndex = findColumn('SKU')
    const imageIndex = findColumn('Images', 'Image')

    if (
      categoryIndex === -1 ||
      descriptionIndex === -1 ||
      retailIndex === -1 ||
      costIndex === -1 ||
      skuIndex === -1
    ) {
      return NextResponse.json(
        {
          error:
            'Required Price Guide columns were not found. Expected Category, Description, Retail, Our Price, and SKU.',
          headers,
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------
    // 5. Convert Google Sheet rows into ERP products
    // -------------------------------------------------------

    const products = rows
      .slice(1)
      .map((row, index) => {
        const name = cleanText(row[descriptionIndex])
        const sellPrice = cleanMoney(row[retailIndex])

        // Skip blank rows or products without a Retail price
        if (!name || sellPrice === null) return null

        const sku = cleanText(row[skuIndex])

        // A SKU is required. Without one, a product can't be matched later
        // and adding the SKU afterwards would create a duplicate.
        if (!sku) return null

        const vendor =
          companyIndex >= 0 ? cleanText(row[companyIndex]) : null

        const category = cleanText(row[categoryIndex])

        const cost = cleanMoney(row[costIndex])

        const imageRef =
          imageIndex >= 0 ? cleanText(row[imageIndex]) : null

        const sourceKey = sku
          ? `sku:${sku.toLowerCase()}`
          : `name:${(vendor || '').toLowerCase()}:${name.toLowerCase()}`

        return {
          sku,
          name,
          vendor,
          category,
          sell_price: sellPrice,
          cost,
          image_ref: imageRef,
          active: true,
          source_key: sourceKey,
          last_synced_at: new Date().toISOString(),
          source_row: index + 2,
        }
      })
      .filter(Boolean) as Array<{
        sku: string | null
        name: string
        vendor: string | null
        category: string | null
        sell_price: number
        cost: number | null
        image_ref: string | null
        active: boolean
        source_key: string
        last_synced_at: string
        source_row: number
      }>

    // -------------------------------------------------------
    // 6. Add/update products in Supabase
    // -------------------------------------------------------

   let added = 0
let updated = 0
const skipped = rows.length - 1 - products.length
const skippedDetails: string[] = []
const errors: string[] = []
const warnings: string[] = []
const changes: ChangeRow[] = []

rows.slice(1).forEach((row, index) => {
  const name = cleanText(row[descriptionIndex])
  const sellPrice = cleanMoney(row[retailIndex])
  const sheetRow = index + 2

  if (!name) {
    skippedDetails.push(`Row ${sheetRow}: Missing Description`)
  } else if (sellPrice === null) {
    skippedDetails.push(`Row ${sheetRow}: ${name} — Missing or invalid Retail price`)
  } else if (!cleanText(row[skuIndex])) {
    skippedDetails.push(`Row ${sheetRow}: ${name} — Missing SKU (will import once a SKU is added)`)
  }
})

    for (const product of products) {
      const { source_row, ...payload } = product

      let existingQuery = supabase
        .from('products')
        .select('id,sku,name,vendor,sell_price,cost')

      if (product.sku) {
        existingQuery = existingQuery.eq('sku', product.sku)
      } else {
        existingQuery = existingQuery
          .eq('name', product.name)

        if (product.vendor) {
          existingQuery = existingQuery.eq('vendor', product.vendor)
        } else {
          existingQuery = existingQuery.is('vendor', null)
        }
      }

      const { data: existing, error: lookupError } =
        await existingQuery.maybeSingle()

      if (lookupError) {
        errors.push(`Row ${source_row}: ${lookupError.message}`)
        continue
      }

      if (existing) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', existing.id)

        if (error) {
          errors.push(`Row ${source_row}: ${error.message}`)
        } else {
          updated++

          for (const change of priceChanges(existing, payload)) {
            changes.push({
              product_id: existing.id,
              sku: payload.sku,
              name: payload.name,
              vendor: payload.vendor,
              change_type: 'changed',
              sell_price: payload.sell_price,
              cost: payload.cost,
              ...change,
            })
          }
        }
      } else {
        const { data: inserted, error } = await supabase
          .from('products')
          .insert(payload)
          .select('id')
          .single()

        if (error) {
          errors.push(`Row ${source_row}: ${error.message}`)
        } else {
          added++
          changes.push({
            product_id: inserted?.id ?? null,
            sku: payload.sku,
            name: payload.name,
            vendor: payload.vendor,
            change_type: 'new',
            sell_price: payload.sell_price,
            cost: payload.cost,
          })
        }
      }
    }

    // -------------------------------------------------------
    // 6b. Save what changed, so the app can show it until the next sync.
    // The sync itself has already finished; a problem here only adds a warning.
    // -------------------------------------------------------

    let historyRunId: string | null = null
    let flaggedCount = 0
    let missingCount = 0
    let changedProductCount = 0

    try {
      // Products that came from the sheet earlier but are no longer in it.
      // Every sheet row with a SKU counts as "still there", even if it was skipped.
      const sheetSkus = new Set<string>()
      rows.slice(1).forEach((row) => {
        const sku = cleanText(row[skuIndex])
        if (sku) sheetSkus.add(sku.toLowerCase())
      })

      const missing: ChangeRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error: missingError } = await supabase
          .from('products')
          .select('id,sku,name,vendor,sell_price,cost,last_synced_at')
          .eq('active', true)
          .not('source_key', 'is', null)
          .order('id')
          .range(from, from + 999)

        if (missingError) throw new Error(missingError.message)

        for (const product of data || []) {
          if (product.sku && !sheetSkus.has(String(product.sku).trim().toLowerCase())) {
            missing.push({
              product_id: product.id,
              sku: product.sku,
              name: product.name,
              vendor: product.vendor,
              change_type: 'missing',
              sell_price: toNumber(product.sell_price),
              cost: toNumber(product.cost),
              last_seen: product.last_synced_at ?? null,
            })
          }
        }

        if (!data || data.length < 1000) break
      }

      missingCount = missing.length
      flaggedCount = changes.filter((c) => c.flagged).length
      changedProductCount = new Set(
        changes.filter((c) => c.change_type === 'changed').map((c) => c.product_id)
      ).size

      const { data: run, error: runError } = await supabase
        .from('price_sync_log')
        .insert({
          run_by: user.email,
          new_count: added,
          changed_count: changedProductCount,
          missing_count: missingCount,
          skipped_count: skipped,
          flagged_count: flaggedCount,
        })
        .select('id')
        .single()

      if (runError || !run) {
        throw new Error(runError?.message || 'The sync log row was not created.')
      }

      historyRunId = run.id as string

      const rowsToSave = [...changes, ...missing].map((c) => ({
        run_id: historyRunId,
        product_id: c.product_id,
        sku: c.sku,
        name: c.name,
        vendor: c.vendor,
        change_type: c.change_type,
        field: c.field ?? null,
        old_value: c.old_value ?? null,
        new_value: c.new_value ?? null,
        pct_change: c.pct_change ?? null,
        sell_price: c.sell_price ?? null,
        cost: c.cost ?? null,
        last_seen: c.last_seen ?? null,
        flagged: c.flagged ?? false,
      }))

      for (let i = 0; i < rowsToSave.length; i += 200) {
        const { error: saveError } = await supabase
          .from('price_sync_changes')
          .insert(rowsToSave.slice(i, i + 200))
        if (saveError) throw new Error(saveError.message)
      }
    } catch (historyError: any) {
      console.error('Price Guide sync history not saved:', historyError)
      warnings.push(
        `Sync history was not saved (${historyError?.message || historyError}). The sync itself completed.`
      )
    }

    // -------------------------------------------------------
    // 7. Return sync results
    // -------------------------------------------------------

    return NextResponse.json({
      success: errors.length === 0,
      spreadsheet: 'FSR Rig build out',
      tab: SHEET_TAB,
      rows_found: rows.length - 1,
      products_processed: products.length,
      added,
      updated,
      skipped,
      skipped_details: skippedDetails,
      price_changes: changedProductCount,
      missing_from_sheet: missingCount,
      needs_review: flaggedCount,
      history_run_id: historyRunId,
      warnings,
      errors,
      synced_by: user.email,
      synced_at: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Price Guide sync failed:', error)
        return NextResponse.json(
      {
        error: 'Price Guide sync failed.',
        details: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}
