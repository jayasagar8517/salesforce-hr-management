# Salesforce HR Management System

A Salesforce-based HR Management solution with Lightning Web Components (LWC), supporting recruitment, employee records, attendance tracking, and more.

🔗 [Live Demo Website](https://jayasagarmvn-dev-ed.develop.my.site.com/LWCAppvforcesite)

---

## Features

### 1. Recruitment
- Add employee information: First Name, Last Name, Email, Phone, Department, Joining Date, CTC, Address.
- Sends email to new employee with their login credentials upon submission.

### 2. Employees
- Displays a table of all employees.
- Easy viewing and sorting of employee data.

### 3. Attendances
- Employee login with email & password.
- "Forgot password" feature emails new password.
- Post-login: view attendance table with login/logout time and total hours.
- Leave Management:
  - Apply for leave (Start date, End date, Reason, Type).
  - View history of approved leaves.
- Download Offer Letter as PDF.
- Select multiple months and download payslips in bulk.

---

## Technologies Used

- **Salesforce DX**
- **Lightning Web Components (LWC)**
- **Apex Classes**
- **Email Services**
- **PDF Generation (JSPDF)**
- **Custom Metadata and Objects**

---

## Setup Instructions

1. Authenticate with your Salesforce Org:
   ```bash
   sfdx force:auth:web:login -a HROrg
