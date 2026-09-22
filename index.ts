import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''
    const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user: caller }, error: callerError } = await client.auth.getUser()
    if (callerError || !caller) throw new Error('احراز هویت مدیر ناموفق است.')

    const admin = createClient(url, service)
    const { data: adminRow } = await admin.from('admin_profiles').select('user_id').eq('user_id', caller.id).maybeSingle()
    if (!adminRow) throw new Error('این حساب دسترسی مدیر ندارد.')

    const body = await req.json()
    const action = body.action

    if (action === 'create') {
      const name = String(body.name || '').trim()
      const phone = String(body.phone || '').replace(/\D/g, '')
      const goal = String(body.goal || 'تناسب اندام').trim()
      const password = String(body.password || '')
      const tuition_amount = Number(body.tuition_amount || 0)
      const paid_amount = Number(body.paid_amount || 0)
      const payment_date = body.payment_date || null
      if (!name || phone.length < 8 || password.length < 6) throw new Error('نام، شماره و رمز معتبر لازم است.')

      const email = `${phone}@academy.local`
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { role: 'athlete', name, phone }
      })
      if (createError) throw createError

      const { data: student, error: studentError } = await admin.from('students').insert({
        user_id: created.user.id, name, phone, goal, tuition_amount, paid_amount,
        last_payment_date: payment_date
      }).select().single()
      if (studentError) {
        await admin.auth.admin.deleteUser(created.user.id)
        throw studentError
      }

      if (paid_amount > 0) {
        const { error: payError } = await admin.from('payments').insert({
          student_id: student.id, amount: paid_amount,
          payment_date: payment_date || new Date().toISOString().slice(0,10),
          recorded_by: caller.id, note: 'پرداخت اولیه هنگام ثبت ورزشکار'
        })
        if (payError) throw payError
      }
      return new Response(JSON.stringify({ student }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const id = Number(body.student_id)
      const { data: student, error: findError } = await admin.from('students').select('user_id').eq('id', id).single()
      if (findError) throw findError
      const { error: deleteStudentError } = await admin.from('students').delete().eq('id', id)
      if (deleteStudentError) throw deleteStudentError
      if (student?.user_id) {
        const { error: deleteAuthError } = await admin.auth.admin.deleteUser(student.user_id)
        if (deleteAuthError) throw deleteAuthError
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    throw new Error('عملیات نامعتبر است.')
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
