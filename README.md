# 🔐 Secure Login & Signup System (Node.js & MySQL)

This project is a robust and secure user authentication system built with Node.js, Express, and MySQL. It provides the essential backend functionality for user registration and login, featuring strong password hashing with `bcrypt` to ensure user data is protected.

This repository serves as a practical example of building a core feature for modern web applications.

---

## ✨ Core Features

* **User Registration:** Allows new users to create an account with a unique username and a secure password.
* **User Login:** Authenticates existing users and provides a foundation for session management.
* **Secure Password Storage:** All passwords are automatically hashed using the industry-standard `bcrypt` algorithm. Plain-text passwords are never stored.
* **Structured Backend:** The code is organized logically for clarity and scalability.
* **Simple Frontend:** Includes a minimal HTML/CSS interface to interact with the backend API.

---

## 🛠️ Technology Stack

* **Backend:** Node.js, Express.js
* **Database:** MySQL
* **Security:** [bcrypt.js](https://www.npmjs.com/package/bcrypt) for password hashing
* **Frontend:** HTML, CSS, JavaScript

---

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Ensure you have the following software installed on your machine:
* [Node.js](https://nodejs.org/) (which includes `npm`)
* [Git](https://git-scm.com/)
* A running instance of a MySQL Server.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/muhamed97/LoginandsignupprojectNODEJS.git](https://github.com/muhamed97/LoginandsignupprojectNODEJS.git)
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd LoginandsignupprojectNODEJS
    ```

3.  **Install NPM packages:**
    ```bash
    npm install
    ```

4.  **Set up the Database:**
    * Connect to your local MySQL server.
    * Create a new database for the project.
        ```sql
        CREATE DATABASE nodejs_login;
        ```
    * Use the created database and then create the `users` table with the following schema:
        ```sql
        USE nodejs_login;

        CREATE TABLE `users` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `username` VARCHAR(50) NOT NULL UNIQUE,
            `password` VARCHAR(255) NOT NULL
        );
        ```

5.  **Configure Database Connection:**
    * Open the `backend/app.js` file.
    * Locate the `mysql.createConnection` block and ensure the `host`, `user`, `password`, and `database` fields match your local MySQL setup.

6.  **Run the application:**
    ```bash
    node backend/app.js
    ```
    You should see a confirmation message in your terminal, like `Bank API server started on port 5000`.

7.  **Access the application:**
    Open your browser and navigate to `http://localhost:5000`. You're all set!

---

## 👤 Author

**Mohamed**

* GitHub: [@muhamed97](https://github.com/muhamed97)
