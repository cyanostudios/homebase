/**
 * Verification script for order grouping logic.
 * Mocks the logic used in CDON/Fyndiq controllers to ensure it groups correctly.
 */

const assert = (condition, message) => {
    if (!condition) {
        console.error('❌ FAIL:', message);
        process.exit(1);
    }
    console.log('✅ PASS:', message);
};

// Simulated CDON grouping logic
const getGroupKeyCdon = (o) => {
    const g = o?.OrderGroupId ?? o?.orderGroupId ?? o?.parent_order_id ?? o?.parentOrderId ?? o?.group_id ?? o?.groupId ?? o?.customer_id ?? o?.customerId;
    if (g != null) return `id:${g}`;

    const ci = o?.CustomerInfo ?? o?.customer_info ?? o?.customerInfo ?? {};
    const ship = ci?.ShippingAddress ?? ci?.shipping_address ?? ci?.shippingAddress ?? o?.shipping_address ?? {};
    const phones = ci?.Phones ?? ci?.phones ?? {};
    const phone = String(ship?.phone_number ?? ship?.phoneNumber ?? phones?.PhoneMobile ?? phones?.phone_mobile ?? phones?.phoneMobile ?? phones?.PhoneWork ?? phones?.phone_work ?? phones?.phoneWork ?? '').trim();
    const fName = String(ship?.first_name ?? ship?.firstName ?? ship?.Name ?? ship?.name ?? '').trim();
    const lName = String(ship?.last_name ?? ship?.lastName ?? '').trim();
    const name = `${fName} ${lName}`.trim().toLowerCase();

    const dt = o?.CreatedDateUtc ?? o?.created_date_utc ?? o?.createdDateUtc ?? o?.OrderDate ?? o?.order_date ?? o?.orderDate ?? o?.created_at;
    const hour = dt ? new Date(dt).toISOString().slice(0, 13) : '';

    if (phone || name) return `match:${phone}|${name}|${hour}`;
    return `alone:${o?.id}`;
};

// --- Test Cases ---

console.log('Testing CDON Grouping...');

const order1 = {
    id: '140',
    order_date: '2026-02-04T15:05:00Z',
    shipping_address: { first_name: 'John', last_name: 'Doe', phone_number: '123456' }
};

const order2 = {
    id: '142',
    order_date: '2026-02-04T15:45:00Z',
    shipping_address: { first_name: 'John', last_name: 'Doe', phone_number: '123456' }
};

const order3 = {
    id: '145',
    order_date: '2026-02-04T16:05:00Z', // Different hour
    shipping_address: { first_name: 'John', last_name: 'Doe', phone_number: '123456' }
};

const key1 = getGroupKeyCdon(order1);
const key2 = getGroupKeyCdon(order2);
const key3 = getGroupKeyCdon(order3);

assert(key1 === key2, 'Orders 140 and 142 should share the same key (same name, phone, hour)');
assert(key1 !== key3, 'Order 145 should have a different key (different hour)');

const orderExplicitId1 = { id: '200', customer_id: 'CUST-001' };
const orderExplicitId2 = { id: '201', customer_id: 'CUST-001' };

assert(getGroupKeyCdon(orderExplicitId1) === getGroupKeyCdon(orderExplicitId2), 'Orders with same Customer ID should share the same key');

console.log('\nTesting Timing Fix...');

// Simulate how OrdersModel.toISOUTC and ingest work
const toISOUTC = (val) => {
    if (val == null) return null;
    const s = String(val).trim();
    if (s.endsWith('Z') || s.endsWith('z')) return s;
    return s.replace(' ', 'T') + 'Z';
};

const dt1Str = '2026-02-04 12:51:00'; // CDON style (wanted 13:51 local)
const dt1Iso = toISOUTC(dt1Str);
const dt1 = new Date(dt1Iso);

// In Sweden (UTC+1), toLocaleString() should show 13:51 if it was 12:51 UTC
// Since this script runs on the user's machine, we can check toLocaleString()
const localStr = dt1.toLocaleString();
console.log(`Input: ${dt1Str} -> Normalized: ${dt1Iso} -> Local: ${localStr}`);

// If it's correctly normalized to Z, then even in Stockholm it will be 13:51
// Note: We can't strictly assert the exact string because locale formats vary,
// but we can check the time parts if we know the locale.
// Instead, let's just assert that it's NOT NaN and has the expected UTC hour.
assert(dt1.getUTCHours() === 12, 'Normalized date should have UTC hour 12');

console.log('\nAll tests passed successfully!');
