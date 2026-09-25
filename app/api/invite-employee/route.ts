import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const accessToken = authHeader.replace('Bearer ', '')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const secretKey = process.env.SUPABASE_SECRET_KEY!

    // Verify the person making the request
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    })

    const {
      data: { user },
      error: userError
    } = await userClient.auth.getUser(accessToken)

    if (userError || !user) {
      return Response.json({ error: 'Invalid login session' }, { status: 401 })
    }

    // Confirm the logged-in user is an active ERP Admin
    const { data: employee, error: employeeError } = await userClient
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
      return Response.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const employeeId = String(body.employeeId || '')

    if (!employeeId) {
      return Response.json({ error: 'Employee is required' }, { status: 400 })
    }

    // Secret-key client — server only
    const adminClient = createClient(supabaseUrl, secretKey)

    const { data: employeeToInvite, error: lookupError } = await adminClient
      .from('employees')
      .select('id, name, email, user_id, active')
      .eq('id', employeeId)
      .single()

    if (lookupError || !employeeToInvite) {
      return Response.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (!employeeToInvite.active) {
      return Response.json(
        { error: 'Inactive employees cannot be invited' },
        { status: 400 }
      )
    }

    if (!employeeToInvite.email) {
      return Response.json(
        { error: 'Employee must have an email address before being invited' },
        { status: 400 }
      )
    }

    if (employeeToInvite.user_id) {
      return Response.json(
        { error: 'This employee already has an ERP login' },
        { status: 400 }
      )
    }

 const { data: inviteData, error: inviteError } =
  await adminClient.auth.admin.inviteUserByEmail(
    employeeToInvite.email,
    {
      redirectTo: 'https://flatout-erp.vercel.app/set-password'
    }
  )

    if (inviteError) {
      return Response.json({ error: inviteError.message }, { status: 400 })
    }

    if (!inviteData.user) {
      return Response.json(
        { error: 'Invitation was sent but no user account was returned' },
        { status: 500 }
      )
    }

    // Connect the Supabase Auth account to the employee record
    const { error: updateError } = await adminClient
      .from('employees')
.update({
  user_id: inviteData.user.id,
  erp_access: true,
  invite_status: 'pending',
  invited_at: new Date().toISOString(),
  account_activated_at: null,
  updated_at: new Date().toISOString()
})
      .eq('id', employeeToInvite.id)

    if (updateError) {
      return Response.json(
        { error: `Invitation sent, but employee link failed: ${updateError.message}` },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      message: `Invitation sent to ${employeeToInvite.email}`
    })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || 'Unable to invite employee' },
      { status: 500 }
    )
  }
}
