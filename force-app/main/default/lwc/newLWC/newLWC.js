import { LightningElement, wire, track, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import addEmployee from '@salesforce/apex/EmployeeController.addEmployee';
import getEmployees from '@salesforce/apex/EmployeeController.getEmployees';
import loginEmployee from '@salesforce/apex/EmployeeController.loginEmployee';
import logAttendance from '@salesforce/apex/EmployeeController.logAttendance';
import getAttendanceRecords from '@salesforce/apex/EmployeeController.getAttendanceRecords';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadScript } from 'lightning/platformResourceLoader';
import JS_PDF_RESOURCE from '@salesforce/resourceUrl/js_pdf';
import generateOfferLetter from '@salesforce/apex/EmployeeController.generateOfferLetter';
import getEmployeeIdByEmail from '@salesforce/apex/EmployeeController.getEmployeeIdByEmail';
import getEmployeeDetails from '@salesforce/apex/GeneratePayslipController.getEmployeeDetails';
import getAbsentDays from '@salesforce/apex/GeneratePayslipController.getAbsentDays';
import employeesIcon from '@salesforce/resourceUrl/employeesIcon';
import attendancesIcon from '@salesforce/resourceUrl/attendancesIcon';
import recruitmentIcon from '@salesforce/resourceUrl/recruitmentIcon';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import EMPLOYEE_OBJECT from '@salesforce/schema/Employee__c';
import DEPARTMENT_FIELD from '@salesforce/schema/Employee__c.Department__c';
import resetEmployeePassword from '@salesforce/apex/EmployeeController.resetEmployeePassword';
import getDepartmentPicklistValues from '@salesforce/apex/EmployeeController.getDepartmentPicklistValues';


let jsPDFInstance;

export default class NewLWC extends LightningElement {
    //payslipstart
    @track absentDays;
    //workingDays;
    @api recordId;
    @api employeeId;
    @api employeeName;
    @api email;
    @api department;
    @api joiningDate;
    @api totalCtc;
    @api basicSalary;
    @api hra;
    @api specialAllowance;
    @api medicalAllowance;
    @api employerPf;
    @api employeePf;
    @api professionalTax;
    @api incomeTax;
    @api netSalary;
    @api employee;
    @track availableMonths = [];
    @track selectedMonths;
    @track monthOptions = [];
    isLoggedIn = false;
    jsPDFInitialized = false;
    jsPdfLib;
    //completeName = this.employee.First_Name__c + this.employee.Last_Name__c;

    showFlow = false;
    get completeName() {
        if (this.employee) {
            return `${this.employee.First_Name__c} ${this.employee.Last_Name__c}`;
        }
        return '';
    }



    renderedCallback() {
        if (this.jsPDFInitialized) return;
        this.jsPDFInitialized = true;

        loadScript(this, JS_PDF_RESOURCE)
            .then(() => {
                this.jsPdfLib = window.jspdf?.jsPDF || window.jsPDF;
                if (!this.jsPdfLib) {
                    console.error('❌ jsPDF not available.');
                }
            })
            .catch((error) => {
                console.error('❌ Error loading jsPDF:', error);
            });
    }

    getMonthsSinceJoining(joiningDate) {
        if (!joiningDate) return [];

        const startDate = new Date(joiningDate);
        const endDate = new Date();
        const months = [];
        const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

        while (current <= endDate) {
            const label = current.toLocaleString('default', { month: 'long', year: 'numeric' });
            const value = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            months.push({ label, value });
            current.setMonth(current.getMonth() + 1);
        }

        return months;
    }

    handleMonthChange(event) {
        this.selectedMonths = event.detail.value;
    }

    get workingDays() {
        if (!this.selectedMonth || !this.selectedYear) return 0;
        // Get number of days in the selected month
        return new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    }
    
