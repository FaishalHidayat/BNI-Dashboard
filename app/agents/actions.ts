"use server";
 
import { prisma } from "../../lib/prisma";
import { revalidatePath } from "next/cache";
 
export async function addAgent(formData: FormData) {
  const user_id = (formData.get("user_id") as string).trim();
  const user_name = (formData.get("user_name") as string).trim();
  const role = (formData.get("role") as string).trim();
  const level = (formData.get("level") as string) || null;
 
  await prisma.agent.upsert({
    where: { user_id },
    update: { user_name, role, level },
    create: { user_id, user_name, role, level },
  });
 
  revalidatePath("/agents");
}
 
export async function addMapping(formData: FormData) {
  const user_id4 = (formData.get("user_id4") as string).trim();
  const spv_user_id = (formData.get("spv_user_id") as string).trim();
  const spv_name = (formData.get("spv_name") as string).trim();
  const level = (formData.get("level") as string) || null;
  const period_month = new Date(`${formData.get("period_month")}-01T00:00:00.000Z`);
 
  await prisma.agent_spv_mapping.upsert({
    where: { user_id4_period_month: { user_id4, period_month } },
    update: { spv_user_id, spv_name, level },
    create: { user_id4, spv_user_id, spv_name, level, period_month },
  });
 
  revalidatePath("/agents");
}