"use server";
 
import { prisma } from "../../lib/prisma";
import { revalidatePath } from "next/cache";
 
// --- Hapus per baris ---
export async function deleteAgRow(formData: FormData) {
  const report_type = formData.get("report_type") as string;
  const report_date = formData.get("report_date") as string;
  const user_id = formData.get("user_id") as string;
  await prisma.ag_daily.delete({
    where: { report_type_report_date_user_id: { report_type, report_date: new Date(report_date), user_id } },
  });
  revalidatePath("/manage-data");
}
 
export async function deleteSpvRow(formData: FormData) {
  const report_type2 = formData.get("report_type2") as string;
  const report_date2 = formData.get("report_date2") as string;
  const user_id2 = formData.get("user_id2") as string;
  await prisma.spv_daily.delete({
    where: { report_type2_report_date2_user_id2: { report_type2, report_date2: new Date(report_date2), user_id2 } },
  });
  revalidatePath("/manage-data");
}
 
export async function deleteCdRow(formData: FormData) {
  const report_date3 = formData.get("report_date3") as string;
  const user_id3 = formData.get("user_id3") as string;
  await prisma.cd_daily.delete({
    where: { report_date3_user_id3: { report_date3: new Date(report_date3), user_id3 } },
  });
  revalidatePath("/manage-data");
}
 
export async function deleteMappingRow(formData: FormData) {
  const user_id4 = formData.get("user_id4") as string;
  const period_month = formData.get("period_month") as string; // YYYY-MM
  await prisma.agent_spv_mapping.delete({
    where: { user_id4_period_month: { user_id4, period_month: new Date(`${period_month.slice(0, 7)}-01T00:00:00.000Z`) } },
  });
  revalidatePath("/manage-data");
}
 
// --- Hapus massal (per tanggal / per bulan) ---
export async function deleteAgBulk(formData: FormData) {
  const report_date = formData.get("report_date") as string;
  await prisma.ag_daily.deleteMany({ where: { report_date: new Date(report_date) } });
  revalidatePath("/manage-data");
}
 
export async function deleteSpvBulk(formData: FormData) {
  const report_date2 = formData.get("report_date2") as string;
  await prisma.spv_daily.deleteMany({ where: { report_date2: new Date(report_date2) } });
  revalidatePath("/manage-data");
}
 
export async function deleteCdBulk(formData: FormData) {
  const report_date3 = formData.get("report_date3") as string;
  await prisma.cd_daily.deleteMany({ where: { report_date3: new Date(report_date3) } });
  revalidatePath("/manage-data");
}
 
export async function deleteMappingBulk(formData: FormData) {
  const period_month = formData.get("period_month") as string;
  await prisma.agent_spv_mapping.deleteMany({
    where: { period_month: new Date(`${period_month.slice(0, 7)}-01T00:00:00.000Z`) },
  });
  revalidatePath("/manage-data");
}