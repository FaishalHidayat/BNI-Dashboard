import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDailyBniData } from "../../../dailybni/data";
 
function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
}
 
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? undefined;
  const data = await getDailyBniData(date);
 
  const workbook = new ExcelJS.Workbook();
 
  // Sheet 1: Ringkasan SPV
  const spvSheet = workbook.addWorksheet("Ringkasan SPV");
  spvSheet.columns = [
    { header: "Level", key: "level", width: 12 },
    { header: "SPV Name", key: "spvName", width: 24 },
    { header: "User ID", key: "userId", width: 12 },
    { header: "Jumlah Agent", key: "agentCount", width: 12 },
    { header: "Card", key: "card", width: 10 },
    { header: "Enrol", key: "enrol", width: 10 },
    { header: "Amount", key: "amount", width: 18 },
    { header: "HK ASOF", key: "hkAsof", width: 10 },
    { header: "Average/Day", key: "avgPerDay", width: 16 },
    { header: "SOL", key: "sol", width: 10 },
    { header: "Call Duration", key: "duration", width: 14 },
    { header: "Attempt", key: "attempt", width: 10 },
    { header: "Bunga 0%", key: "bunga0Pct", width: 10 },
    { header: "Bunga Regular", key: "bungaRegPct", width: 14 },
    { header: "Target", key: "target", width: 16 },
    { header: "Gap", key: "gap", width: 16 },
  ];
  styleHeader(spvSheet.getRow(1));
  data.rows.forEach((r) => {
    spvSheet.addRow({
      level: (r.level ?? "").toUpperCase(),
      spvName: r.spvName,
      userId: r.userId,
      agentCount: r.agentCount,
      card: r.card,
      enrol: r.enrol,
      amount: r.amount,
      hkAsof: r.hkAsof,
      avgPerDay: Math.round(r.avgPerDay),
      sol: Number(r.sol.toFixed(2)),
      duration: r.duration,
      attempt: Number(r.attempt.toFixed(2)),
      bunga0Pct: `${(r.bunga0Pct * 100).toFixed(1)}%`,
      bungaRegPct: `${(r.bungaRegPct * 100).toFixed(1)}%`,
      target: r.target,
      gap: r.gap,
    });
  });
  const spvTotalRow = spvSheet.addRow({
    spvName: "TOTAL",
    card: data.totalCard,
    enrol: data.totalEnrol,
    amount: data.totalAmount,
    target: data.totalTarget,
    gap: data.totalGap,
  });
  spvTotalRow.font = { bold: true };
  spvTotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  spvSheet.getColumn("amount").numFmt = '"Rp" #,##0';
  spvSheet.getColumn("target").numFmt = '"Rp" #,##0';
  spvSheet.getColumn("gap").numFmt = '"Rp" #,##0';
  spvSheet.getColumn("avgPerDay").numFmt = '"Rp" #,##0';
 
  // Sheet 2 & 3: Team tables
  const teamSheets = [
    { name: "Infinite Team", list: data.infiniteTeamRows },
    { name: "Platinum Team", list: data.platinumTeamRows },
  ];
  for (const team of teamSheets) {
    const sheet = workbook.addWorksheet(team.name);
    sheet.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "SPV Name", key: "spvName", width: 24 },
      { header: "User ID", key: "userId", width: 12 },
      { header: "Name", key: "name", width: 24 },
      { header: "Card", key: "card", width: 10 },
      { header: "Enrol", key: "enrol", width: 10 },
      { header: "Amount", key: "amount", width: 18 },
      { header: "HK ASOF", key: "hkAsof", width: 10 },
      { header: "Average/Day", key: "avgPerDay", width: 16 },
      { header: "SOL", key: "sol", width: 10 },
      { header: "Call Duration", key: "duration", width: 14 },
      { header: "Attempt", key: "attempt", width: 10 },
      { header: "Bunga 0%", key: "bunga0Pct", width: 10 },
      { header: "Bunga Regular", key: "bungaRegPct", width: 14 },
      { header: "Gap", key: "gap", width: 16 },
    ];
    styleHeader(sheet.getRow(1));
    team.list.forEach((r, idx) => {
      sheet.addRow({
        no: idx + 1,
        spvName: r.spvName,
        userId: r.userId,
        name: r.name,
        card: r.card,
        enrol: r.enrol,
        amount: r.amount,
        hkAsof: r.hkAsof,
        avgPerDay: Math.round(r.avgPerDay),
        sol: Number(r.sol.toFixed(2)),
        duration: r.duration,
        attempt: Number(r.attempt.toFixed(2)),
        bunga0Pct: `${(r.bunga0Pct * 100).toFixed(1)}%`,
        bungaRegPct: `${(r.bungaRegPct * 100).toFixed(1)}%`,
        gap: r.gap,
      });
    });
    sheet.getColumn("amount").numFmt = '"Rp" #,##0';
    sheet.getColumn("gap").numFmt = '"Rp" #,##0';
    sheet.getColumn("avgPerDay").numFmt = '"Rp" #,##0';
  }
 
  const buffer = await workbook.xlsx.writeBuffer();
 
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Daily_BNI_${data.selectedDate}.xlsx"`,
    },
  });
}