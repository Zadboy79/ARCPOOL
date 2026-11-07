import type { PoolData } from '@/hooks/usePoolData'

export interface PageProps {
  data: PoolData
  isLoading: boolean
  refetch: () => void
}
