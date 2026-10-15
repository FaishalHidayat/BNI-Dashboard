"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";

function parseMonth(formData: FormData) {
  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  return new Date(`${month}-01T00:00:00.000Z`);
}

function refresh() {
  revalidatePath("/yearlyitkxasn");
  revalidatePath("/itkxasn");
}

export async function saveAsnAgentCount(formData: FormData) {
  const periodMonth = parseMonth(formData);
  const count = Math.round(Number(formData.get("agent_count")));
  if (!periodMonth || !Number.isFinite(count) || count <= 0) return;

  await prisma.asn_agent_count.upsert({
    where: { period_month: periodMonth },
    update: { agent_count: count },
    create: { period_month: periodMonth, agent_count: count },
  });
  refresh();
}

export async function saveItkAgentCount(formData: FormData) {
  const periodMonth = parseMonth(formData);
  if (!periodMonth) return;
  const raw = String(formData.get("agent_count") ?? "").trim();

  // Dikosongkan = hapus input manual, kembali ke angka otomatis dari Resume Agent
  if (raw === "") {
    await prisma.itk_agent_count.deleteMany({ where: { period_month: periodMonth } });
    refresh();
    return;
  }

  const count = Math.round(Number(raw));
  if (!Number.isFinite(count) || count <= 0) return;

  await prisma.itk_agent_count.upsert({
    where: { period_month: periodMonth },
    update: { agent_count: count },
    create: { period_month: periodMonth, agent_count: count },
  });
  refresh();
}