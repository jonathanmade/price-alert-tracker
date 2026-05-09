import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'

export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null)

  const fetchCredits = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()
    setCredits(data?.credits ?? 0)
  }

  useEffect(() => {
    fetchCredits()
    window.addEventListener('focus', fetchCredits)
    window.addEventListener('credits-updated', fetchCredits)
    return () => {
      window.removeEventListener('focus', fetchCredits)
      window.removeEventListener('credits-updated', fetchCredits)
    }
  }, [])

  return { credits, refetch: fetchCredits }
}
