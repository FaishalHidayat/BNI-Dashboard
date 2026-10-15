"use server";
 
import { prisma } from "../../lib/prisma";
import Papa from "papaparse";
import { redirect } from "next/navigation";
 
type CsvRow = Record<string, string>;
 
export async function uploadCsv(formData: FormData) {
  const type = formData.get("type") as string;
  const file = formData.get("csvfile") as File;
 
  if (!file || file.size === 0) {
    redirect(`/upload?status=error&message=${encodeURIComponent("File tidak ditemukan, coba pilih file lagi.")}`);
  }
 
  const rawText = await file.text();
  const text = rawText.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });
 
  if (!parsed.data || parsed.data.length === 0) {
    redirect(`/upload?status=error&message=${encodeURIComponent("File CSV kosong atau formatnya tidak terbaca.")}`);
  }
 
  let success = 0;
  let failed = 0;
  const failedItems: string[] = [];
 
  for (const row of parsed.data) {
    let identifier = "?";
    try {
      if (type === "ag") {
        identifier = `${row.user_id} / ${row.report_date}`;
        await prisma.ag_daily.upsert({
          where: {
            report_type_report_date_user_id: {
              report_type: row.report_type,
              report_date: new Date(row.report_date),
              user_id: row.user_id,
            },
          },
          update: {
            user_name: row.user_name,
            card_count: Number(row.card_count) || 0,
            freq: Number(row.freq) || 0,
            bunga_0: Number(row.bunga_0) || 0,
            bunga_regular: Number(row.bunga_regular) || 0,
            sales_volume: Number(row.sales_volume) || 0,
          },
          create: {
            report_type: row.report_type,
            report_date: new Date(row.report_date),
            user_id: row.user_id,
            user_name: row.user_name,
            card_count: Number(row.card_count) || 0,
            freq: Number(row.freq) || 0,
            bunga_0: Number(row.bunga_0) || 0,
            bunga_regular: Number(row.bunga_regular) || 0,
            sales_volume: Number(row.sales_volume) || 0,
          },
        });
      } else if (type === "spv") {
        identifier = `${row.user_id2} / ${row.report_date2}`;
        await prisma.spv_daily.upsert({
          where: {
            report_type2_report_date2_user_id2: {
              report_type2: row.report_type2,
              report_date2: new Date(row.report_date2),
              user_id2: row.user_id2,
            },
          },
          update: {
            user_name2: row.user_name2,
            card_count2: Number(row.card_count2) || 0,
            freq2: Number(row.freq2) || 0,
            bunga_02: Number(row.bunga_02) || 0,
            bunga_regular2: Number(row.bunga_regular2) || 0,
            sales_volume2: Number(row.sales_volume2) || 0,
          },
          create: {
            report_type2: row.report_type2,
            report_date2: new Date(row.report_date2),
            user_id2: row.user_id2,
            user_name2: row.user_name2,
            card_count2: Number(row.card_count2) || 0,
            freq2: Number(row.freq2) || 0,
            bunga_02: Number(row.bunga_02) || 0,
            bunga_regular2: Number(row.bunga_regular2) || 0,
            sales_volume2: Number(row.sales_volume2) || 0,
          },
        });
      } else if (type === "cd") {
        identifier = `${row.user_id3} / ${row.report_date3}`;
        // cd_daily punya kolom interval (talktime, duration) yang tidak didukung Prisma Client,
        // jadi wajib pakai raw SQL untuk insert/update-nya.
        await prisma.$executeRaw`
          INSERT INTO cd_daily (
            report_date3, user_id3, user_name3, nsts, new_count, fup, dec_count,
            ncn, npu, ruf, atmp, talktime, duration, aprv, rdpc, clos, sol,
            ar, er, tr_pct, scr_pct, s_c, dch, prd
          ) VALUES (
            ${new Date(row.report_date3)}, ${row.user_id3}, ${row.user_name3},
            ${Number(row.nsts) || 0}, ${Number(row.new_count) || 0}, ${Number(row.fup) || 0},
            ${Number(row.dec_count) || 0}, ${Number(row.ncn) || 0}, ${Number(row.npu) || 0},
            ${Number(row.ruf) || 0}, ${Number(row.atmp) || 0},
            ${row.talktime}::interval, ${row.duration}::interval,
            ${Number(row.aprv) || 0}, ${Number(row.rdpc) || 0}, ${Number(row.clos) || 0}, ${Number(row.sol) || 0},
            ${Number(row.ar) || 0}, ${Number(row.er) || 0}, ${Number(row.tr_pct) || 0},
            ${Number(row.scr_pct) || 0}, ${Number(row.s_c) || 0}, ${Number(row.dch) || 0}, ${row.prd ?? null}
          )
          ON CONFLICT (report_date3, user_id3) DO UPDATE SET
            user_name3 = EXCLUDED.user_name3,
            nsts = EXCLUDED.nsts,
            new_count = EXCLUDED.new_count,
            fup = EXCLUDED.fup,
            dec_count = EXCLUDED.dec_count,
            ncn = EXCLUDED.ncn,
            npu = EXCLUDED.npu,
            ruf = EXCLUDED.ruf,
            atmp = EXCLUDED.atmp,
            talktime = EXCLUDED.talktime,
            duration = EXCLUDED.duration,
            aprv = EXCLUDED.aprv,
            rdpc = EXCLUDED.rdpc,
            clos = EXCLUDED.clos,
            sol = EXCLUDED.sol,
            ar = EXCLUDED.ar,
            er = EXCLUDED.er,
            tr_pct = EXCLUDED.tr_pct,
            scr_pct = EXCLUDED.scr_pct,
            s_c = EXCLUDED.s_c,
            dch = EXCLUDED.dch,
            prd = EXCLUDED.prd
        `;
      } else if (type === "mapping") {
        const userId4 = row.user_id4 ?? row.user_id;
        identifier = `${userId4} / ${row.period_month}`;
        const rawMonth = (row.period_month || "").trim();
        const monthDate = new Date(`${rawMonth.slice(0, 7)}-01T00:00:00.000Z`);
        await prisma.agent_spv_mapping.upsert({
          where: {
            user_id4_period_month: {
              user_id4: userId4,
              period_month: monthDate,
            },
          },
          update: {
            spv_user_id: row.spv_user_id,
            spv_name: row.spv_name,
            level: row.level,
          },
          create: {
            user_id4: userId4,
            spv_user_id: row.spv_user_id,
            spv_name: row.spv_name,
            level: row.level,
            period_month: monthDate,
          },
        });
      }
      success++;
    } catch (err) {
      failed++;
      const reason = err instanceof Error
        ? err.message.trim().split("\n").filter(Boolean).pop()!.slice(0, 200)
        : "error";
      failedItems.push(`${identifier} (${reason})`);
    }
  }
 
  const failedList = failedItems.slice(0, 30).join(" | ");
  redirect(
    `/upload?status=done&type=${type}&success=${success}&failed=${failed}&faileditems=${encodeURIComponent(failedList)}`
  );
}