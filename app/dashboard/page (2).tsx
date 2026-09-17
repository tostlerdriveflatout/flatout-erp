import Dashboard from '@/components/Dashboard';import {serverSupabase} from '@/lib/supabase-server';import {redirect} from 'next/navigation';
export default async function Page(){const s=await serverSupabase();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');return <Dashboard email={user.email||''}/>}
