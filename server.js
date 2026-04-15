const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const setupDatabase = require("./database.js");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

let db;

setupDatabase()
  .then((database) => {
    db = database;

    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "DealerOS_v4_TRIAL_sanitised.html"));
    });

    app.get("/api/cars", async (req, res) => {
      try {
        const cars = await db.all("SELECT * FROM cars");
        res.json({ status: "success", data: cars });
      } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
      }
    });

    app.post("/api/cars", async (req, res) => {
      let {
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
        notes,
        is_sor,
        sor_owner,
      } = req.body;

      if (!stock_id) {
        stock_id = "STK-" + Date.now().toString().slice(-6);
      }

      try {
        await db.run(
          `INSERT INTO cars (stock_id, date_acquired, plate_number, make_model, source, px_value, purchase_price, reconditioning_costs, total_cost, sale_price, status, investor, notes, is_sor, sor_owner)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stock_id,
            date_acquired,
            plate_number,
            make_model,
            source,
            px_value || 0,
            purchase_price || 0,
            reconditioning_costs || 0,
            total_cost || 0,
            sale_price || 0,
            status || "In Stock",
            investor || "",
            notes || "",
            is_sor || 0,
            sor_owner || "",
          ],
        );

        // Create subdirectories for car files
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

        await autoSyncExcel();

        res.json({
          status: "success",
          message: "Car added and folders created",
          stock_id: stock_id,
        });
      } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
      }
    });

    const ExcelJS = require("exceljs");

    // Synchronize database with Excel spreadsheet
    async function autoSyncExcel() {
      try {
        const filePath = path.join(
          __dirname,
          "Master_Spreadsheet_TRIAL_sanitised.xlsx",
        );
        const workbook = new ExcelJS.Workbook();

        if (fs.existsSync(filePath)) {
          await workbook.xlsx.readFile(filePath);
        } else {
          return;
        }

        // Update "Stock Data" sheet with active cars
        let stockSheet = workbook.getWorksheet("Stock Data");
        if (stockSheet) {
          stockSheet.spliceRows(2, Math.max(1, stockSheet.rowCount - 1));
          const activeCars = await db.all(
            "SELECT * FROM cars WHERE status != 'Sold' ORDER BY date_acquired DESC",
          );
          activeCars.forEach((car) => {
            stockSheet.addRow([
              "",
              car.date_acquired,
              car.plate_number,
              car.make_model,
              car.source,
              car.px_value,
              car.purchase_price,
              car.reconditioning_costs,
              car.total_cost,
              "",
              car.status,
              car.investor,
              car.notes,
            ]);
          });
        }

        // Update "Sold Stock" sheet with sold cars
        let soldSheet = workbook.getWorksheet("Sold Stock");
        if (soldSheet) {
          soldSheet.spliceRows(2, Math.max(1, soldSheet.rowCount - 1));
          const soldCars = await db.all(
            "SELECT * FROM cars WHERE status = 'Sold' ORDER BY date_sold DESC",
          );
          soldCars.forEach((car) => {
            soldSheet.addRow([
              "",
              car.date_acquired,
              car.plate_number,
              car.make_model,
              car.investor,
              car.total_cost,
              car.sale_price,
              "",
              "",
              car.sale_price - car.total_cost,
              "",
              "",
              "",
              car.date_sold,
              "",
              "",
              "",
              "",
              "",
              "",
              "",
            ]);
          });
        }

        await workbook.xlsx.writeFile(filePath);
      } catch (err) {
        console.error("Excel sync error:", err.message);
      }
    }

    // Save invoice to car and investor directories
    app.post("/api/invoice/save", async (req, res) => {
      const { stock_id, investor_name, html_content } = req.body;

      if (!stock_id || !html_content) {
        return res
          .status(400)
          .json({ status: "error", message: "Missing data" });
      }

      try {
        const fileName = `Invoice_${stock_id}.html`;

        // Save to car Sale directory
        const carSaleDir = path.join(__dirname, "Cars", stock_id, "Sale");
        if (fs.existsSync(carSaleDir)) {
          fs.writeFileSync(path.join(carSaleDir, fileName), html_content);
        }

        // Save to investor Invoices directory
        if (investor_name && investor_name.trim().toUpperCase() !== "SA") {
          const safeName = investor_name.trim();
          const investorDir = path.join(
            __dirname,
            "Investors",
            safeName,
            "Invoices",
          );
          if (fs.existsSync(investorDir)) {
            fs.writeFileSync(path.join(investorDir, fileName), html_content);
          }
        }

        res.json({ status: "success", message: "Invoice saved locally" });
      } catch (err) {
        console.error("Invoice save error:", err);
        res.status(500).json({ status: "error", message: err.message });
      }
    });

    // Update car status to Sold and record sale details
    app.post("/api/cars/sell", async (req, res) => {
      const { stock_id, sale_price, sale_date, investor_name } = req.body;
      if (!stock_id || !sale_price)
        return res
          .status(400)
          .json({ status: "error", message: "Missing data" });

      try {
        await db.run(
          `UPDATE cars 
             SET status = 'Sold', 
                 sale_price = ?, 
                 date_sold = ?,
                 investor = ?
             WHERE stock_id = ?`,
          [sale_price, sale_date, investor_name, stock_id],
        );
        await autoSyncExcel();
        res.json({ status: "success", message: "Car marked as sold" });
      } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
      }
    });

    // Log expense and update car total cost
    app.post("/api/expenses", async (req, res) => {
      const { stock_id, category, amount, description, date } = req.body;

      if (!amount)
        return res
          .status(400)
          .json({ status: "error", message: "Amount is required" });

      try {
        // Record expense
        await db.run(
          `INSERT INTO expenses (stock_id, category, amount, notes, expense_date) 
             VALUES (?, ?, ?, ?, ?)`,
          [stock_id, category, amount, description, date],
        );

        // Update car costs if associated with vehicle
        if (stock_id) {
          await db.run(
            `UPDATE cars 
                 SET reconditioning_costs = reconditioning_costs + ?,
                     total_cost = total_cost + ?
                 WHERE stock_id = ? OR plate_number = ?`,
            [amount, amount, stock_id, stock_id],
          );
        }
        await autoSyncExcel();
        res.json({
          status: "success",
          message: "Expense logged and car cost updated",
        });
      } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
      }
    });

    // Retrieve vehicle data and associated expenses
    app.get("/api/cars/:id", async (req, res) => {
      const searchId = req.params.id.trim();
      try {
        // Search by stock_id or plate_number
        const car = await db.get(
          "SELECT * FROM cars WHERE stock_id = ? OR plate_number = ?",
          [searchId, searchId],
        );

        if (!car) {
          return res
            .status(404)
            .json({
              status: "error",
              message: "Vehicle not found in database",
            });
        }

        const expenses = await db.all(
          "SELECT * FROM expenses WHERE stock_id = ? OR stock_id = ?",
          [car.stock_id, car.plate_number],
        );

        res.json({ status: "success", data: { car, expenses } });
      } catch (err) {
        console.error(err);
        res
          .status(500)
          .json({ status: "error", message: "Internal Server Error" });
      }
    });

    // Generate investor report with investment and profit totals
    app.get("/api/investors", async (req, res) => {
      try {
        const report = await db.all(`
            SELECT 
                TRIM(investor) as name,
                COUNT(CASE WHEN status != 'Sold' THEN 1 END) as active_count,
                COUNT(CASE WHEN status = 'Sold' THEN 1 END) as sold_count,
                SUM(total_cost) as total_invested,
                SUM(CASE WHEN status = 'Sold' THEN (sale_price - total_cost) ELSE 0 END) as total_profit
            FROM cars 
            WHERE investor IS NOT NULL AND TRIM(investor) != '' AND TRIM(investor) != 'SA'
            GROUP BY TRIM(investor)
        `);

        const formatted = report.map((i) => ({
          ...i,
          investor_share: (i.total_profit || 0) * 0.5,
          mp_share: (i.total_profit || 0) * 0.5,
        }));

        res.json({ status: "success", data: formatted });
      } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
      }
    });

    // Export all vehicles to Excel file
    app.get("/api/export", async (req, res) => {
      try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Stock Data");

        sheet.columns = [
          { header: "Stock ID", key: "stock_id", width: 15 },
          { header: "Date Acquired", key: "date_acquired", width: 15 },
          { header: "Plate Number", key: "plate_number", width: 15 },
          { header: "Make & Model", key: "make_model", width: 30 },
          { header: "Source", key: "source", width: 15 },
          { header: "Purchase Price", key: "purchase_price", width: 15 },
          { header: "Recon Costs", key: "reconditioning_costs", width: 15 },
          { header: "Total Cost", key: "total_cost", width: 15 },
          { header: "Sale Price", key: "sale_price", width: 15 },
          { header: "Status", key: "status", width: 12 },
          { header: "Investor", key: "investor", width: 15 },
        ];

        const cars = await db.all(
          "SELECT * FROM cars ORDER BY date_acquired DESC",
        );
        sheet.addRows(cars);

        sheet.getRow(1).font = { bold: true };
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=DealerOS_Export.xlsx",
        );

        await workbook.xlsx.write(res);
        res.end();
      } catch (err) {
        res.status(500).send(err.message);
      }
    });

    // Sync database with Master Spreadsheet
    app.post("/api/sync", async (req, res) => {
      try {
        const filePath = path.join(
          __dirname,
          "Master_Spreadsheet_TRIAL_sanitised.xlsx",
        );
        const workbook = new ExcelJS.Workbook();

        if (fs.existsSync(filePath)) {
          await workbook.xlsx.readFile(filePath);
        } else {
          return res
            .status(404)
            .json({
              status: "error",
              message: "Master Spreadsheet not found on server",
            });
        }

        // Update Stock Data sheet
        let stockSheet = workbook.getWorksheet("Stock Data");
        if (stockSheet) {
          stockSheet.spliceRows(2, stockSheet.rowCount);
          const activeCars = await db.all(
            "SELECT * FROM cars WHERE status != 'Sold'",
          );
          activeCars.forEach((car) => {
            stockSheet.addRow([
              "",
              car.date_acquired,
              car.plate_number,
              car.make_model,
              car.source,
              car.px_value,
              car.purchase_price,
              car.reconditioning_costs,
              car.total_cost,
              "",
              car.status,
              car.investor,
              car.notes,
            ]);
          });
        }

        await workbook.xlsx.writeFile(filePath);

        res.json({
          status: "success",
          message: "Excel file synced successfully on server",
        });
      } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
      }
    });

    // Retrieve and manage vehicle viewings
    app.get("/api/viewings", async (req, res) => {
      try {
        const data = await db.all(
          "SELECT * FROM viewings ORDER BY viewing_date DESC",
        );
        res.json({ status: "success", data });
      } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
      }
    });

    app.post("/api/viewings", async (req, res) => {
      const {
        name,
        phone,
        vehicle,
        date,
        time,
        source,
        finance,
        delivery,
        notes,
        status,
        outcome,
      } = req.body;
      try {
        await db.run(
          `INSERT INTO viewings (name, phone, vehicle, viewing_date, viewing_time, source, finance, delivery, notes, status, outcome) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            name,
            phone,
            vehicle,
            date,
            time,
            source,
            finance,
            delivery,
            notes,
            status || "Booked",
            outcome || "Booked",
          ],
        );
        res.json({ status: "success" });
      } catch (err) {
        res.status(500).json({ status: "error" });
      }
    });

    // Retrieve and manage vehicle fines
    app.get("/api/fines", async (req, res) => {
      try {
        const data = await db.all(
          "SELECT * FROM fines ORDER BY date_issued DESC",
        );
        res.json({ status: "success", data });
      } catch (err) {
        res.status(500).json({ status: "error" });
      }
    });

    app.post("/api/fines", async (req, res) => {
      const {
        plate,
        type,
        date_issued,
        amount,
        due_date,
        reference,
        notes,
        status,
      } = req.body;
      try {
        await db.run(
          `INSERT INTO fines (plate, type, date_issued, amount, due_date, reference, notes, status) VALUES (?,?,?,?,?,?,?,?)`,
          [
            plate,
            type,
            date_issued,
            amount,
            due_date,
            reference,
            notes,
            status,
          ],
        );
        res.json({ status: "success" });
      } catch (err) {
        res.status(500).json({ status: "error" });
      }
    });

    app.post("/api/fines/update", async (req, res) => {
      const { id, status } = req.body;
      try {
        await db.run(`UPDATE fines SET status = ? WHERE id = ?`, [status, id]);
        res.json({ status: "success" });
      } catch (err) {
        res.status(500).json({ status: "error" });
      }
    });

    // Retrieve and manage vehicle logistics movements
    app.get("/api/movements", async (req, res) => {
      try {
        const data = await db.all(
          "SELECT * FROM movements ORDER BY scheduled_date DESC",
        );
        res.json({ status: "success", data });
      } catch (err) {
        res.status(500).json({ status: "error" });
      }
    });

    app.post("/api/movements", async (req, res) => {
      const {
        type,
        plate,
        model,
        date_won,
        scheduled_date,
        driver,
        address,
        cost,
        status,
        notes,
        linked_vehicles,
      } = req.body;
      try {
        await db.run(
          `INSERT INTO movements (type, plate, model, date_won, scheduled_date, driver, address, cost, status, notes, linked_vehicles) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            type,
            plate,
            model,
            date_won,
            scheduled_date,
            driver,
            address,
            cost,
            status,
            notes,
            linked_vehicles,
          ],
        );
        res.json({ status: "success" });
      } catch (err) {
        res.status(500).json({ status: "error" });
      }
    });

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
  });
