"use server";
 
import { prisma } from "../../lib/prisma";
import { revalidatePath } from "next/cache";
 
export async function updateAsn(formData: FormData) {
  const dateStr = formData.get("date") as string;
  const value = formData.get("asn_value") as string;
 
  await prisma.asn_target.upsert({
    where: { report_date: new Date(dateStr) },
    update: { sales_volume_asn: Number(value) || 0 },
    create: { report_date: new Date(dateStr), sales_volume_asn: Number(value) || 0 },
  });
 
  revalidatePath("/itkxasn");
}