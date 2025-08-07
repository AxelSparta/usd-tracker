'use client'

import { DolarData, DolarOption } from '@/types/dolar.types'
import { createContext, useContext, useEffect, useState } from 'react'
import { getDolar } from '../services/dolarApi'

export type Transaction = {
  pesos: number
  usd: number
  usdPerPesos: number
}

export type TransactionsData = {
  totalPesos: number
  totalUsd: number
  gananciaPerdida: number
}

type TransactionsContextType = {
  transactions: Transaction[]
  addTransaction: (tx: Transaction) => void
  removeTransaction: (index: number) => void
  transactionsData: TransactionsData
  dolarData: DolarData | null
  changeDolarOption: (option: DolarOption) => void
  dolarOption: DolarOption
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(
  undefined
)

export const TransactionsProvider = ({
  children
}: {
  children: React.ReactNode
}) => {
  const [dolarData, setDolarData] = useState<DolarData>({
    casa: '',
    moneda: '',
    nombre: '',
    fechaActualizacion: '',
    compra: 0,
    venta: 0
  })
  const [dolarOption, setDolarOption] = useState<DolarOption>('cripto')

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsData, setTransactionsData] = useState<TransactionsData>({
    totalPesos: 0,
    totalUsd: 0,
    gananciaPerdida: 0
  })

  useEffect(() => {
    const fetchDolarPrice = async () => {
      const storedDolarOption = localStorage.getItem('dolarOption')
      if (storedDolarOption) {
        setDolarOption(storedDolarOption as DolarOption)
      }
      const dolarData = await getDolar(dolarOption ?? 'cripto')
      setDolarData(dolarData)
      const storedTransactions = localStorage.getItem('transactions')
      if (storedTransactions) {
        setTransactions(JSON.parse(storedTransactions))
        updateTransactionsData(JSON.parse(storedTransactions), dolarData.venta)
      }
    }
    fetchDolarPrice()
  }, [dolarOption])

  const changeDolarOption = (option: DolarOption) => {
    setDolarOption(option)
    localStorage.setItem('dolarOption', option)
  }

  const updateTransactionsData = (tx: Transaction[], dolarPrice?: number) => {
    const newTransactionData: TransactionsData = {
      totalPesos: 0,
      totalUsd: 0,
      gananciaPerdida: 0
    }
    tx.forEach(tx => {
      newTransactionData.totalPesos += tx.pesos
      newTransactionData.totalUsd += tx.usd
    })
    if (dolarPrice) {
      newTransactionData.gananciaPerdida =
        newTransactionData.totalUsd * dolarPrice - newTransactionData.totalPesos
    } else {
      newTransactionData.gananciaPerdida =
        newTransactionData.totalUsd * dolarData.venta -
        newTransactionData.totalPesos
    }
    setTransactionsData(newTransactionData)
  }

  const addTransaction = (tx: Transaction) => {
    const newTxs = [...transactions, tx]
    setTransactions(newTxs)
    localStorage.setItem('transactions', JSON.stringify(newTxs))
    updateTransactionsData(newTxs)
  }

  const removeTransaction = (index: number) => {
    const newTxs = [...transactions]
    newTxs.splice(index, 1)
    setTransactions(newTxs)
    localStorage.setItem('transactions', JSON.stringify(newTxs))
    updateTransactionsData(newTxs)
  }

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        addTransaction,
        removeTransaction,
        transactionsData,
        dolarData,
        changeDolarOption,
        dolarOption
      }}
    >
      {children}
    </TransactionsContext.Provider>
  )
}

export const useTransactions = () => {
  const context = useContext(TransactionsContext)
  if (!context)
    throw new Error(
      'useTransactions must be used within a TransactionsProvider'
    )
  return context
}
