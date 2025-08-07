import DolarPrice from "@/components/DolarPrice"

export default async function Home () {
  console.log('index page')
  return (
    <div className='flex-1'>
      <DolarPrice />
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-2 py-4'>
        {/* <NewTransactionForm /> */}
        {/* <TransactionList /> */}
      </div>
    </div>
  )
}
