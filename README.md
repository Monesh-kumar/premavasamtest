# Premavasam • A Home of Love

> **"To Serve... Not to be Served"**  
> Registered Charitable Trust (Regd. No. 419 of 1999) caring for 200+ mentally challenged, physically challenged, and destitute children in Chennai, India.

---

## Overview

This repository contains the full-stack web application for **Premavasam**, meticulously rebuilt and styled using the **Yuna Nature organic design system** (inspired by Anariel Design's Yuna Nature block theme).

The application is completely self-contained with **zero external npm dependencies**, powered by Node.js and a high-performance **SQLite database running in Write-Ahead Logging (WAL) mode**.

---

## Key Features

- **Yuna Nature Organic Design Language**:
  - **Typography**: Fraunces display serif (`font-family: 'Fraunces', serif`) paired with Outfit geometric sans (`font-family: 'Outfit', sans-serif`).
  - **Color Palette**: Nature Green (`#0a9a48`), Deep Forest (`#183a22`), Terracotta (`#db3a0e`), Warm Gold (`#c89344`), and Linen/Cream (`#f8f5ef`).
  - **Interactive Elements**: 100px pill buttons, subtle hairline cards with 16–32px radii, sticky navbars with active page states.
- **Multi-Select Meal Sponsorship**:
  - Interactive tariff cards across 10 menu tiers (Breakfast, Festive Lunch, Non-Veg Feasts, Dinner, Evening Snacks, and Ice-Cream).
  - Multi-select capability allowing donors to sponsor any custom combination (e.g. Breakfast + Special Lunch + Ice-Cream) with live dynamic total calculation and itemized removal pills.
- **Transparent Donation Channels**:
  - 🇮🇳 **Domestic Banking**: Bank of Baroda account with 1-click clipboard copy and Section 80G tax exemption registration form.
  - 🌍 **International Giving**: Ministry of Home Affairs approved State Bank of India FCRA account with SWIFT and IFSC codes.
- **Pioneers of Love & Clinical Care**:
  - Dedicated leadership profiles featuring Founder Mr. Selvyn Roy, Director Indra, and General Coordinator Miss Mumtaj.
  - Complete showcase of clinical therapies: Physiotherapy, Occupational Therapy, Speech Therapy, Special Education, Dance & Music Therapy, and Vocational Training.
- **Filterable Media Gallery**:
  - Tabbed photo gallery with fullscreen modal lightbox.
- **Zero-Dependency Architecture**:
  - Built-in SQLite via Node.js `node:sqlite` (`DatabaseSync`).
  - WAL journal mode for instantaneous read/write concurrency.

---

## Project Structure

```
premavasam-webpage/
├── index.html            # Main landing page with hero, stats, and sponsorship planner
├── about.html            # Story, mission, history, and Pioneers of Love
├── sponsormeals.html     # Comprehensive meal menu with multi-select booking
├── activities.html       # Clinical therapies and special education
├── achievements.html     # Special Olympics, state awards, and milestones
├── gallery.html          # Categorized photo gallery with modal lightbox
├── volunteers.html       # Volunteer testimonials and application workflow
├── contact.html          # Directions, campus address, and message inquiry form
├── howhelp.html          # Domestic 80G & SBI FCRA accounts with registration
├── admin.html            # Internal back-office administration suite (/admin)
├── server.js             # Pure Node.js HTTP server & REST API endpoints
├── database.sqlite       # SQLite database (meals, donations, volunteers, contacts)
├── css/
│   └── styles.css        # Full Yuna Nature Design System stylesheet
├── images/               # High-resolution local image assets
│   ├── gallery/          # Categorized gallery photos
│   ├── logo.png          # Premavasam official emblem
│   └── mumtaj.jpg        # Face-centered leadership portrait
├── package.json          # Application configuration
└── README.md             # Project documentation
```

---

## REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/stats` | Real-time counts of children, pledged funds, and messages |
| `POST` | `/api/meals/book` | Records meal sponsorship reservation (`#MB-XXXX`) |
| `POST` | `/api/donations/record` | Registers domestic/FCRA contributions for 80G receipts (`#DON-XXX`) |
| `POST` | `/api/volunteers/apply` | Records volunteer service applications (`#VOL-XXX`) |
| `POST` | `/api/contacts/send` | Receives general inquiries and messages (`#MSG-XXX`) |

---

## Getting Started

### Prerequisites

- **Node.js 22.0.0+** (utilizes native `node:sqlite` DatabaseSync)

### Running Locally

1. Clone or download the repository:
   ```bash
   git clone <repository-url>
   cd premavasam-webpage
   ```

2. Start the local server:
   ```bash
   node server.js
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## Contact & Location

- **Address**: No. 15, Thiru V.K.A. Road, Gerugambakkam, Porur, Chennai – 600128, Tamil Nadu, India.
- **Phone**: +91 96772 38998 (9:00 AM – 8:00 PM IST)
- **Email**: premavasam1999@gmail.com
- **Website**: [https://www.premavasam.org](https://www.premavasam.org)
