import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const defaultInput = path.join(backendDir, "data", "WebMarketed20260710.xls");
const inputPath = path.resolve(process.argv[2] ?? defaultInput);
const outputDir = path.resolve(process.argv[3] ?? path.join(backendDir, "data", "processed"));
const sourceFile = path.relative(backendDir, inputPath).replaceAll("\\", "/");
const importedAt = new Date().toISOString();
let sourceSheet = "";

const requiredHeaders = [
  "Code",
  "Registration number",
  "Brand name",
  "Strength",
  "Presentation",
  "Form",
  "Agent",
  "Manufacturer",
  "Country",
  "Public Price LL",
  "Pharmacist Margin",
  "Stratum",
  "public price Decision 119/1 20230126",
  "Responsible Party Name",
  "Responsible Party Country",
  "Exch_Dates",
];

function main() {
  ensureFile(inputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  const workbook = XLSX.readFile(inputPath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error(`No sheets found in ${inputPath}`);
  }
  sourceSheet = sheetName;

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: true,
  });

  validateHeaders(rows[0] ?? {});

  const medicines = [];
  const rejectedRows = [];
  const seenIds = new Set();
  const seenSearchKeys = new Set();

  rows.forEach((row, index) => {
    const sourceRowNumber = index + 2;
    const parsed = toMedicine(row, sourceRowNumber);

    if (parsed.rejected) {
      rejectedRows.push(parsed.rejected);
      return;
    }

    if (seenIds.has(parsed.medicine.medicineId)) {
      rejectedRows.push({
        rowNumber: sourceRowNumber,
        reason: `Duplicate medicineId ${parsed.medicine.medicineId}`,
        source: compactSourceRow(row),
      });
      return;
    }

    const searchKey = [
      parsed.medicine.normalizedBrandName,
      normalize(parsed.medicine.strength),
      normalize(parsed.medicine.presentation),
      normalize(parsed.medicine.dosageForm),
    ].join("|");

    if (seenSearchKeys.has(searchKey)) {
      parsed.medicine.duplicateSearchKey = true;
    }

    seenIds.add(parsed.medicine.medicineId);
    seenSearchKeys.add(searchKey);
    medicines.push(parsed.medicine);
  });

  medicines.sort((a, b) => {
    const brandCompare = a.brandName.localeCompare(b.brandName);
    if (brandCompare !== 0) return brandCompare;
    return a.medicineId.localeCompare(b.medicineId);
  });

  const summary = {
    sourceFile,
    sheetName,
    importedAt,
    sourceRows: rows.length,
    acceptedRows: medicines.length,
    rejectedRows: rejectedRows.length,
    duplicateSearchKeys: medicines.filter((medicine) => medicine.duplicateSearchKey).length,
    outputs: {
      medicinesJson: "medicines-import.json",
      medicinesCsv: "medicines-import.csv",
      dynamodbBatchJson: "medicines-dynamodb-batch.json",
      dynamodbBatchDirectory: "dynamodb-batches/",
      rejectedRowsCsv: "rejected-rows.csv",
    },
    notes: [
      "The source file does not include a separate generic-name column, so genericName is left blank.",
      "medicineId uses the Ministry Code column as MED#<Code> for stable inventory references.",
      "Additional source fields such as price and registration number are preserved in the JSON and DynamoDB output.",
    ],
  };

  writeJson("medicines-import.json", medicines);
  writeCsv("medicines-import.csv", medicines.map(toCsvMedicineRow));
  writeJson("medicines-dynamodb-batch.json", {
    DawaaMedicines: medicines.map((medicine) => ({ PutRequest: { Item: toDynamoItem(medicine) } })),
  });
  writeDynamoBatchFiles(medicines);
  writeCsv("rejected-rows.csv", rejectedRows);
  writeJson("summary.json", summary);

  console.log(JSON.stringify(summary, null, 2));
}