    getMonthlyPayslipData() {
        const annual = this.employee;
        if (!annual) return null;
    
        const workingDays = this.workingDays;
        const effectiveDays = workingDays - this.absentDays;
    
        const prorate = (amount) => ((amount / 12) / workingDays * effectiveDays).toFixed(2);
    
        return {
            basic: prorate(annual.Basic_Salary__c),
            hra: prorate(annual.HRA__c),
            specialAllowance: prorate(annual.Special_Allowance__c),
            medical: prorate(annual.Medical_Allowance__c),
            employerPf: prorate(annual.Employer_PF__c),
            employeePf: prorate(annual.Employee_PF__c),
            professionalTax: prorate(annual.Professional_Tax__c),
            incomeTax: prorate(annual.Income_Tax__c),
            netSalary: prorate(annual.Net_Salary__c),
            totalCtc: prorate(annual.Total_CTC__c)
        };
    }
    
    async downloadPayslips() {
        const employee = this.employee;
        let index = 0;
    
        const downloadNext = async () => {
            if (index >= this.selectedMonths.length) return;
    
            const monthValue = this.selectedMonths[index];
            const [year, month] = monthValue.split('-').map(Number);
    
            // Set selected month and year for workingDays getter
            this.selectedMonth = month;
            this.selectedYear = year;
    
            // Fetch Absent Days for that specific month
            const absentDays = await getAbsentDays({ employeeId: employee.Id, year, month });
            this.absentDays = absentDays;
    
            const monthlyData = this.getMonthlyPayslipData(); // Will use updated this.absentDays
    
            const date = new Date(year, month - 1);
            const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text('Monthly Payslip', 80, 20);
    
            doc.setFontSize(12);
            doc.text(`Month: ${monthYear}`, 20, 30);
            doc.text(`Name: ${this.employee.First_Name__c} ${this.employee.Last_Name__c}`, 20, 40);
            doc.text(`Employee ID: ${this.employee.Id}`, 20, 46);
            doc.text(`Email: ${this.employee.Email__c}`, 20, 52);
            doc.text(`Department: ${this.employee.Department__c}`, 20, 58);
            doc.text(`Joining Date: ${this.employee.Joining_Date__c}`, 20, 64);
            doc.text(`Working Days: ${this.workingDays}`, 20, 70);
            doc.text(`Absent Days: ${absentDays}`, 120, 70);
    
            const startX = 20;
            const startY = 85;
            const rowHeight = 8;
            const col1Width = 80;
            const col2Width = 60;
    
            const salaryData = [
                ['Basic Salary', `Rs. ${monthlyData.basic}`],
                ['HRA', `Rs. ${monthlyData.hra}`],
                ['Special Allowance', `Rs. ${monthlyData.specialAllowance}`],
                ['Medical Allowance', `Rs. ${monthlyData.medical}`],
                ['Employer PF', `Rs. ${monthlyData.employerPf}`],
                ['Employee PF', `Rs. ${monthlyData.employeePf}`],
                ['Professional Tax', `Rs. ${monthlyData.professionalTax}`],
                ['Income Tax', `Rs. ${monthlyData.incomeTax}`],
                ['Net Salary', `Rs. ${monthlyData.netSalary}`]
            ];
    
            doc.setFontSize(14);
            doc.text('Monthly Salary Details', startX, startY - 6);
            doc.setFontSize(12);
    
            let currentY = startY;
            doc.setDrawColor(0);
            doc.rect(startX, currentY, col1Width, rowHeight);
            doc.rect(startX + col1Width, currentY, col2Width, rowHeight);
            doc.text('Component', startX + 2, currentY + 6);
            doc.text('Amount', startX + col1Width + 2, currentY + 6);
            currentY += rowHeight;
    
            salaryData.forEach(([label, value]) => {
                doc.rect(startX, currentY, col1Width, rowHeight);
                doc.rect(startX + col1Width, currentY, col2Width, rowHeight);
                doc.text(label, startX + 2, currentY + 6);
                doc.text(value, startX + col1Width + 2, currentY + 6);
                currentY += rowHeight;
            });
    
            doc.save(`${employee.First_Name__c} ${employee.Last_Name__c}_${monthYear}.pdf`);
            index++;
            setTimeout(downloadNext, 400);
        };
    
        await downloadNext();
    }

