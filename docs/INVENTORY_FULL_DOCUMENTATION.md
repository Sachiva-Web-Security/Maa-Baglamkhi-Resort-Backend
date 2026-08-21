# Inventory Full Documentation

## Purpose

This document explains how to use the inventory module end to end:

- what each inventory section is for
- what data should be filled in each form
- which fields are required
- what each value means
- which actions actually change stock
- how reports are calculated
- the recommended data-entry order for accurate inventory

This documentation is based on the current app implementation in:

- `Maa-Baglamkhi-Resort-frontend/src/components/Inventory/InventoryDashboard.jsx`
- `Maa-Baglamkhi-Resort-Backend/controller/inventoryController.js`
- `Maa-Baglamkhi-Resort-Backend/models/InventoryModel.js`
- `Maa-Baglamkhi-Resort-Backend/routes/inventoryRoutes.js`

## Inventory Module Structure

The inventory area is organized into these major groups:

1. Master Setup
2. Item Setup
3. Purchase and Procurement
4. Stock Movement
5. Waste and Audit
6. Reports

## Recommended Data Entry Order

For correct and real inventory reporting, fill data in this order:

1. `Segments`
2. `Units`
3. `Store / Kitchen`
4. `Item Groups`
5. `Ingredients`
6. `Vendors`
7. `Purchase Items`
8. `Purchase Services`
9. `Items`
10. `Purchase Orders`
11. `Vendor Inwards`
12. `Vendor Payments`
13. `Stock Transfer`
14. `Waste / Spoilage`
15. `Stock Audit`

Why this order matters:

- master records make dropdowns cleaner
- item master defines current stock, unit, price, reorder point, store
- vendor inward creates real incoming stock
- waste reduces stock
- transfers create movement records
- audit compares physical stock with system stock

## Important Rule: What Actually Changes Stock

These actions affect stock:

- creating a new `Item` with starting stock
- updating item stock manually
- creating `Vendor Inward`
- creating `Waste / Spoilage`
- creating `Stock Transfer`
- menu recipe consumption logs when used by kitchen flow

These actions do not directly change stock:

- creating `Vendor`
- creating `Purchase Item`
- creating `Purchase Service`
- creating `Purchase Order`
- creating `Vendor Payment`

## Section-by-Section Filling Guide

## 1. Segments

Use this to create top-level material categories.

Fields:

- `Segment Name` (required)
  Meaning: top-level business bucket like Food, Beverage, Housekeeping
  Example: `Food`
- `Description`
  Meaning: short explanation of the segment
  Example: `Kitchen raw material`
- `Status`
  Meaning: whether this segment should be actively used
  Options: `Active`, `Inactive`

When to fill:

- during initial setup
- only when you need a new major category

## 2. Vendors

Use this to maintain supplier master data.

Fields:

- `Vendor Name` (required)
  Example: `Fresh Farm Supply`
- `Contact Person`
  Example: `Ravi Singh`
- `Phone`
  Example: `9876543210`
- `Email`
  Example: `ravi@freshfarm.com`
- `City`
  Example: `Varanasi`
- `GSTIN`
  Example: `22AAAAA0000A1Z5`
- `Status`
  Options: `Active`, `On Hold`, `Blacklisted`

When to fill:

- before purchase orders
- before vendor inward
- before vendor payments

## 3. Units

Use this to standardize quantity format across inventory.

Fields:

- `Unit Name` (required)
  Example: `Kilogram`
- `Short Name` (required)
  Example: `kg`
- `Type`
  Options: `Weight`, `Volume`, `Count`

Examples:

- `Kilogram` / `kg`
- `Litre` / `ltr`
- `Piece` / `pcs`

## 4. Store / Kitchen

Use this to define stock locations.

Fields:

- `Store Name` (required)
  Example: `Main Store`
- `Type`
  Options: `Store`, `Kitchen`, `Bar`, `Banquet`
- `Manager`
  Example: `Chef Arjun`
- `Status`
  Options: `Open`, `Closed`

Use cases:

- Main Store
- Live Kitchen
- Bar Counter
- Banquet Store

## 5. Item Groups

Use this to group ingredients and stock items under a functional bucket.

Fields:

- `Group Name` (required)
  Example: `Dry Store`
- `Segment`
  Example: `Food`
- `Status`
  Options: `Active`, `Inactive`

## 6. Ingredients

Use this to maintain ingredient names and units.

Fields:

- `Ingredient Name` (required)
  Example: `Paneer`
- `Group`
  Example: `Cold Storage`
- `Unit`
  Example: `kg`
- `Status`
  Options: `Active`, `Inactive`

## 7. Purchase Items

Use this to record item-wise procurement references and vendor-wise purchase history.

Fields:

- `Item Name` (required)
  Example: `Paneer`
- `Vendor` (required)
  Example: `Fresh Farm Supply`
- `Quantity` (required)
  Example: `20`
- `Unit`
  Example: `kg`
- `Rate / Unit (Rs)` 
  Example: `500`
- `Total Amount (Rs)` (required)
  Formula: `quantity x rate`
  Example: `10000`
