import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { Expense, Income, Category, PaymentMethod, Budget, User, SavingsGoal } from '@prisma/client';
import { formatDMY } from '../utils/format.js';

interface ExportData {
  user: User;
  month: number;
  year: number;
  expenses: (Expense & { category: Category | null; paymentMethod: PaymentMethod | null })[];
  incomes: (Income & { paymentMethod: PaymentMethod | null })[];
  budget: Budget | null;
  categoryBudgets: (Budget & { category: Category | null })[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  savingsGoals: SavingsGoal[];
}

export class ExcelService {
  static async generateMonthlyReport(data: ExportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ContaPRO';
    workbook.lastModifiedBy = 'ContaPRO';
    workbook.created = new Date();
    workbook.modified = new Date();

    const monthName = new Date(data.year, data.month - 1).toLocaleString('es-ES', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    // --- Hoja 1: Resumen Ejecutivo ---
    const summarySheet = workbook.addWorksheet('Resumen Ejecutivo', {
      views: [{ showGridLines: false }]
    });

    // Logo
    // Try to find the logo relative to the backend execution directory
    // Assuming backend is in backend-contapro/ and frontend in front-contapro/
    const logoPath = path.resolve(process.cwd(), '../front-contapro/public/logo.png');
    
    if (fs.existsSync(logoPath)) {
      const logoId = workbook.addImage({
        filename: logoPath,
        extension: 'png',
      });
      summarySheet.addImage(logoId, {
        tl: { col: 0, row: 0 },
        ext: { width: 150, height: 50 }, // Adjust size as needed
        editAs: 'oneCell'
      });
    } else {
        summarySheet.mergeCells('A1:C2');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = 'ContaPRO';
        titleCell.font = { size: 20, bold: true, color: { argb: 'FF2563EB' } }; // Blue-600
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // Title & User Info
    summarySheet.mergeCells('D1:H1');
    const headerCell = summarySheet.getCell('D1');
    headerCell.value = `Reporte Mensual: ${capitalizedMonth} ${data.year}`;
    headerCell.font = { size: 16, bold: true };
    headerCell.alignment = { vertical: 'middle', horizontal: 'right' };

    summarySheet.mergeCells('D2:H2');
    const userCell = summarySheet.getCell('D2');
    userCell.value = `Generado para: ${data.user.email} | Fecha: ${formatDMY(new Date())}`;
    userCell.font = { size: 10, italic: true, color: { argb: 'FF666666' } };
    userCell.alignment = { vertical: 'middle', horizontal: 'right' };

    // Summary Cards (Calculations)
    const totalIncome = data.incomes.reduce((sum, i) => sum + (i.amountNative ?? i.amount), 0);
    const totalSpent = data.expenses.reduce((sum, e) => sum + (e.amountNative ?? e.amount), 0);
    const totalBudget = data.budget ? data.budget.amount : 0;
    const remaining = totalBudget > 0 ? totalBudget - totalSpent : 0;
    const balance = totalIncome - totalSpent;

    // Styles
    const cardTitleStyle = { font: { bold: true, size: 12 }, alignment: { horizontal: 'center' as const } };
    const cardValueStyle = { font: { size: 14 }, alignment: { horizontal: 'center' as const } };

    // Card 1: Ingreso Total
    summarySheet.mergeCells('B5:C5');
    summarySheet.getCell('B5').value = 'Ingreso Total';
    summarySheet.getCell('B5').style = cardTitleStyle;
    summarySheet.mergeCells('B6:C6');
    summarySheet.getCell('B6').value = totalIncome;
    summarySheet.getCell('B6').numFmt = '"S/" #,##0.00';
    summarySheet.getCell('B6').font = { color: { argb: 'FF16A34A' }, size: 14 }; // Green
    summarySheet.getCell('B6').alignment = { horizontal: 'center' };

    // Card 2: Gasto Total
    summarySheet.mergeCells('E5:F5');
    summarySheet.getCell('E5').value = 'Gasto Total';
    summarySheet.getCell('E5').style = cardTitleStyle;
    summarySheet.mergeCells('E6:F6');
    summarySheet.getCell('E6').value = totalSpent;
    summarySheet.getCell('E6').numFmt = '"S/" #,##0.00';
    summarySheet.getCell('E6').font = { color: { argb: 'FFDC2626' }, size: 14 }; // Red
    summarySheet.getCell('E6').alignment = { horizontal: 'center' };
    
    // Card 3: Presupuesto
    summarySheet.mergeCells('H5:I5');
    summarySheet.getCell('H5').value = 'Presupuesto';
    summarySheet.getCell('H5').style = cardTitleStyle;
    summarySheet.mergeCells('H6:I6');
    summarySheet.getCell('H6').value = totalBudget;
    summarySheet.getCell('H6').numFmt = '"S/" #,##0.00';
    summarySheet.getCell('H6').style = cardValueStyle;

    // Card 4: Disponible (Presupuesto)
    summarySheet.mergeCells('K5:L5');
    summarySheet.getCell('K5').value = 'Disponible';
    summarySheet.getCell('K5').style = cardTitleStyle;
    summarySheet.mergeCells('K6:L6');
    summarySheet.getCell('K6').value = remaining;
    summarySheet.getCell('K6').numFmt = '"S/" #,##0.00';
    summarySheet.getCell('K6').font = { color: { argb: remaining >= 0 ? 'FF16A34A' : 'FFDC2626' }, size: 14 };
    summarySheet.getCell('K6').alignment = { horizontal: 'center' };

    // Card 5: Balance Mensual
    summarySheet.mergeCells('N5:O5');
    summarySheet.getCell('N5').value = 'Balance Mensual';
    summarySheet.getCell('N5').style = cardTitleStyle;
    summarySheet.mergeCells('N6:O6');
    summarySheet.getCell('N6').value = balance;
    summarySheet.getCell('N6').numFmt = '"S/" #,##0.00';
    summarySheet.getCell('N6').font = { color: { argb: balance >= 0 ? 'FF16A34A' : 'FFDC2626' }, size: 14 };
    summarySheet.getCell('N6').alignment = { horizontal: 'center' };

    // Apply borders to cards
    ['B5', 'B6', 'E5', 'E6', 'H5', 'H6', 'K5', 'K6', 'N5', 'N6'].forEach(cellRef => {
        // Simple boxing logic would be better but keeping it simple for now
    });

    // --- Hoja 2: Detalle de Transacciones ---
    const expenseSheet = workbook.addWorksheet('Detalle de Transacciones');
    
    expenseSheet.columns = [
        { header: 'Fecha', key: 'date', width: 12 },
        { header: 'Tipo', key: 'txType', width: 15 },
        { header: 'Proveedor/Origen', key: 'provider', width: 20 },
        { header: 'Descripción', key: 'description', width: 30 },
        { header: 'Categoría', key: 'category', width: 15 },
        { header: 'Método de Pago', key: 'method', width: 15 },
        { header: 'Monto Original', key: 'amount', width: 15 },
        { header: 'Moneda Orig.', key: 'currency', width: 15 },
        { header: 'Monto Local', key: 'amountNative', width: 15 },
        { header: 'Subtipo', key: 'type', width: 10 },
    ];

    // Header Style
    const headerRow = expenseSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' } // Blue-600
    };
    headerRow.alignment = { horizontal: 'center' };

    // Combine and sort transactions
    const allTransactions = [
        ...data.expenses.map(e => ({ ...e, txType: 'GASTO' })),
        ...data.incomes.map(i => ({ ...i, txType: 'INGRESO', type: 'INGRESO', provider: i.description || 'Ingreso' }))
    ].sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

    // Add Data
    allTransactions.forEach(tx => {
        const isExpense = tx.txType === 'GASTO';
        const row = expenseSheet.addRow({
            date: new Date(tx.issuedAt),
            txType: tx.txType,
            provider: isExpense ? (tx as Expense).provider : '-',
            description: tx.description || '-',
            category: isExpense ? ((tx as any).category?.name || 'Sin Categoría') : ((tx as any).category || 'Ingreso'),
            method: (tx as any).paymentMethod?.name || '-',
            amount: tx.amount,
            currency: tx.currency,
            amountNative: tx.amountNative ?? tx.amount,
            type: tx.type
        });
        
        // Conditional formatting for amount
        const amountCell = row.getCell('amount');
        amountCell.numFmt = '#,##0.00';
        amountCell.font = { color: { argb: isExpense ? 'FFDC2626' : 'FF16A34A' } }; // Red for expenses, Green for incomes

        const amountNativeCell = row.getCell('amountNative');
        amountNativeCell.numFmt = '#,##0.00';
        amountNativeCell.font = { color: { argb: isExpense ? 'FFDC2626' : 'FF16A34A' } };
    });

    // Auto-filter
    expenseSheet.autoFilter = {
        from: 'A1',
        to: {
            row: 1,
            column: expenseSheet.columns.length
        }
    };

    // --- Hoja 3: Presupuestos ---
    const budgetSheet = workbook.addWorksheet('Presupuestos');
    
    // Section 1: Presupuestos por Categoría
    budgetSheet.getCell('A1').value = 'Presupuesto por Categoría';
    budgetSheet.getCell('A1').font = { bold: true, size: 14 };

    budgetSheet.getRow(2).values = ['Categoría', 'Presupuestado', 'Gastado', 'Restante', '% Uso'];
    const catHeader = budgetSheet.getRow(2);
    catHeader.font = { bold: true };
    catHeader.eachCell(cell => {
        cell.border = { bottom: { style: 'thin' } };
    });

    let currentRow = 3;
    data.categoryBudgets.forEach(cb => {
        // Calculate spent for this category
        const spent = data.expenses
            .filter(e => e.categoryId === cb.categoryId)
            .reduce((sum, e) => sum + (e.amountNative ?? e.amount), 0);
        
        const remaining = cb.amount - spent;
        const percent = cb.amount > 0 ? spent / cb.amount : 0;

        const row = budgetSheet.getRow(currentRow);
        row.values = [
            cb.category?.name || 'Desconocido',
            cb.amount,
            spent,
            remaining,
            percent
        ];

        row.getCell(2).numFmt = '"S/" #,##0.00';
        row.getCell(3).numFmt = '"S/" #,##0.00';
        row.getCell(4).numFmt = '"S/" #,##0.00';
        row.getCell(5).numFmt = '0%';
        
        // Color scale for % usage
        if (percent > 1) row.getCell(5).font = { color: { argb: 'FFDC2626' }, bold: true }; // Red if over budget
        
        currentRow++;
    });

    budgetSheet.getColumn(1).width = 25;
    budgetSheet.getColumn(2).width = 15;
    budgetSheet.getColumn(3).width = 15;
    budgetSheet.getColumn(4).width = 15;
    budgetSheet.getColumn(5).width = 10;

    // --- Hoja 4: Metas de Ahorro ---
    const savingsSheet = workbook.addWorksheet('Metas de Ahorro');
    
    savingsSheet.getCell('A1').value = 'Metas de Ahorro';
    savingsSheet.getCell('A1').font = { bold: true, size: 14 };

    savingsSheet.getRow(2).values = ['Nombre', 'Estado', 'Moneda', 'Monto Actual', 'Monto Objetivo', 'Progreso', 'Fecha Límite'];
    const savingsHeader = savingsSheet.getRow(2);
    savingsHeader.font = { bold: true };
    savingsHeader.eachCell(cell => {
        cell.border = { bottom: { style: 'thin' } };
    });

    let savingsRow = 3;
    data.savingsGoals.forEach(sg => {
        const percent = sg.targetAmount > 0 ? sg.currentAmount / sg.targetAmount : 0;
        
        const row = savingsSheet.getRow(savingsRow);
        row.values = [
            sg.name,
            sg.status === 'ACTIVE' ? 'Activo' : 'Completado',
            sg.currency,
            sg.currentAmount,
            sg.targetAmount,
            percent,
            sg.deadline ? formatDMY(new Date(sg.deadline)) : '-'
        ];

        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '0%';
        
        if (percent >= 1) row.getCell(6).font = { color: { argb: 'FF16A34A' }, bold: true }; // Green if completed
        
        savingsRow++;
    });

    savingsSheet.getColumn(1).width = 25;
    savingsSheet.getColumn(2).width = 15;
    savingsSheet.getColumn(3).width = 10;
    savingsSheet.getColumn(4).width = 15;
    savingsSheet.getColumn(5).width = 15;
    savingsSheet.getColumn(6).width = 10;
    savingsSheet.getColumn(7).width = 15;

    // --- Hoja 5: Saldos de Cuentas ---
    const accountsSheet = workbook.addWorksheet('Saldos de Cuentas');
    
    accountsSheet.getCell('A1').value = 'Saldos de Cuentas / Métodos de Pago';
    accountsSheet.getCell('A1').font = { bold: true, size: 14 };

    accountsSheet.getRow(2).values = ['Nombre', 'Tipo', 'Moneda', 'Saldo Actual', 'Estado'];
    const accountsHeader = accountsSheet.getRow(2);
    accountsHeader.font = { bold: true };
    accountsHeader.eachCell(cell => {
        cell.border = { bottom: { style: 'thin' } };
    });

    let accountsRow = 3;
    data.paymentMethods.forEach(pm => {
        const row = accountsSheet.getRow(accountsRow);
        row.values = [
            pm.name,
            pm.type,
            pm.currency,
            pm.balance,
            pm.active ? 'Activo' : 'Inactivo'
        ];

        row.getCell(4).numFmt = '#,##0.00';
        if (pm.balance < 0) {
            row.getCell(4).font = { color: { argb: 'FFDC2626' } }; // Red if negative
        }
        
        accountsRow++;
    });

    accountsSheet.getColumn(1).width = 25;
    accountsSheet.getColumn(2).width = 15;
    accountsSheet.getColumn(3).width = 10;
    accountsSheet.getColumn(4).width = 15;
    accountsSheet.getColumn(5).width = 15;

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
