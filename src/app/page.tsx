import NewTransactionForm from './components/NewTransactionForm'
import DolarPrice from './components/DolarPrice'
import TransactionList from './components/TransactionList'

export default function Home () {
  return (
    <div className='flex-1'>
      <DolarPrice />
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-2 py-4'>
        <NewTransactionForm />
        <TransactionList />
      </div>
    </div>
  )
}
