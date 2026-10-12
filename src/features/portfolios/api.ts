import type { CedearState } from '@/features/cedears/types'
import type { CryptoPortfolioState } from '@/features/crypto/operations'
import type { PesosState } from '@/features/pesos/types'
import { requestJson } from '@/lib/http'
import { PORTFOLIO_HEADER } from '@/lib/portfolio-scope'
import type { Transaction } from '@/types/transaction.types'
import type { PortfolioData } from './data-stores'
import type { Portfolio } from './types'

const BASE = '/api/portfolios'

export const portfoliosApi = {
  list: () => requestJson<Portfolio[]>(BASE),
  create: (portfolio: Portfolio) =>
    requestJson<Portfolio>(BASE, { method: 'POST', body: portfolio }),
  rename: (id: string, name: string) =>
    requestJson<Portfolio>(`${BASE}/${id}`, { method: 'PATCH', body: { name } }),
  remove: (id: string) => requestJson<void>(`${BASE}/${id}`, { method: 'DELETE' }),
}

/** Los datos de un portafolio de la nube que no es el activo (para la vista "Todos") */
export const fetchCloudPortfolio = async (portfolioId: string): Promise<PortfolioData> => {
  const init = { headers: { [PORTFOLIO_HEADER]: portfolioId } }
  const [dolar, crypto, pesos, cedears] = await Promise.all([
    requestJson<Transaction[]>('/api/dolar/transactions', init),
    requestJson<CryptoPortfolioState>('/api/crypto/transactions', init),
    requestJson<PesosState>('/api/pesos/movements', init),
    requestJson<CedearState>('/api/cedears/transactions', init),
  ])
  return { dolar, crypto, pesos: pesos.movements, cedears: cedears.transactions }
}