- `Invoice No`
  Example: `INV-1024`
- `Date` (required)
  Example: `2026-04-09`

Important:

- this is purchase history/reference data
- this does not by itself add stock
- actual stock comes from `Vendor Inward`

## 8. Purchase Services

Use this for non-stock purchases like transport, repair, AMC, service bills.

Fields:

- `Service Name` (required)
  Example: `Deep Freezer Repair`
- `Vendor` (required)
- `Amount (Rs)` (required)
- `Date` (required)
- `Status`
  Options: `Pending`, `Completed`, `Cancelled`

Important:

- service entries do not affect stock quantity

## 9. Items

This is the main stock item master.

Fields:

- `Item Name` (required)
  Example: `Paneer`
- `Category` (required)
  Example: `Banquet Crockery` or `Dairy`
- `Current Stock` (required)
  Meaning: starting stock when creating a new item, or actual stock when manually editing
  Example: `8`
- `Unit` (required)
  Example: `kg`
- `Price / Unit (Rs)` (required)
  Example: `500`
- `Reorder Point`
  Meaning: minimum safe stock level
  Example: `7`
- `Expiry Date`
  Example: `2026-04-20`
- `Store / Branch` (required)
  Example: `Main Store`

Important stock behavior:

- when you create a new item with `Current Stock > 0`, the system writes an `opening_balance` ledger entry
- that starting quantity becomes the base opening stock for reports

Recommended use:

- create each item once
- avoid repeatedly editing stock manually unless it is a correction
- after setup, use inward, waste, transfer, and consumption flows for movement

## 10. Purchase Orders

Use this to create procurement requests before stock is received.

Fields:

- `PO Number` (required)
  Example: `PO-2026-001`
- `Vendor` (required)
- `Item Name` (required)
- `Quantity` (required)
- `Unit`
- `Rate / Unit (Rs)` (required)
- `Expected Delivery`
- `Status`
  Options: `Draft`, `Sent`, `GRN Received`, `Closed`, `Cancelled`

Important:

- PO does not increase stock
- stock increases only when `Vendor Inward` is saved

## 11. Vendor Inward

This is the real stock receipt screen. This is the most important stock-in form.

Fields:

- `PO Number`
  Optional link to existing purchase order
- `Vendor` (required)
- `Item Name` (required)
- `Quantity Received` (required)
  Example: `13`
- `Unit`
  Example: `kg`
- `Rate / Unit (Rs)`
- `Amount (Rs)`
  Usually auto-calculated from quantity x rate
- `Invoice No`
- `Batch No`
- `Expiry Date`
- `Received Date` (required)
- `Store`
- `Remarks`

What happens on save:

- if item matches an existing inventory item, stock increases
- ledger entry is written with `referenceType = vendor_inward`
- vendor report and stock flow report update

Best practice:

- always fill `Received Date`
- always fill `Invoice No` if vendor gives one
- use correct `Batch No` and `Expiry Date` for food and medicine-like items

## 12. Vendor Payments

Use this to track payment against vendor invoices.

Fields:

- `Vendor` (required)
- `Invoice Ref`
- `Payment Date` (required)
- `Amount (Rs)` (required)
- `Payment Mode`
  Options: `Bank Transfer`, `Cash`, `UPI`, `Cheque`
- `Status`
  Options: `Scheduled`, `Paid`, `Partial`, `Cancelled`
- `Notes`

Important:

- this does not change stock
- this helps accounts and vendor due tracking

## 13. Stock Transfer

Use this when moving stock from one location to another.

Fields:

- `Item Name` (required)
- `From Department` (required)
- `To Department` (required)
- `Quantity` (required)
- `Unit`
- `Approved By`
- `Notes`
- `Date` (required)

What happens on save:

- ledger writes `transfer_out`
- ledger writes `transfer_in`
- movement history is stored

Important:

- transfer is location movement
- use this when stock changes store/kitchen ownership

## 14. Waste / Spoilage

Use this when stock becomes unusable.

Fields:

- `Item Name` (required)
- `Quantity Lost` (required)
- `Unit`
- `Reason`
  Options: `Expired`, `Spoiled`, `Damaged`, `Overcooked`, `Spilled`, `Other`
- `From Store`
- `Remarks`
- `Date` (required)

What happens on save:

- stock reduces
- ledger writes `waste` as `OUT`

Best practice:

- always use waste for actual loss
- do not reduce stock manually if it is spoilage

## 15. Stock Audit

Use this to compare system stock and physical stock.

Fields saved per item:

- `Item`
- `System Stock`
- `Physical Stock`
- `Variance`
- `Unit`
- `Remarks`

Meaning:

- `System Stock` = software stock
- `Physical Stock` = actual counted stock
- `Variance` = `physical - system`

Use this:

- daily for high-value items
- weekly for kitchen store
- monthly for full inventory

## 16. Menu Items

This is related to restaurant/kitchen selling items.

Fields:

- `Dish Name` (required)
- `Category` (required)
- `Price` (required)
- `Upload Image`
- `Image URL`
- `Description`
- `Food Type`
  Options: `Veg`, `Non Veg`, `Egg`