function toMedicine(row, rowNumber) {
  const code = clean(row["Code"]);
  const brandName = clean(row["Brand name"]);

  if (!code && !brandName) {
    return {
      rejected: {
        rowNumber,
        reason: "Blank row",
        source: compactSourceRow(row),
      },
    };
  }

  if (!code) {
    return {
      rejected: {
        rowNumber,
        reason: "Missing Code",
        source: compactSourceRow(row),
      },
    };
  }

  if (!brandName) {
    return {
      rejected: {
        rowNumber,
        reason: "Missing Brand name",
        source: compactSourceRow(row),
      },
    };
  }

  const now = importedAt;
  const medicine = {
    medicineId: `MED#${code}`,
    sourceCode: code,
    registrationNumber: clean(row["Registration number"]),
    brandName,
    genericName: "",
    strength: clean(row["Strength"]),
    presentation: clean(row["Presentation"]),
    dosageForm: clean(row["Form"]) || inferDosageForm(clean(row["Presentation"])),
    agent: clean(row["Agent"]),
    manufacturer: clean(row["Manufacturer"]),
    country: clean(row["Country"]),
    publicPriceLbp: numberValue(row["Public Price LL"]),
    pharmacistMarginPercent: numberValue(row["Pharmacist Margin"]),
    stratum: clean(row["Stratum"]),
    publicPriceDecision119: numberValue(row["public price Decision 119/1 20230126"]),
    responsiblePartyName: clean(row["Responsible Party Name"]),
    responsiblePartyCountry: clean(row["Responsible Party Country"]),
    exchangeDate: excelDateValue(row["Exch_Dates"]),
    normalizedBrandName: normalize(brandName),
    normalizedGenericName: "",
    active: true,
    sourceFile,
    sourceSheet,
    sourceRowNumber: rowNumber,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  return { medicine };
}

function inferDosageForm(presentation) {
  const value = presentation.toLowerCase();
  if (value.includes("tablet") || value.includes(" tab")) return "Tablet";
  if (value.includes("capsule") || value.includes(" cap")) return "Capsule";
  if (value.includes("syrup")) return "Syrup";
  if (value.includes("injection") || value.includes("vial") || value.includes("ampoule")) {
    return "Injection";
  }
  if (value.includes("cream")) return "Cream";
  if (value.includes("ointment")) return "Ointment";
  if (value.includes("drop")) return "Drops";
  if (value.includes("spray")) return "Spray";
  return "";
}

function toCsvMedicineRow(medicine) {
  return {
    medicineId: medicine.medicineId,
    sourceCode: medicine.sourceCode,
    registrationNumber: medicine.registrationNumber,
    brandName: medicine.brandName,
    genericName: medicine.genericName,
    strength: medicine.strength,
    presentation: medicine.presentation,
    dosageForm: medicine.dosageForm,
    manufacturer: medicine.manufacturer,
    agent: medicine.agent,
    country: medicine.country,
    publicPriceLbp: medicine.publicPriceLbp,
    normalizedBrandName: medicine.normalizedBrandName,
    active: medicine.active,
  };
}

function toDynamoItem(medicine) {
  const item = {};
  for (const [key, value] of Object.entries(medicine)) {
    const attribute = toDynamoAttribute(value);
    if (attribute) {
      item[key] = attribute;
    }
  }
  return item;
}

function toDynamoAttribute(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "boolean") return { BOOL: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return { N: String(value) };
  }
  return { S: String(value) };
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(outputDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function writeCsv(fileName, rows) {
  const filePath = path.join(outputDir, fileName);
  if (rows.length === 0) {
    fs.writeFileSync(filePath, "");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function writeDynamoBatchFiles(medicines) {
  const batchDir = path.join(outputDir, "dynamodb-batches");
  fs.rmSync(batchDir, { recursive: true, force: true });
  fs.mkdirSync(batchDir, { recursive: true });

  for (let index = 0; index < medicines.length; index += 25) {
    const batchNumber = index / 25 + 1;
    const batch = medicines.slice(index, index + 25);
    const request = {
      RequestItems: {
        DawaaMedicines: batch.map((medicine) => ({
          PutRequest: { Item: toDynamoItem(medicine) },
        })),
      },
    };
    fs.writeFileSync(
      path.join(batchDir, `batch-${String(batchNumber).padStart(4, "0")}.json`),
      `${JSON.stringify(request, null, 2)}\n`,
    );
  }
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function validateHeaders(firstRow) {
  const present = new Set(Object.keys(firstRow));
  const missing = requiredHeaders.filter((header) => !present.has(header));
  if (missing.length > 0) {
    throw new Error(`Missing expected columns: ${missing.join(", ")}`);
  }
}

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = clean(value).replaceAll(",", "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function excelDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }
  const numeric = numberValue(value);
  if (numeric === null) return clean(value);
  const parsed = XLSX.SSF.parse_date_code(numeric);
  if (!parsed) return clean(value);
  return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

function compactSourceRow(row) {
  return {
    code: clean(row["Code"]),
    registrationNumber: clean(row["Registration number"]),
    brandName: clean(row["Brand name"]),
    strength: clean(row["Strength"]),
    presentation: clean(row["Presentation"]),
  };
}

main();
