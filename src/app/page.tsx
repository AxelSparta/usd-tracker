import DolarPrice from '@/components/DolarPrice'
import TransactionList from '@/components/TransactionList'

export default async function Home() {
  return (
    <main className='flex-1 py-10'>
      <DolarPrice />
      <TransactionList />
    </main>
  )
}
