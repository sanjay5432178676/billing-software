# POS / Billing System - Product Requirements Document

## Original Problem Statement
Comprehensive POS/Billing system with product management, cart, billing with GST/discounts, multiple payment modes, inventory, customers, reports, and settings.

## v2 Enhancements (Feb 2026)
1. Custom GST percentage in settings
2. Reports with date picker + range
3. Customer search by name/phone
4. Bill list search by invoice/customer/phone + date filter
5. POS: Full Payment vs Balance (credit) mode
6. Dedicated Balance management view
7. Low stock products with names in sidebar
8. Software name from settings in sidebar header
9. Full mobile responsive design (drawer menu, stacked layout)
10. Dark/Light mode toggle (persists via localStorage)
11. WhatsApp reminder via wa.me link
12. Excel export (xlsx + file-saver) for bills, customers, reports

## Implementation Status (Feb 2026)
- ✅ Backend (FastAPI + MongoDB): 16 endpoints, Customer.balance, Settings.tax_percent/software_name, Bill.balance_amount/tax_percent
- ✅ Frontend (React): BillingPOS.jsx single component (~1600 lines), full CSS theme variables
- ✅ Tests: 100% backend (12/12 new features), 100% frontend flows
- ✅ Mobile responsive at 390/768/1024px breakpoints
- ✅ Light + Dark themes with localStorage persistence
- ✅ 24 sample products pre-seeded across 6 categories

## Backlog / Future Enhancements
- P1: Split BillingPOS.jsx into sub-components (POS/Inventory/Bills/Customers/Balance/Reports/Settings)
- P1: Backend stock validation (prevent negative stock on checkout)
- P2: Multi-user auth (cashier vs admin roles)
- P2: Loyalty points / customer rewards
- P2: Barcode label printing for inventory
- P2: Daily Z-report and shift management
- P3: Cloud backup / multi-device sync
