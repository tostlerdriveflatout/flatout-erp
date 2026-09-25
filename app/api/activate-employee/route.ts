import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const secretKey = process.env.SUPABASE_SECRET_KEY!

    // Verify the employee's logged-in Supabase session
    const userClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    )

    const {
      data: { user },
      error: userError
    } = await userClient.auth.getUser(accessToken)

    if (userError || !user) {
      return Response.json(
        { error: 'Invalid login session' },
        { status: 401 }
      )
    }

    // Server-only client used to update the employee record.
    // The employee never receives the secret key.
    const adminClient = createClient(
      supabaseUrl,
      secretKey
    )

    const { data: employee, error: employeeError } =
      await adminClient
        .from('employees')
        .select('id, user_id, active, erp_access')
        .eq('user_id', user.id)
        .single()

    if (employeeError || !employee) {
      return Response.json(
        { error: 'Employee record not found' },
        { status: 404 }
      )
    }

    if (!employee.active || !employee.erp_access) {
      return Response.json(
        { error: 'ERP access is disabled' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

    const { error: updateError } = await adminClient
      .from('employees')
      .update({
        invite_status: 'active',
        account_activated_at: now,
        updated_at: now
      })
      .eq('id', employee.id)
      .eq('user_id', user.id)

    if (updateError) {
      return Response.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return Response.json({
      success: true
    })
  } catch (error: any) {
    return Response.json(
      {
        error:
          error?.message ||
          'Unable to activate employee account'
      },
      { status: 500 }
    )
  }
}
