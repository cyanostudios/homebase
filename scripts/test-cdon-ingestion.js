/**
 * Test script to simulate CDON order ingestion.
 * This allows testing status mapping and updates without needing real orders from CDON.
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Import the specific logic from the project
const CdonProductsController = require('../plugins/cdon-products/controller');
const OrdersModel = require('../plugins/orders/model');

async function testCdonIngestion() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = {
        query: async (sql, params) => {
            const res = await pool.query(sql, params);
            return res.rows;
        }
    };

    const controller = new CdonProductsController();
    const model = new OrdersModel();
    const userId = 1; // Assuming user ID 1 for testing

    // Mock Request object
    const mockReq = {
        session: { user: { id: userId } },
        tenantPool: pool // Some parts might use this
    };

    // 1. Mock CDON Order JSON (CREATED state)
    const mockCdonOrder = {
        OrderId: "CDON-TEST-12345",
        OrderNumber: "TEST-12345",
        State: "CREATED",
        Market: "SE",
        CreatedDateUtc: new Date().toISOString(),
        CustomerInfo: {
            ShippingAddress: {
                Name: "Test Testsson",
                Street: "Testgatan 1",
                ZipCode: "12345",
                City: "Teststad",
                Country: "SE"
            },
            EmailAddress: "test@example.com",
            Phones: { PhoneMobile: "0701234567" }
        },
        OrderRows: [
            {
                ProductId: "TEST-SKU-1",
                ProductName: "Test Produkt",
                Quantity: 1,
                Price: { amount: 100, vat_amount: 25, currency: "SEK" }
            }
        ]
    };

    console.log('--- Phase 1: Ingesting CREATED order ---');
    const normalized = await controller.normalizeCdonOrderToHomebase(mockCdonOrder, userId, db);
    const res1 = await model.ingest(mockReq, normalized);
    console.log('Ingest Result (CREATED):', res1);

    // 2. Mock CDON Order JSON (FULFILLED state - should map to 'delivered')
    console.log('\n--- Phase 2: Updating to FULFILLED (should become Delivered) ---');
    mockCdonOrder.State = "FULFILLED";
    const normalized2 = await controller.normalizeCdonOrderToHomebase(mockCdonOrder, userId, db);
    const res2 = await model.ingest(mockReq, normalized2);
    console.log('Ingest Result (FULFILLED):', res2);

    await pool.end();
}

testCdonIngestion().catch(console.error);
