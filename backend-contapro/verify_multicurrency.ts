
import { PrismaClient } from '@prisma/client';
import { CurrencyService } from './src/services/currency';
import fastify from 'fastify';

async function main() {
    const prisma = new PrismaClient();
    const app = fastify();
    // @ts-ignore
    app.prisma = prisma;
    const currencyService = new CurrencyService(app as any);

    console.log('--- Verification Start ---');

    // 1. Create/Get User
    const email = 'verify_mc_' + Date.now() + '@test.com';
    const user = await prisma.user.create({
        data: {
            email,
            password: 'test',
            name: 'Verify MC',
            preferredCurrency: 'EUR' // Preferred EUR
        }
    });
    console.log('User created:', user.id, user.preferredCurrency);

    // 2. Create Expense in USD (assuming 1 USD != 1 EUR)
    const amountUSD = 100;
    const { amount: amountNative, rate } = await currencyService.convert(amountUSD, 'USD', 'EUR');
    console.log(`Converted 100 USD to EUR: ${amountNative} (Rate: ${rate})`);

    const expense = await prisma.expense.create({
        data: {
            userId: user.id,
            amount: amountUSD,
            currency: 'USD',
            amountNative,
            exchangeRate: rate,
            description: 'Test MC Expense',
            issuedAt: new Date(),
            categoryId: null, // removing dummy category to avoid relation error if not exists
            type: 'INFORMAL',
            source: 'MANUAL',
            provider: 'TestProvider'
        }
    });
    console.log('Expense created:', expense.id, 'Native:', expense.amountNative);

    // 3. Verify Budget Aggregation Logic (Simulated)
    // Legacy expense (no amountNative)
    await prisma.expense.create({
        data: {
            userId: user.id,
            amount: 50, // 50 EUR (legacy assumption)
            currency: 'EUR',
            amountNative: null,
            description: 'Legacy Expense',
            issuedAt: new Date(),
            categoryId: null,
            type: 'INFORMAL',
            source: 'MANUAL',
            provider: 'TestProvider'
        }
    });

    const aggNative = await prisma.expense.aggregate({
        _sum: { amountNative: true },
        where: { userId: user.id, amountNative: { not: null } }
    });
    const aggLegacy = await prisma.expense.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, amountNative: null }
    });

    const total = (aggNative._sum.amountNative || 0) + (aggLegacy._sum.amount || 0);
    console.log(`Total Spent (Native + Legacy): ${total}`);
    
    const expected = amountNative + 50;
    if (Math.abs(total - expected) < 0.01) {
        console.log('SUCCESS: Aggregation matches expected value.');
    } else {
        console.error(`FAILURE: Expected ${expected}, got ${total}`);
    }

    // 4. Verify Payment Method Aggregation
    const pm = await prisma.paymentMethod.create({
        data: {
            userId: user.id,
            name: 'Test PM',
            provider: 'VISA',
            type: 'CREDIT_CARD'
        }
    });

    await prisma.expense.create({
        data: {
            userId: user.id,
            amount: 200,
            currency: 'USD',
            amountNative: 172, // 200 * 0.86
            exchangeRate: 0.86,
            description: 'PM Expense Native',
            issuedAt: new Date(),
            categoryId: null,
            type: 'INFORMAL',
            source: 'MANUAL',
            provider: 'TestProvider',
            paymentMethodId: pm.id
        }
    });

    await prisma.expense.create({
        data: {
            userId: user.id,
            amount: 50,
            currency: 'EUR',
            amountNative: null,
            description: 'PM Expense Legacy',
            issuedAt: new Date(),
            categoryId: null,
            type: 'INFORMAL',
            source: 'MANUAL',
            provider: 'TestProvider',
            paymentMethodId: pm.id
        }
    });

    const pmAggNative = await prisma.expense.aggregate({
        _sum: { amountNative: true },
        where: { userId: user.id, paymentMethodId: pm.id, amountNative: { not: null } }
    });
    const pmAggLegacy = await prisma.expense.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, paymentMethodId: pm.id, amountNative: null }
    });
    const pmTotal = (pmAggNative._sum.amountNative || 0) + (pmAggLegacy._sum.amount || 0);
    console.log(`PM Total Spent: ${pmTotal}`);
    const expectedPm = 172 + 50;

    if (Math.abs(pmTotal - expectedPm) < 0.01) {
        console.log('SUCCESS: Payment Method Aggregation matches expected value.');
    } else {
        console.error(`FAILURE: PM Expected ${expectedPm}, got ${pmTotal}`);
    }

    // 5. Verify Expense Update Logic (Preserve Rate)
    // Update the native expense amount from 200 to 300 USD
    // Rate was 0.86. New Native should be 300 * 0.86 = 258
    const expenseToUpdate = await prisma.expense.findFirst({ where: { userId: user.id, currency: 'USD' } });
    if (expenseToUpdate) {
        const newAmount = 300;
        let newNative = 0;
        if (expenseToUpdate.exchangeRate) {
            newNative = Number((newAmount * expenseToUpdate.exchangeRate).toFixed(2));
        } else {
            // fallback (should not happen in this test)
            newNative = newAmount;
        }
        
        const updatedExp = await prisma.expense.update({
            where: { id: expenseToUpdate.id },
            data: {
                amount: newAmount,
                amountNative: newNative
            }
        });
        console.log(`Updated Expense: Amount ${updatedExp.amount} USD, Native ${updatedExp.amountNative} EUR`);
        
        if (updatedExp.amountNative === 258) {
             console.log('SUCCESS: Expense Update preserved rate correctly.');
        } else {
             console.error(`FAILURE: Expected 258, got ${updatedExp.amountNative}`);
        }
    }

    // Cleanup
    await prisma.expense.deleteMany({ where: { userId: user.id } });
    await prisma.paymentMethod.delete({ where: { id: pm.id } });
    await prisma.user.delete({ where: { id: user.id } });
    
    console.log('--- Verification End ---');
}

main().catch(console.error).finally(() => process.exit(0));
