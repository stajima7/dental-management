import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/import/csv - CSVデータの取込・保存
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await req.json();
    const { clinicId, data, mapping } = body;

    if (!clinicId || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: "clinicId, data が必要です" }, { status: 400 });
    }

    // アクセス権確認
    const clinicUser = await prisma.clinicUser.findUnique({
      where: {
        userId_clinicId: {
          userId: (session.user as any).id,
          clinicId,
        },
      },
    });

    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    // UploadFileレコード作成
    const uploadFile = await prisma.uploadFile.create({
      data: {
        clinicId,
        fileName: `import_${new Date().toISOString()}.csv`,
        fileType: "CSV",
        fileSize: JSON.stringify(data).length,
        status: "PROCESSING",
      },
    });

    // マッピング情報の保存（あれば）
    if (mapping) {
      await prisma.importMapping.create({
        data: {
          clinicId,
          name: `マッピング_${new Date().toISOString().slice(0, 10)}`,
          mappingJson: mapping,
        },
      });
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (const row of data) {
      try {
        const yearMonth = row.yearMonth;
        if (!yearMonth) {
          errors.push("年月が未指定の行があります");
          continue;
        }

        // 月次売上の保存
        if (row.totalRevenue || row.insuranceRevenue || row.selfPayRevenue) {
          // 保険売上
          if (row.insuranceRevenue) {
            await prisma.monthlyRevenue.upsert({
              where: {
                clinicId_yearMonth_departmentType_revenueType_insuranceOrPrivate: {
                  clinicId,
                  yearMonth,
                  departmentType: "INSURANCE",
                  revenueType: "TREATMENT",
                  insuranceOrPrivate: "INSURANCE",
                },
              },
              update: {
                amount: parseFloat(row.insuranceRevenue) || 0,
                points: parseInt(row.insurancePoints) || 0,
              },
              create: {
                clinicId,
                yearMonth,
                departmentType: "INSURANCE",
                revenueType: "TREATMENT",
                insuranceOrPrivate: "INSURANCE",
                amount: parseFloat(row.insuranceRevenue) || 0,
                points: parseInt(row.insurancePoints) || 0,
              },
            });
          }

          // 自費売上
          if (row.selfPayRevenue) {
            await prisma.monthlyRevenue.upsert({
              where: {
                clinicId_yearMonth_departmentType_revenueType_insuranceOrPrivate: {
                  clinicId,
                  yearMonth,
                  departmentType: "SELF_PAY",
                  revenueType: "TREATMENT",
                  insuranceOrPrivate: "PRIVATE",
                },
              },
              update: {
                amount: parseFloat(row.selfPayRevenue) || 0,
              },
              create: {
                clinicId,
                yearMonth,
                departmentType: "SELF_PAY",
                revenueType: "TREATMENT",
                insuranceOrPrivate: "PRIVATE",
                amount: parseFloat(row.selfPayRevenue) || 0,
              },
            });
          }

          // メンテナンス売上
          if (row.maintenanceRevenue) {
            await prisma.monthlyRevenue.upsert({
              where: {
                clinicId_yearMonth_departmentType_revenueType_insuranceOrPrivate: {
                  clinicId,
                  yearMonth,
                  departmentType: "MAINTENANCE",
                  revenueType: "PREVENTION",
                  insuranceOrPrivate: "MIXED",
                },
              },
              update: {
                amount: parseFloat(row.maintenanceRevenue) || 0,
              },
              create: {
                clinicId,
                yearMonth,
                departmentType: "MAINTENANCE",
                revenueType: "PREVENTION",
                insuranceOrPrivate: "MIXED",
                amount: parseFloat(row.maintenanceRevenue) || 0,
              },
            });
          }

          // 訪問診療売上
          if (row.homeVisitRevenue) {
            await prisma.monthlyRevenue.upsert({
              where: {
                clinicId_yearMonth_departmentType_revenueType_insuranceOrPrivate: {
                  clinicId,
                  yearMonth,
                  departmentType: "HOME_VISIT",
                  revenueType: "TREATMENT",
                  insuranceOrPrivate: "INSURANCE",
                },
              },
              update: {
                amount: parseFloat(row.homeVisitRevenue) || 0,
              },
              create: {
                clinicId,
                yearMonth,
                departmentType: "HOME_VISIT",
                revenueType: "TREATMENT",
                insuranceOrPrivate: "INSURANCE",
                amount: parseFloat(row.homeVisitRevenue) || 0,
              },
            });
          }

          // 合計売上
          const totalRev = parseFloat(row.totalRevenue) ||
            ((parseFloat(row.insuranceRevenue) || 0) +
             (parseFloat(row.selfPayRevenue) || 0) +
             (parseFloat(row.maintenanceRevenue) || 0) +
             (parseFloat(row.homeVisitRevenue) || 0));

          await prisma.monthlyRevenue.upsert({
            where: {
              clinicId_yearMonth_departmentType_revenueType_insuranceOrPrivate: {
                clinicId,
                yearMonth,
                departmentType: "TOTAL",
                revenueType: "TREATMENT",
                insuranceOrPrivate: "MIXED",
              },
            },
            update: { amount: totalRev },
            create: {
              clinicId,
              yearMonth,
              departmentType: "TOTAL",
              revenueType: "TREATMENT",
              insuranceOrPrivate: "MIXED",
              amount: totalRev,
            },
          });
        }

        // 月次患者数の保存
        if (row.totalPatients || row.newPatients || row.uniquePatients) {
          await prisma.monthlyPatients.upsert({
            where: {
              clinicId_yearMonth_departmentType: {
                clinicId,
                yearMonth,
                departmentType: "TOTAL",
              },
            },
            update: {
              totalPatientCount: parseInt(row.totalPatients) || 0,
              uniquePatientCount: parseInt(row.uniquePatients) || 0,
              newPatientCount: parseInt(row.newPatients) || 0,
              returnPatientCount: parseInt(row.returnPatients) || 0,
              dropoutCount: parseInt(row.dropoutCount) || 0,
              maintenanceTransitionCount: parseInt(row.maintenancePatients) || 0,
            },
            create: {
              clinicId,
              yearMonth,
              departmentType: "TOTAL",
              totalPatientCount: parseInt(row.totalPatients) || 0,
              uniquePatientCount: parseInt(row.uniquePatients) || 0,
              newPatientCount: parseInt(row.newPatients) || 0,
              returnPatientCount: parseInt(row.returnPatients) || 0,
              dropoutCount: parseInt(row.dropoutCount) || 0,
              maintenanceTransitionCount: parseInt(row.maintenancePatients) || 0,
            },
          });
        }

        // 月次予約の保存
        if (row.appointmentCount || row.cancelCount) {
          await prisma.monthlyAppointments.upsert({
            where: {
              clinicId_yearMonth_departmentType: {
                clinicId,
                yearMonth,
                departmentType: "TOTAL",
              },
            },
            update: {
              appointmentCount: parseInt(row.appointmentCount) || 0,
              cancelCount: parseInt(row.cancelCount) || 0,
              noShowCount: parseInt(row.noShowCount) || 0,
              completedCount: (parseInt(row.appointmentCount) || 0) - (parseInt(row.cancelCount) || 0) - (parseInt(row.noShowCount) || 0),
            },
            create: {
              clinicId,
              yearMonth,
              departmentType: "TOTAL",
              appointmentCount: parseInt(row.appointmentCount) || 0,
              cancelCount: parseInt(row.cancelCount) || 0,
              noShowCount: parseInt(row.noShowCount) || 0,
              completedCount: (parseInt(row.appointmentCount) || 0) - (parseInt(row.cancelCount) || 0) - (parseInt(row.noShowCount) || 0),
            },
          });
        }

        // コストデータの保存
        const costMapping: Record<string, { code: string; layer: "DIRECT" | "INDIRECT" }> = {
          laborCost: { code: "LABOR", layer: "INDIRECT" },
          materialCost: { code: "DIRECT_MATERIAL", layer: "DIRECT" },
          labFee: { code: "LAB_FEE", layer: "DIRECT" },
          rentCost: { code: "RENT", layer: "INDIRECT" },
          utilitiesCost: { code: "UTILITIES", layer: "INDIRECT" },
          leaseCost: { code: "LEASE", layer: "INDIRECT" },
          depreciationCost: { code: "DEPRECIATION", layer: "INDIRECT" },
          advertisingCost: { code: "ADVERTISING", layer: "INDIRECT" },
          communicationCost: { code: "COMMUNICATION", layer: "INDIRECT" },
          consumablesCost: { code: "CONSUMABLES", layer: "INDIRECT" },
          trainingCost: { code: "TRAINING", layer: "INDIRECT" },
          insurancePremium: { code: "MISCELLANEOUS", layer: "INDIRECT" },
          miscCost: { code: "MISCELLANEOUS", layer: "INDIRECT" },
        };

        for (const [field, { code, layer }] of Object.entries(costMapping)) {
          if (row[field]) {
            const amount = parseFloat(row[field]);
            if (amount > 0) {
              await prisma.monthlyCosts.upsert({
                where: {
                  clinicId_yearMonth_costItemCode_departmentType: {
                    clinicId,
                    yearMonth,
                    costItemCode: code,
                    departmentType: "TOTAL",
                  },
                },
                update: { amount, costLayer: layer },
                create: {
                  clinicId,
                  yearMonth,
                  costItemCode: code,
                  departmentType: "TOTAL",
                  costLayer: layer,
                  amount,
                },
              });
            }
          }
        }

        importedCount++;
      } catch (rowError) {
        errors.push(`行 ${row.yearMonth || "不明"}: ${String(rowError)}`);
      }
    }

    // UploadFileステータス更新
    await prisma.uploadFile.update({
      where: { id: uploadFile.id },
      data: {
        status: errors.length > 0 ? "ERROR" : "COMPLETED",
        errorLog: errors.length > 0 ? errors.join("\n") : null,
      },
    });

    return NextResponse.json({
      success: true,
      importedCount,
      totalRows: data.length,
      errors,
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json({ error: "CSVインポートに失敗しました" }, { status: 500 });
  }
}
