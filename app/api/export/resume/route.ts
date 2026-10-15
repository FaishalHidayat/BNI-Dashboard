import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getResumeData, monthLabel } from "../../../resume/data";
 
export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month") ?? undefined;
  const data = await getResumeData(month);
 
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Resume Agent");
 
  sheet.columns = [
    { header: "Level", key: "level", width: 12 },
    { header: "SPV Name", key: "spvName", width: 24 },
    { header: "User ID", key: "userId", width: 12 },
    { header: "Name", key: "name", width: 24 },
    { header: "Card", key: "card", width: 10 },
    { header: "Freq", key: "freq", width: 10 },
    { header: "Sales Volume", key: "sales", width: 18 },
    { header: "Working Days", key: "workingDays", width: 14 },
    { header: "SOL", key: "sol", width: 10 },
    { header: "Duration", key: "duration", width: 14 },
    { header: "Attempt Ratio", key: "attemptRatio", width: 14 },
    { header: "Bunga 0%", key: "bunga0Pct", width: 12 },
    { header: "Bunga Regular", key: "bungaRegPct", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
 
  data.rows.forEach((r) => {
    sheet.addRow({
      level: r.level,
      spvName: r.spvName,
      userId: r.userId,
      name: r.name,
      card: r.card,
      freq: r.freq,
      sales: r.sales,
      workingDays: r.workingDays,
      sol: Number(r.sol.toFixed(2)),
      duration: r.duration,
      attemptRatio: Number(r.attemptRatio.toFixed(2)),
      bunga0Pct: `${(r.bunga0Pct * 100).toFixed(1)}%`,
      bungaRegPct: `${(r.bungaRegPct * 100).toFixed(1)}%`,
    });
  });
 
  const totalRow = sheet.addRow({
    level: "",
    spvName: "",
    userId: "",
    name: "TOTAL KESELURUHAN",
    card: data.grandCard,
    freq: data.grandFreq,
    sales: data.grandSales,
    workingDays: "",
    sol: Number(data.grandSol.toFixed(2)),
    duration: data.grandDuration,
    attemptRatio: Number(data.grandAttemptRatio.toFixed(2)),
    bunga0Pct: "",
    bungaRegPct: "",
  });
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
 
  sheet.getColumn("sales").numFmt = '"Rp" #,##0';
 
  const buffer = await workbook.xlsx.writeBuffer();
 
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Resume_Agent_${data.month}.xlsx"`,
    },
  });
}