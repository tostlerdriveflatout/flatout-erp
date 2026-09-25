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
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const secretKey = process.env.SUPABASE_SECRET_KEY!

    // Verify the person making the request.
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

    // Confirm the logged-in user is an active ERP Admin.
    const { data: employee, error: employeeError } =
      await userClient
        .from('employees')
        .select('id, role, active, erp_access')
        .eq('user_id', user.id)
        .single()

    if (
      employeeError ||
      !employee ||
      employee.role !== 'Admin' ||
      !employee.active ||
      !employee.erp_access
    ) {
      return Response.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const employeeId = String(body.employeeId || '')

    if (!employeeId) {
      return Response.json(
        { error: 'Employee is required' },
        { status: 400 }
      )
    }

    // Secret-key client — server only.
    const adminClient = createClient(
      supabaseUrl,
      secretKey
    )

    const {
      data: employeeToReset,
      error: lookupError
    } = await adminClient
      .from('employees')
      .select('id, name, email, user_id, active, erp_access')
      .eq('id', employeeId)
      .single()

    if (lookupError || !employeeToReset) {
      return Response.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    if (!employeeToReset.active) {
      return Response.json(
        { error: 'Inactive employees cannot reset their ERP password' },
        { status: 400 }
      )
    }

    if (!employeeToReset.user_id) {
      return Response.json(
        { error: 'This employee does not have an ERP login yet' },
        { status: 400 }
      )
    }

    if (!employeeToReset.email) {
      return Response.json(
        { error: 'Employee does not have an email address' },
        { status: 400 }
      )
    }

// Send the password recovery email through Supabase Auth.
// Supabase will use the configured Reset Password email template
// and custom SMTP settings.
const { error: resetError } =
  await adminClient.auth.resetPasswordForEmail(
    employeeToReset.email,
    {
      redirectTo:
        'https://flatout-erp.vercel.app/set-password'
    }
  )

if (resetError) {
  return Response.json(
    { error: resetError.message },
    { status: 400 }
  )
}

return Response.json({
  success: true,
  message: `Password reset email sent to ${employeeToReset.email}`
})

  } catch (error: any) {
    return Response.json(
      {
        error:
          error?.message ||
          'Unable to create password reset'
      },
      { status: 500 }
    )
  }
}
