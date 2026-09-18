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

rows.slice(1).forEach((row, index) => {
  const name = cleanText(row[descriptionIndex])
  const sellPrice = cleanMoney(row[retailIndex])
  const sheetRow = index + 2

  if (!name) {
    skippedDetails.push(`Row ${sheetRow}: Missing Description`)
  } else if (sellPrice === null) {
    skippedDetails.push(`Row ${sheetRow}: ${name} — Missing or invalid Retail price`)
  }
})

    for (const product of products) {
      const { source_row, ...payload } = product

      let existingQuery = supabase
        .from('products')
        .select('id,sku,name,vendor')

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
        }
      } else {
        const { error } = await supabase
          .from('products')
          .insert(payload)

        if (error) {
          errors.push(`Row ${source_row}: ${error.message}`)
        } else {
          added++
        }
      }
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
      errors,
      synced_by: user.email,
      synced_at: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Price Guide sync failed:', error)

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
  errors,
  synced_by: user.email,
  synced_at: new Date().toISOString(),
})