    //payslip end
    //Offer Letter start
    generatePdfOfferLetter() {
        const jsPDF = window.jspdf?.jsPDF || window.jsPDF;

        if (!jsPDF || !this.employee) {
            this.showToast('Error', 'PDF or employee data not ready.', 'error');
            return;
        }

        const emp = this.employee;
        const doc = new jsPDF();

        const companyName = 'Jayalaxmi Softtech PVT. LTD.';
        const designation = 'Software Engineer';
        const location = 'Hyderabad';
        const team = 'Development';
        const manager = 'Pravalika';
        const offerExpiry = 'April 30, 2025';

        const fullName = `${emp.First_Name__c} ${emp.Last_Name__c}`;
        const joiningDate = emp.Joining_Date__c;
        const annualCTC = `RS. ${emp.Total_CTC__c.toLocaleString()}`;
        const monthly = this.getMonthlyPayslipData();
        const insuranceAmount = 'RS. 200,000';

        // Header
        doc.setFontSize(14);
        doc.text('Offer Letter', 90, 20);

        doc.setFontSize(12);
        let y = 40;

        const introLines = [
            `Dear ${emp.First_Name__c} ${emp.Last_Name__c},`,
            ``,
            `Congratulations! We are pleased to offer you the position of ${designation} at ${companyName}. Your annual cost to company is ${annualCTC}. The breakdown of your monthly salary is given below:`,
        ];

        introLines.forEach(line => {
            const wrappedLines = doc.splitTextToSize(line, 170); // Added splitTextToSize here
            wrappedLines.forEach(wrappedLine => {
                doc.text(wrappedLine, 20, y);
                y += 6;
            });
        });


        // Salary Breakdown Table
        y += 10;
        doc.setFont(undefined, 'bold');
        doc.text('Salary Component', 20, y);
        doc.text('Amount (in RS)', 120, y);
        doc.setFont(undefined, 'normal');
        y += 5;
        doc.line(20, y, 190, y);

        const tableData = [
            ['Basic Pay', monthly.basic],
            ['House Rent Allowance (HRA)', monthly.hra],
            ['Special Allowance', monthly.specialAllowance],
            ['Medical Allowance', monthly.medical],
            ['Employer PF', monthly.employerPf],
            ['Employee PF', monthly.employeePf],
            ['Professional Tax', monthly.professionalTax],
            ['Income Tax', monthly.incomeTax],
            ['Gross Monthly Salary', monthly.totalCtc]
        ];

        tableData.forEach(row => {
            y += 7;
            doc.text(row[0], 20, y);
            doc.text(`RS. ${row[1]}`, 120, y, { align: 'left' });
            if (row[0] === 'Income Tax' || row[0] === 'Gross Monthly Salary') {
                doc.line(20, y + 2, 190, y + 2);
            }
        });

        y += 10;

        const continuationParagraphs = [
            `Your salary will be paid on the last working day of each month via direct deposit. Your Joining date is ${joiningDate}, and your base location will be ${location}. You will work with the ${team} team and report directly to ${manager}.`,
            `As a benefit, the company will pay the full premium for your inclusion under the Group Health Insurance policy, offering coverage of RS. ${insuranceAmount}.`,
            `Gratuity will be given upon completing 5+ years of service in accordance with the law.`,
            `If you accept this offer, please sign and return this letter by ${offerExpiry}. We look forward to welcoming you to the team.`,
            `Sincerely,`,
            `HR Department`,
            `${companyName}`,
            ``,
            `Signature: ______________________`,
            `Date: ______________________`
        ];

        continuationParagraphs.forEach(paragraph => {
            const lines = doc.splitTextToSize(paragraph, 170);
            lines.forEach(line => {
                doc.text(line, 20, y);
                y += 6;
            });
            y += 6;
        });

        doc.save(`${emp.First_Name__c} ${emp.First_Name__c}_Offer_Letter.pdf`);
    }

