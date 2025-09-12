import prisma from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET () {
  try {
    const { userId } = await auth()
    console.log('GET TRANSACTIONS: userId:', userId)

    if (!userId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'asc' }
    })

    return NextResponse.json(transactions)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error fetching transactions' },
      { status: 500 }
    )
  }
}

export async function POST (req: Request) {
  try {
    const { userId } = await auth()
    if (!userId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()

    const newTransaction = await prisma.transaction.create({
      data: {
        userId,
        pesosAmount: body.pesosAmount,
        date: body.date,
        dollarsAmount: body.dollarsAmount,
        type: body.type,
        usdPrice: body.usdPerPesos
      }
    })

    return NextResponse.json(newTransaction, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error creating transaction' },
      { status: 500 }
    )
  }
}
