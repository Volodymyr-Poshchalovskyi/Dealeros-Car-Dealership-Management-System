// import.js
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const setupDatabase = require("./database.js");

const excelFilePath = path.join(
  __dirname,
  "Master_Spreadsheet_TRIAL_sanitised.xlsx",
);

// Create subdirectories for stock vehicles
function createCarFolders(stock_id) {
  const baseDir = path.join(__dirname, "Cars", stock_id);
  const subFolders = [
    "Photos",
    "Documents",
    "ServiceHistory",
    "MOT",
    "Purchase",
    "Sale",
    "Delivery",
    "Collection",
  ];

  subFolders.forEach((folder) => {
    const dirPath = path.join(baseDir, folder);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

// Create subdirectories for investors
function createInvestorFolders(investorName) {
  // Skip if investor is empty or company itself (SA)
  if (!investorName || investorName.trim().toUpperCase() === "SA") return;

  const safeName = investorName.trim();
  const baseDir = path.join(__dirname, "Investors", safeName);
  const subFolders = ["Contracts", "Invoices", "Payouts"];

  subFolders.forEach((folder) => {
    const dirPath = path.join(baseDir, folder);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

async function importData() {
  const db = await setupDatabase();

  await db.run("DELETE FROM cars");

  try {
    const workbook = xlsx.readFile(excelFilePath);
    let counter = 1;

    // Import active stock data
    const stockSheet = workbook.Sheets["Stock Data"];
    if (stockSheet) {
      const rows = xlsx.utils.sheet_to_json(stockSheet, {
        range: 1,
        defval: "",
      });
      for (const row of rows) {
        const plate_number = row["Plate Number"];
        const make_model = row["Make & Model"];
        if (!plate_number || !make_model) continue;

        const stock_id = `STK-${String(counter).padStart(3, "0")}`;
        counter++;

        const date_acquired = row["Date Aquired"] || "";
        const source = row["Source"] || "";
        const px_value = parseFloat(row["PX Value"]) || 0;
        const purchase_price = parseFloat(row["Price"]) || 0;
        const reconditioning_costs =
          parseFloat(row["Reconditioning costs"]) || 0;
        const total_cost = parseFloat(row["Total Cost"]) || 0;
        const sale_price = parseFloat(row["Sold"]) || 0;

        let status = row["Status"]
          ? row["Status"].toString().trim()
          : "In Stock";
        if (status.toLowerCase() === "sold") status = "Sold";

        const investor = row["Investor/SA"]
          ? row["Investor/SA"].toString().trim()
          : "";

        await db.run(
          `INSERT INTO cars (stock_id, date_acquired, plate_number, make_model, source, px_value, purchase_price, reconditioning_costs, total_cost, sale_price, status, investor)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stock_id,
            date_acquired,
            plate_number,
            make_model,
            source,
            px_value,
            purchase_price,
            reconditioning_costs,
            total_cost,
            sale_price,
            status,
            investor,
          ],
        );

        // Create folder structure
        createCarFolders(stock_id);
        if (investor) createInvestorFolders(investor);
      }
    }

    // Import sold vehicle history
    const soldSheet = workbook.Sheets["Sold Stock"];
    if (soldSheet) {
      const soldRows = xlsx.utils.sheet_to_json(soldSheet, {
        range: 1,
        defval: "",
      });
      for (const row of soldRows) {
        const plate_number = row["Number Plate reference"];
        const make_model = row["Make & Model"];
        if (!plate_number || !make_model) continue;

        const stock_id = `STK-${String(counter).padStart(3, "0")}`;
        counter++;

        const date_acquired = row["Date Aquired"] || "";
        // Handle date format from Excel
        const date_sold_raw = row["Date Sold"] || "";
        const date_sold = String(date_sold_raw);

        const total_cost = parseFloat(row["Total Cost"]) || 0;
        const sale_price = parseFloat(row["Sold"]) || 0;
        const investor = row["SA/Investor Name"]
          ? row["SA/Investor Name"].toString().trim()
          : "";

        await db.run(
          `INSERT INTO cars (stock_id, date_acquired, date_sold, plate_number, make_model, source, px_value, purchase_price, reconditioning_costs, total_cost, sale_price, status, investor)
                     VALUES (?, ?, ?, ?, ?, '', 0, 0, 0, ?, ?, 'Sold', ?)`,
          [
            stock_id,
            date_acquired,
            date_sold,
            plate_number,
            make_model,
            total_cost,
            sale_price,
            investor,
          ],
        );

        // Create folder structure
        createCarFolders(stock_id);
        if (investor) createInvestorFolders(investor);
      }
    }
  } catch (err) {
    console.error("Error reading Excel file:", err.message);
  }
}

importData();