- `Status`
  Options: `Available`, `Out of Stock`

Important:

- this is customer-facing menu setup
- inventory impact comes only when recipes/consumption are applied

## 17. Menu Categories

Use this to group dishes in the restaurant menu.

Fields:

- `Category Name` (required)
- `Parent Group`
- `Status`
  Options: `Active`, `Inactive`

## Reports: Meaning and How to Read Them

## Vendor Report

Shows vendor-wise purchase and service spend.

Use it for:

- comparing vendor business volume
- follow-up on inactive vendors
- procurement review

## Stock Report

This is the real stock flow report.

Columns:

- `Opening Qty`
- `Received Qty`
- `Used Qty`
- `Remaining Stock`
- `Unit Rate`
- `Amount`
- `Reorder Point`
- `Store`
- `Alert`

Meaning:

- `Opening Qty` = stock before selected period starts
- `Received Qty` = total stock added during selected period
- `Used Qty` = total stock issued/consumed/wasted out during selected period
- `Remaining Stock` = `opening + received - used`
- `Amount` = `remaining stock x unit rate`

Important:

- this report supports `Date From` and `Date To`
- without dates, it shows overall running stock flow

## Closing Stock Report

Shows item closing view. Use for period-end review.

## Item Report

Shows item-level master data such as category, unit, rate, expiry, and status.

## Expiring Soon Report

Shows items nearing expiry or already expired.

Use it for:

- FIFO checking
- quick kitchen action
- loss prevention

## Batch Expiry Report

Shows inward batch details with invoice and expiry tracking.

Use it for:

- food safety traceability
- old batch identification

## Consumption Report

Shows item-level consumption estimates or recipe-driven usage.

## Total Consumption Report

Shows total combined usage across records.

## Item Audit Report

Shows saved audit results:

- audit date
- physical stock
- system stock
- variance
- status
- remarks

## How Opening Qty Works

Opening quantity means:

- stock available before the report period starts

How it gets added:

- when a new inventory item is created with starting stock, the system saves an `opening_balance` ledger entry
- that opening entry is treated as the first stock-in baseline

Example:

- item created with stock `8 kg`
- later inward `13 kg`
- later used `11 kg`

Then:

- opening = `8 kg`
- received = `13 kg`
- used = `11 kg`
- remaining = `10 kg`

## Daily Operating SOP

Use this daily process for clean inventory data:

1. Create PO before ordering if approval workflow is needed.
2. When goods arrive, fill `Vendor Inward`.
3. If payment is made, fill `Vendor Payment`.
4. If stock moves store-to-kitchen, fill `Stock Transfer`.
5. If anything is spoiled or damaged, fill `Waste / Spoilage`.
6. Review `Stock Report`.
7. Review `Low Stock` and `Expiring Soon`.
8. Run `Stock Audit` for important items.

## Data Accuracy Rules

To keep reports correct:

- do not use `Current Stock` edit for normal daily movement
- use `Vendor Inward` for all incoming stock
- use `Waste` for stock loss
- use `Transfer` for location movement
- use `Stock Audit` for correction verification
- keep unit consistent for the same item
- avoid duplicate item names with different spelling

Good examples:

- `Paneer`
- `Basmati Rice`
- `Cold Drink 750ml`

Bad examples:

- `paneer`
- `Paneer `
- `PANEER`

## Suggested Naming Standards

For best matching and reporting:

- item names: use one standard spelling
- vendors: use one standard billing name
- units: use one standard short name
- stores: use one official location name

## User Roles

Reading inventory data is allowed for:

- `admin`
- `manager`
- `kitchen`
- `accountant`
- `receptionist`

Editing is generally allowed for:

- `admin`
- `manager`
- `receptionist`

Some stock movement actions also allow:

- `kitchen`

## API Reference Summary

Main endpoints:

- `GET /api/inventory`
- `POST /api/inventory`
- `PUT /api/inventory/:id`
- `DELETE /api/inventory/:id`
- `GET /api/inventory/waste`
- `POST /api/inventory/waste`
- `GET /api/inventory/purchase-orders`
- `POST /api/inventory/purchase-orders`
- `GET /api/inventory/vendor-inwards`
- `POST /api/inventory/vendor-inwards`
- `GET /api/inventory/vendor-payments`
- `POST /api/inventory/vendor-payments`
- `GET /api/inventory/transfers`
- `POST /api/inventory/transfers`
- `GET /api/inventory/stock-ledger`
- `GET /api/inventory/reports/stock-flow`
- `GET /api/inventory/vendor-insights`
- `POST /api/inventory/audit`
- `GET /api/inventory/audit/report`

## Final Recommendation

If you want the cleanest real inventory workflow, train your team to use only these four movement screens for daily work:

1. `Vendor Inward`
2. `Stock Transfer`
3. `Waste / Spoilage`
4. `Stock Audit`

Keep `Items` only for:

- initial setup
- controlled corrections

That will keep:

- opening stock correct
- received stock correct
- used stock correct
- remaining stock correct
- report amount correct

