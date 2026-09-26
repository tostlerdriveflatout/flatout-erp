import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()

    // Always return a generic success response so this endpoint
    // does not reveal whether an email has an ERP account.
    const successResponse = {
      success: true,
      message:
        'If an ERP account exists for that email, a password reset link has been sent.'
    }

    if (!email) {
      return Response.json(successResponse)
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL!

    const secretKey =
      process.env.SUPABASE_SECRET_KEY!

    const adminClient = createClient(
      supabaseUrl,
      secretKey
    )

    // Only allow password recovery for an employee who has
    // an existing, active ERP login.
    const {
      data: employee,
      error: employeeError
    } = await adminClient
      .from('employees')
      .select('id, email, user_id, active, erp_access, invite_status')
      .ilike('email', email)
      .maybeSingle()

    if (
      employeeError ||
      !employee ||
      !employee.user_id ||
      !employee.active ||
      !employee.erp_access ||
      employee.invite_status !== 'active'
    ) {
      return Response.json(successResponse)
    }

    const { error: resetError } =
      await adminClient.auth.resetPasswordForEmail(
        employee.email,
        {
          redirectTo:
            'https://flatout-erp.vercel.app/set-password'
        }
      )

    if (resetError) {
      console.error(
        'Forgot password error:',
        resetError.message
      )

      // Still don't reveal account information.
      return Response.json(successResponse)
    }

    return Response.json(successResponse)
  } catch (error: any) {
    console.error(
      'Forgot password error:',
      error?.message || error
    )

    return Response.json({
      success: true,
      message:
        'If an ERP account exists for that email, a password reset link has been sent.'
    })
  }
}