    //offerletter end   
    @track password = '';
    @track employee;
    @track isFlowVisible = false;
    @track selectedOption;
    employeeId = '';
    jsPdfLibLoaded = false;
    @track isFlowVisible = false;
    //@track selectedOption = 'recruitment';
    @track firstName = '';
    @track lastName = '';
    @track email = '';
    @track mobile = '';
    @track address = '';
    @track employees = [];
    @track isLoggedIn = false;
    @track loginEmail = '';
    @track password = '';
    @track loginTime = '';
    @track logoutTime = '';
    @track totalHours = '';
    @track employeeFullName = '';
    @track attendanceRecords = [];
    @track departmentOptions = [];
    @track error;
    @track loggedInEmployeeId = ''; // Track logged-in employee ID
    @track loggedInEmployeeEmail = ''; // Dynamic email to be set after login
    wiredEmployeesResult;

    connectedCallback() {
        getDepartmentPicklistValues()
            .then(result => {
                this.departmentOptions = result.map(value => {
                    return { label: value, value: value };
                });
            })
            .catch(error => {
                console.error('Picklist fetch error:', error);
            });
    }


    get options() {
        return [
            { label: 'Employees', value: 'employees', icon: employeesIcon },
            { label: 'Attendances', value: 'attendance', icon: attendancesIcon },
            { label: 'Recruitment', value: 'recruitment', icon: recruitmentIcon }
        ];
    }

    get selectedOptionIcon() {
        const selected = this.options.find(opt => opt.value === this.selectedOption);
        return selected ? selected.icon : null;
    }

    employeeColumns = [
        { label: 'First Name', fieldName: 'First_Name__c', type: 'text' },
        { label: 'Last Name', fieldName: 'Last_Name__c', type: 'text' },
        { label: 'Email', fieldName: 'Email__c', type: 'email' },
        { label: 'Mobile Number', fieldName: 'Mobile_Number__c', type: 'phone' },
        { label: 'Department', fieldName: 'Department__c', type: 'text' },
        { label: 'Total CTC', fieldName: 'Total_CTC__c', type: 'currency' },
        { label: 'Joining Date', fieldName: 'Joining_Date__c', type: 'date' },
        { label: 'Address', fieldName: 'Address__c', type: 'text' }
    ];
    attendanceColumns = [
        //{ label: 'Date', fieldName: 'Date__c', type: 'date' },
        { label: 'Login Time', fieldName: 'Login_Time__c', type: 'text', typeAttributes: { hour: '2-digit', minute: '2-digit', second: '2-digit' } },
        { label: 'Logout Time', fieldName: 'Logout_Time__c', type: 'text', typeAttributes: { hour: '2-digit', minute: '2-digit', second: '2-digit' } },
        { label: 'Total Hours', fieldName: 'Total_Hours__c', type: 'number', cellAttributes: { alignment: 'center' } }
    ];

    handleEmailChange(event) {
        this.loginEmail = event.target.value;
    }

    handlePasswordChange(event) {
        this.password = event.target.value;
    }
    openLeaveManagementModal() {
        console.log('➡️ About to open Leave Management Flow...');
        console.log('➡️ Value of loggedInEmployeeId:', this.loggedInEmployeeId); // Added this line
        // This replaces modal with the Flow launch
        this.isFlowVisible = true;
    }
    closeModal() {
        this.isFlowVisible = false;
    }

    handleFlowStatusChange(event) {
        if (event.detail.status === 'FINISHED') {
            this.closeModal();
            //this.isFlowVisible = false;
        }
    }

    get inputVariables() {
        return [
            {
                name: 'loggedInEmployeeId',
                type: 'String',
                value: this.loggedInEmployeeId
            }
        ];
    }

    get isJsPdfLoaded() {
        return this.jsPdfLibLoaded;
    }

    @wire(getEmployees)
    wiredEmployees(result) {
        this.wiredEmployeesResult = result;
        if (result.data) {
            this.employees = result.data;
        } else if (result.error) {
            console.error('Error fetching employees:', result.error);
        }
    }


