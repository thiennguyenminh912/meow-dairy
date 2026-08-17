import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Diary } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !key) {
  // Vite nhúng biến môi trường LÚC BUILD. Thiếu nó thì nhánh createClient bị loại
  // khỏi bundle luôn, nút đăng nhập sẽ không hiện — thường là quên khai env trên
  // Vercel, hoặc khai rồi nhưng chưa Redeploy.
  console.warn(
    '[Meow Diary] Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY lúc build → ' +
      'chạy ở chế độ chỉ lưu trên máy này, không có đăng nhập và đồng bộ.',
  )
}

/** null khi chưa cấu hình env — app vẫn chạy bình thường ở chế độ chỉ lưu máy này */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

export type { User }

const TABLE = 'diaries'

export interface RemoteDiary {
  data: Diary
  updatedAt: number
}

export async function fetchRemoteDiary(userId: string): Promise<RemoteDiary | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { data: data.data as Diary, updatedAt: new Date(data.updated_at).getTime() }
}

export async function pushRemoteDiary(userId: string, diary: Diary) {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      data: diary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Chưa cấu hình Supabase')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
}
