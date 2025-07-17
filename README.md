# RetailPilot: AI-Powered Shop Management

RetailPilot is a modern, lightweight shop management application designed for small retail businesses. It simplifies inventory, billing, and customer/supplier management, offering a clean user interface and a powerful AI chatbot for natural language-based operations.

This project is built as a simpler, more intuitive alternative to complex ERPs, with an initial focus on the needs of a small retail shop (e.g., a Saree shop), but is generic enough for many small businesses.

## 🌟 Key Features

RetailPilot provides all the essential tools for a small business to manage its day-to-day operations efficiently.

*   **📈 Simple Analytics Dashboard:** Get a quick overview of your business health with KPIs like Total Revenue, COGS, and Gross Profit. View top-selling items and low-stock alerts.
*   **📦 Inventory Management:** Track products, stock levels, purchase/selling prices (both retail & wholesale), and receive low-stock alerts.
*   **🧾 Billing & Invoicing:** Easily create, manage, and print professional Sales Invoices and log Purchase Bills.
*   **👥 Customer & Supplier Management:** Maintain a complete directory of your customers and suppliers with their transaction history.
*   **📒 Ledgers & Payments:** Automatically maintain ledgers for each customer and supplier. Track outstanding balances and record payments with ease.
*   **↩️ Return Management:** Handle sales returns (Credit Notes) smoothly, which automatically adjusts inventory and customer ledgers.
*   **⚙️ Company Profile:** Configure your shop's details, tax rates, and bank information to appear on invoices.

## 💬 The Chatbot Advantage

The standout feature of RetailPilot is its integrated LLM-powered chatbot. Instead of navigating menus and filling out forms, you can manage your entire shop using simple, natural language commands.

**Why is this a game-changer?**
*   **Speed:** Perform complex actions in seconds.
*   **Ease of Use:** No learning curve. If you can text, you can use RetailPilot.
*   **Efficiency:** Perfect for busy shop owners who need to quickly add a sale or check a customer's balance while on the move.

### Example Chatbot Commands:

> `"Create a new sales invoice for customer 'Rajesh Kumar' with 2 'Kanjivaram Silk' sarees."`

> `"What is the outstanding balance for 'Anjali Traders'?"`

> `"Show me my top 5 selling items this month."`

> `"Add 50 pieces of 'Banarasi Georgette' to the inventory from supplier 'Surat Textiles'."`

> `"Which items are low in stock?"`

## 🛠️ Tech Stack

*   **Backend:** **Flask** (Python) - A lightweight WSGI web application framework.
*   **Frontend:** **React** - A JavaScript library for building user interfaces.
*   **Database:** **PostgreSQL** / **Supabase** (or SQLite for simple development).
*   **ORM:** **SQLAlchemy** (Recommended for Flask).
*   **AI/LLM:** An API integration with a large language model provider (e.g., **OpenAI**, **Anthropic**, **Google Gemini**).
*   **State Management (Frontend):** Redux Toolkit / Zustand (Recommended).

## 🚀 Getting Started

Follow these instructions to get a local copy up and running for development and testing purposes.


### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/Satyam-Rastogi/RetailPilot.git
    cd RetailPilot
    ```

2.  **Setup the Backend (Flask):**
    ```sh
    # Navigate to the backend directory
    cd backend

    # Create and activate a virtual environment
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

    # Install Python dependencies
    pip install -r requirements.txt

    # Create a .env file from the example
    cp .env.example .env
    ```
    Now, edit the `.env` file and add your configuration details:
    ```.env
    DATABASE_URL="your_database_connection_string"
    SECRET_KEY="a_very_secret_key_for_sessions"
    LLM_API_KEY="your_llm_provider_api_key"
    ```

    **Run the backend server:**
    ```sh
    flask run
    ```
    The backend API will be running on `http://127.0.0.1:5000`.

3.  **Setup the Frontend (React):**
    ```sh
    # Navigate to the frontend directory from the root
    cd frontend

    # Install npm packages
    pnpm install
    ```
    
    **Run the frontend development server:**
    ```sh
    pnpm run dev
    ```
    Open your browser and navigate to `http://localhost:3000` to see the application.

## 🗺️ Roadmap / Future Work

This project is currently an MVP. Future enhancements may include:

*   **Better Database Management (using PostgreSQL and Redis)**
*   **User Roles & Permissions** (Admin vs. Staff)
*   **Data Import/Export** via CSV
*   **Barcode Scanning** Integration
*   **Purchase Returns** (Debit Notes)
*   Advanced **COGS Calculation** (FIFO, Weighted Average)
*   Deeper **Analytics & Custom Reports**
*   **Payment Gateway** Integration
*   **Expense Tracking** (beyond COGS)
*   Item Variations (Size, Color, etc.)