    formatDateTime(dateTimeString) {
        if (!dateTimeString) return 'Not Recorded';
        const dateObj = new Date(dateTimeString);
        return dateObj.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }
    get hasAttendanceRecords() {
        return Array.isArray(this.attendanceRecords) && this.attendanceRecords.length > 0;
    }

    handleOptionChange(event) {
        this.selectedOption = event.target.value;
        console.log('Selected Option:', this.selectedOption);
    }

    isSelected(value) {
        return this.selectedOption === value;
    }
    get optionStates() {
        return this.options.map(option => ({
            ...option,
            isSelected: this.selectedOption === option.value,
        }));
    }

    get showRecruitment() {
        return this.selectedOption === 'recruitment';
    }

    get showEmployees() {
        return this.selectedOption === 'employees';
    }

    get showAttendance() {
        return this.selectedOption === 'attendance';
    }

    /*handleInputChange(event) {
        const fieldName = event.target.name;
        this[fieldName] = event.target.value.trim();
    }*/

        handleInputChange(event) {
            const fieldName = event.target.name;
            const value = event.detail.value;
            this[fieldName] = value.trim ? value.trim() : value;
        }

        get recordTypeId() {
            return this.objectInfo?.data?.defaultRecordTypeId || null;
        }

    async handleAddEmployee() {
        if (!this.firstName || !this.lastName || !this.email || !this.mobile || !this.department || !this.joiningDate || !this.totalCtc || !this.address) {
            this.showToast('Error', 'All fields are required!', 'error');
            return;
        }
        try {
            await addEmployee({
                firstName: this.firstName,
                lastName: this.lastName,
                email: this.email,
                mobile: this.mobile,
                department: this.department,
                joiningDate: this.joiningDate,
                totalCtc: this.totalCtc,
                address: this.address
            });
            this.showToast('Success', 'Employee added successfully!', 'success');
            this.clearInputFields();
            await refreshApex(this.wiredEmployeesResult); // Refresh the employee list
        } catch (error) {
            console.error('Error adding employee:', error);

            let message = 'Unknown error occurred';
            if (error && error.body && error.body.message) {
                message = error.body.message;
            } else if (error && error.message) {
                message = error.message;
            }

            this.showToast('Error', message, 'error');
        }
    }

    @wire(getObjectInfo, { objectApiName: EMPLOYEE_OBJECT })
    objectInfo;

    /*@wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: DEPARTMENT_FIELD
    })*/

        
        @wire(getPicklistValues, {
            recordTypeId: '$recordTypeId',
            fieldApiName: DEPARTMENT_FIELD
        })
        
        wiredDepartmentValues({ error, data }) {
            if (data) {
                this.departmentOptions = data.values.map(item => ({
                    label: item.label,
                    value: item.value
                }));
            } else if (error) {
                console.error('Error fetching Department picklist values', error);
            }
        }


    clearInputFields() {
        this.firstName = '';
        this.lastName = '';
        this.email = '';
        this.mobile = '';
        this.address = '';
        this.department = '';
        this.joiningDate = '';
        this.totalCtc = '';
    }

    async handleLogin() {
        try {
            const result = await loginEmployee({
                email: this.loginEmail,
                password: this.password
            });

            if (result) {
                this.isLoggedIn = true;
                this.loggedInEmployeeEmail = this.loginEmail;
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('loggedInEmployeeEmail', this.loginEmail);
                this.showToast('Success', 'Login successful!', 'success');
                this.fetchAttendanceRecords(); // Assuming this is defined elsewhere


                const employeeId = await getEmployeeIdByEmail({ email: this.loginEmail });

                if (employeeId) {
                    this.loggedInEmployeeId = employeeId;

                    getEmployeeDetails({ employeeId: this.loggedInEmployeeId })
                        .then((emp) => {
                            this.employee = emp;
                            this.monthOptions = this.getMonthsSinceJoining(emp.Joining_Date__c);
                            if (this.monthOptions.length > 0) {
                                this.selectedMonth = this.monthOptions[this.monthOptions.length - 1].value;
                            }
                            return getAbsentDays({ employeeId: this.loggedInEmployeeId });
                        })
                        .then(absentDaysResult => {
                            this.absentDays = absentDaysResult;
                            console.log("✅ Absent days fetched after login:", this.absentDays);
                        })
                        .catch((error) => {
                            console.error('Error fetching employee or absent days:', error);
                        });
                }
            } else {
                console.error('Invalid login.');
            }
        } catch (error) {
            console.error('Login error:', error);
        }
    }


