import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 既存データの削除 (必要に応じて)
  await prisma.quoteItem.deleteMany()
  await prisma.quote.deleteMany()
  await prisma.product.deleteMany()

  // サンプル商品の作成
  const products = [
    {
      code: 'P-001',
      name: '高性能ノートPC',
      manufacturer: 'TechCorp',
      price: 150000,
      stock: 10,
      unit: '台',
      note: '最新モデル'
    },
    {
      code: 'P-002',
      name: 'ワイヤレスマウス',
      manufacturer: 'TechCorp',
      price: 5000,
      stock: 50,
      unit: '個',
      note: '静音タイプ'
    },
    {
      code: 'M-001',
      name: '27インチモニター',
      manufacturer: 'DisplayInc',
      price: 40000,
      stock: 20,
      unit: '台',
      note: '4K対応'
    },
    {
      code: 'C-001',
      name: 'USB-Cケーブル 1m',
      manufacturer: 'CableWorks',
      price: 1500,
      stock: 100,
      unit: '本',
      note: '100W PD対応'
    }
  ]

  for (const p of products) {
    await prisma.product.create({
      data: p
    })
  }

  console.log('Seed data inserted successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
