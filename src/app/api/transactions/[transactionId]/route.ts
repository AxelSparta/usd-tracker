import prisma from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

interface Params {
  params: { transactionId: string }
}
export async function DELETE (req: Request, { params }: Params) {
  try {
    const { userId } = await auth()

    if (!userId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { transactionId } = params
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    })
    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }
    if (transaction.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await prisma.transaction.delete({ where: { id: transactionId } })
    return NextResponse.json(
      { message: 'Transaction deleted' },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Error deleting transaction'
      },
      { status: 500 }
    )
  }
}
