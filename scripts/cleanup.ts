import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const clinics = await p.clinic.findMany({ where: { isSetupComplete: false } });
  for (const c of clinics) {
    await p.clinicUser.deleteMany({ where: { clinicId: c.id } });
    await p.clinicProfile.deleteMany({ where: { clinicId: c.id } });
    await p.clinic.delete({ where: { id: c.id } });
    console.log("削除:", c.id);
  }
  console.log("完了");
}
main().finally(() => p.$disconnect());