    // Function to fetch attendance records
    fetchAttendanceRecords() {
        getAttendanceRecords({ email: this.loggedInEmployeeEmail })
            .then(result => {
                console.log("📦 Raw attendance result:", result); // For debugging

                this.attendanceRecords = result.map(record => {
                    return {
                        ...record,
                        Login_Time__c: this.formatDateTime(record.Login_Time__c),
                        Logout_Time__c: this.formatDateTime(record.Logout_Time__c),
                        Total_Hours__c: record.Total_Hours__c != null ? record.Total_Hours__c.toFixed(2) : '0.00'
                    };
                });

                // ✅ Add this line here to inspect the final data passed to the table
                console.log("✅ Final Data Sent to DataTable:", JSON.stringify(this.attendanceRecords, null, 2));
            })
            .catch(error => {
                console.error('❌ Error fetching attendance records:', error);
                this.showToast('Error', 'Error fetching attendance records', 'error');
            });
    }

    async handleLogout() {
        try {
            await logAttendance({ email: this.loggedInEmployeeEmail, action: 'Logout' });
            this.isLoggedIn = false;
            this.loggedInEmployeeEmail = '';
            this.loginEmail = '';
            this.password = '';
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('loggedInEmployeeEmail');
            this.showToast('Success', 'Logout successful!', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Error', error.body.message, 'error');
        }
    }

    async handleLoginClick() {
        try {
            await logAttendance({ email: this.loginEmail, action: 'Login' });
            this.showToast('Success', 'Login recorded successfully!', 'success');
        } catch (error) {
            console.error('Error logging in:', error);
            this.showToast('Error', 'Incorrect Email or Password', 'error');
        }
    }

    async handleLogoutClick() {
        try {
            await logAttendance({ email: this.loginEmail, action: 'Logout' });
            this.showToast('Success', 'Logout recorded successfully!', 'success');
        } catch (error) {
            console.error('Error logging out:', error);
            this.showToast('Error', error.body.message, 'error');
        }
    }

    openLeaveModal() {
        this.isLeaveModalOpen = true;
    }

    closeLeaveModal() {
        this.isLeaveModalOpen = false;
    }

    handleTabChange(event) {
        this.activeTab = event.target.value;
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }

    // PDF Generation

    downloadPdf(base64Data, fileName) {
        const blob = this.base64ToBlob(base64Data, 'application/pdf');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    base64ToBlob(base64, contentType) {
        const byteCharacters = atob(base64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, { type: contentType });
    }

    //Start Forgot Password
    @track showForgotPasswordModal = false;
    @track forgotPasswordEmail = '';

    handleForgotPasswordClick() {
        this.forgotPasswordEmail = ''; // Clear email each time
        this.showForgotPasswordModal = true;
    }

    closeForgotPasswordModal() {
        this.showForgotPasswordModal = false;
    }

    handleForgotPasswordEmailChange(event) {
        this.forgotPasswordEmail = event.target.value;
    }

    async submitForgotPassword() {
        if (!this.forgotPasswordEmail) {
            this.showToast('Error', 'Please enter your email.', 'error');
            return;
        }

        try {
            const result = await resetEmployeePassword({ email: this.forgotPasswordEmail });
            if (result) {
                this.showToast('Success', 'New password sent to your email.', 'success');
                this.closeForgotPasswordModal();
            } else {
                this.showToast('Error', 'Email not found.', 'error');
            }
        } catch (error) {
            this.showToast('Error', 'An error occurred.', 'error');
            console.error(error);
        }
    }

    showToast(title, message, variant) {
        const evt = new ShowToastEvent({ title, message, variant });
        this.dispatchEvent(evt);
    }

}
