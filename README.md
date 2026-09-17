# Flatout ERP — Production Starter

This is the database-backed successor to the standalone V1.6 prototype.

## Included now
- Flatout-branded Next.js app
- Supabase email/password login
- Customers
- Searchable customer selection when creating an order
- Orders whose total comes from line items (no separate customer-price field)
- Product line items with sell price + cost snapshots
- Labor/Service, Shipping, Miscellaneous, Discount line items; cost may be blank
- Duplicate / Remove / inline editing
- Purchasing statuses: Need to Order → Ordered → Backordered → Shipped → Received
- Live sell, cost, gross profit, gross margin
- PostgreSQL schema + Row Level Security
- Admin/Sales/Operations role foundation
- Product schema mapped to the Price Guide concept; Markup is intentionally ignored

## Important
The direct Google Sheets sync and Admin User Management screens are the next integration step. The database already includes `products`, `profiles`, and `price_sync_runs` to support them. Do not publish the Price Guide publicly because it contains dealer costs.

## Deploy sequence
1. In Supabase SQL Editor, run `supabase/schema.sql`.
2. In Supabase Authentication, create your first user using your own Flatout email.
3. In SQL Editor, make that first user an admin:
   `update public.profiles set role='admin' where email='YOUR_EMAIL';`
4. Put this project in a GitHub repository.
5. In Vercel, Add New → Project → import the GitHub repository.
6. Add these Vercel environment variables from Supabase Project Settings → API:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY (server-only; never expose in browser code)
7. Deploy.
8. Test the Vercel temporary URL before configuring `erp.driveflatout.com`.
9. After testing, add `erp.driveflatout.com` under Vercel Project → Settings → Domains, then add the exact DNS record Vercel provides in Namecheap.

## Local test (optional)
Copy `.env.example` to `.env.local`, fill in Supabase values, then:
`npm install`
`npm run dev`

## Google Price Guide sync
Keep the existing Google Sheet as the master. The intended sync maps:
- Catagory → category
- Company → vendor
- Description → name
- Retail → sell_price
- Our Price → cost (read the calculated value)
- SKU → sku
- Images → image_ref
- Markup → ignored

Existing `order_items` store their own sell_price/cost snapshot, so future Price Guide changes do not rewrite historical orders.
