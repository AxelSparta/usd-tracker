import TransactionList from '@/components/TransactionList'

export default async function Home() {
  return (
    <main className='flex-1'>
      <TransactionList />
    </main>
  )
}
