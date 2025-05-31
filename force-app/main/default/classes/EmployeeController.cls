public with sharing class EmployeeController {

    @AuraEnabled(cacheable=true)
    public static List<Employee__c> getEmployees() {
        return [SELECT Id, First_Name__c, Last_Name__c, Email__c, Mobile_Number__c, Total_CTC__c, Joining_Date__c, Department__c, Address__c FROM Employee__c];
    }

    @AuraEnabled
    public static String addEmployee(String firstName, String lastName, String email, String mobile, String department, String joiningDate, String totalCtc, String address) {
    try {
        if (String.isEmpty(firstName) || String.isEmpty(lastName) || String.isEmpty(email) || String.isEmpty(mobile) || String.isEmpty(department) || String.isEmpty(joiningDate) || String.isEmpty(totalCtc) || String.isEmpty(address)) {
            throw new AuraHandledException('All fields are required!');
        }
        List<Employee__c> existingEmployees = [SELECT Id FROM Employee__c WHERE Email__c = :email LIMIT 1];
        if (!existingEmployees.isEmpty()) {
            throw new AuraHandledException('Email Already Exists');
        }

        String generatedPassword = generateRandomPassword();
        Employee__c emp = new Employee__c(
            First_Name__c = firstName,
            Last_Name__c = lastName,
            Email__c = email,
            Mobile_Number__c = mobile,
            Address__c = address,
            Total_CTC__c = Decimal.valueOf(totalCtc),
            Joining_Date__c = Date.valueOf(joiningDate),
            Department__c = department,
            Status__c = 'Active',
            Password__c = generatedPassword
        );
        insert emp;
        //System.debug('Employee Inserted: ' + emp.Id);
        sendLoginEmail(email, generatedPassword);
        return 'Success';
    } catch (DmlException e) {
        //System.debug('DML Exception: ' + e.getMessage());
        throw new AuraHandledException('Database Error: ' + e.getMessage());
    } catch (Exception e) {
        //System.debug('Unexpected Exception: ' + e.getMessage());
        throw new AuraHandledException('Unexpected Error: ' + e.getMessage());
    }
    }


    private static String generateRandomPassword() {
        String chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        String password = '';
        for (Integer i = 0; i < 8; i++) {
            Integer index = Math.mod(Math.abs(Crypto.getRandomInteger()), chars.length());
            password += chars.substring(index, index + 1);
        }
        return password;
    }

    private static void sendLoginEmail(String email, String password) {
        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new String[]{ email });
        mail.setSubject('Your HR System Login Credentials');
        mail.setPlainTextBody('Welcome!\n\nYour login details:\nEmail: ' + email + '\nPassword: ' + password + '\n\nBest Regards,\nHR Team');
        Messaging.sendEmail(new Messaging.SingleEmailMessage[]{ mail });
    }

    @AuraEnabled
    public static Boolean loginEmployee(String email, String password) {
        //System.debug('🔹 LOGIN ATTEMPT: Email = ' + email);
        try {
            // Fetch employee details
            List<Employee__c> empList = [
                SELECT Id, Email__c, Password__c 
                FROM Employee__c 
                WHERE Email__c = :email 
                LIMIT 1
            ];
    
            if (empList.isEmpty()) {
                //System.debug('ERROR: No Employee found with email ' + email);
                AuraHandledException ex = new AuraHandledException('Invalid email or password.');
                ex.setMessage('Invalid email or password.');
                throw ex;
            }
    
            Employee__c emp = empList[0];
    
            // Validate password
            if (emp.Password__c != password) {
                //System.debug('ERROR: Password mismatch for ' + email);
                AuraHandledException ex = new AuraHandledException('Invalid email or password.');
                ex.setMessage('Invalid email or password.');
                throw ex;
            }
    
            // Insert Login Record in Attendance__c
            Attendance__c newAttendance = new Attendance__c();
            newAttendance.Employee__c = emp.Id;
            newAttendance.Date__c = Date.today();
            newAttendance.Login_Time__c = System.now();
            insert newAttendance;
    
            //System.debug('LOGIN SUCCESS: Attendance recorded for ' + email);
            return true;
        } catch (Exception e) {
            //System.debug('LOGIN ERROR: ' + e.getMessage());
            AuraHandledException ex = new AuraHandledException('Login failed. Invalid email or password.');
            ex.setMessage(e.getMessage());
            throw ex;
        }
    }
    
    @AuraEnabled
    public static String logAttendance(String email, String action) {
        try {
            //System.debug('🔹 Logging Attendance: Email = ' + email + ', Action = ' + action);
            // Fetch Employee ID
            List<Employee__c> empList = [SELECT Id FROM Employee__c WHERE Email__c = :email ORDER BY CreatedDate DESC LIMIT 1];
            if (empList.isEmpty()) {
                ////System.debug('ERROR: Employee not found.');
                throw new AuraHandledException('Employee not found.');
            }

            Id employeeId = empList[0].Id;
            Date today = Date.today();
            // Fetch All Today's Attendance Records for This Employee
            List<Attendance__c> attendanceList = [
                SELECT Id, Login_Time__c, Logout_Time__c, Total_Hours__c
                FROM Attendance__c
                WHERE Employee__c = :employeeId AND Date__c = :today
                ORDER BY CreatedDate DESC
            ];
            // LOGIN LOGIC
            if (action == 'Login') {
                Attendance__c newAttendance = new Attendance__c();
                newAttendance.Employee__c = employeeId;
                newAttendance.Date__c = today;
                newAttendance.Login_Time__c = System.now();
                insert newAttendance;
                ////System.debug('SUCCESS: Login recorded.');
                return 'Login recorded successfully.';
            }

            // LOGOUT LOGIC (Updating Last Login Record Instead of Creating New Records)
            if (action == 'Logout') {
                if (attendanceList.isEmpty()) {
                    //System.debug('ERROR: No login record found.');
                    throw new AuraHandledException('No login record found for today.');
                }

                // Get Last Login Entry Without Logout
                Attendance__c latestAttendance = null;
                for (Attendance__c att : attendanceList) {
                    if (att.Logout_Time__c == null) {
                        latestAttendance = att;
                        break;
                    }
                }

                if (latestAttendance == null) {
                    //System.debug('⚠️ WARNING: No open login session found. Ignoring duplicate logout request.');
                    throw new AuraHandledException('Already logged out.');
                }

                // Calculate Total Hours Correctly
                latestAttendance.Logout_Time__c = System.now();
                Long totalMilliseconds = latestAttendance.Logout_Time__c.getTime() - latestAttendance.Login_Time__c.getTime();
                Decimal totalHours = (Decimal) totalMilliseconds / (1000 * 60 * 60); // Convert properly
                latestAttendance.Total_Hours__c = totalHours.setScale(2); // Format correctly
                update latestAttendance;
                //System.debug('SUCCESS: Logout recorded. Total Hours = ' + latestAttendance.Total_Hours__c);
                return 'Logout recorded successfully. Total Hours: ' + latestAttendance.Total_Hours__c;
            }

            return 'Invalid action';
        } catch (Exception e) {
            //System.debug('ERROR: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Attendance__c> getAttendanceData(String email) {
        try {
            List<Employee__c> empList = [SELECT Id FROM Employee__c WHERE Email__c = :email LIMIT 1];
            if (empList.isEmpty()) {
                throw new AuraHandledException('Employee not found.');
            }

            Id employeeId = empList[0].Id;
            List<Attendance__c> attendanceList = [
                SELECT Id, Date__c, Login_Time__c, Logout_Time__c, Total_Hours__c
                FROM Attendance__c
                WHERE Employee__c = :employeeId
                ORDER BY Login_Time__c DESC
            ];
            return attendanceList;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Attendance__c> getAttendanceRecords(String email) {
        //System.debug('🔹 FETCHING ATTENDANCE RECORDS for: ' + email);
        try {
            List<Employee__c> empList = [SELECT Id FROM Employee__c WHERE Email__c = :email LIMIT 1];
            if (empList.isEmpty()) {
                throw new AuraHandledException('Employee not found.');
            }

            Id employeeId = empList[0].Id;
            // Fetch all attendance records for this employee
            List<Attendance__c> attendanceList = [
                SELECT Id, Login_Time__c, Logout_Time__c, Total_Hours__c, Date__c
                FROM Attendance__c
                WHERE Employee__c = :employeeId
                ORDER BY Date__c DESC, Login_Time__c DESC
            ];
            //System.debug('ATTENDANCE RECORDS FETCHED: ' + attendanceList.size());
            return attendanceList;
        } catch (Exception e) {
            //System.debug('ERROR FETCHING ATTENDANCE: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }


    @AuraEnabled
    public static String getEmployeeIdByEmail(String email) {
        List<Employee__c> empList = [SELECT Id FROM Employee__c WHERE Email__c = :email LIMIT 1];
        if (!empList.isEmpty()) {
            return empList[0].Id;
        } else {
            return null;
        }
    }
    

    @AuraEnabled
    public static String generateOfferLetter(String employeeId) {
            Employee__c emp = [SELECT First_Name__c, Last_Name__c, Email__c, Department__c FROM Employee__c WHERE Id = :employeeId LIMIT 1];
            if (emp == null) {
                return null;
            }

            String offerLetterContent = '<h1>Offer Letter</h1>' +
                         '<p>Dear ' + emp.First_Name__c + ' ' + emp.Last_Name__c + ',</p>' +
                         '<p>Email: ' + emp.Email__c + '</p>' +
                         '<p>Department: ' + emp.Department__c + '</p>';
        return offerLetterContent;
    }

    @AuraEnabled
    public static Boolean resetEmployeePassword(String email) {
    try {
        List<Employee__c> empList = [SELECT Id, Email__c FROM Employee__c WHERE Email__c = :email LIMIT 1];
        if (empList.isEmpty()) {
            return false;
        }

        Employee__c emp = empList[0];
        String newPassword = generateRandomPassword();
        emp.Password__c = newPassword;
        update emp;

        sendLoginEmail(emp.Email__c, newPassword);
        return true;
    } catch (Exception e) {
        throw new AuraHandledException('Unable to reset password.');
    }
    }

    @AuraEnabled(cacheable=true)
    public static List<String> getDepartmentPicklistValues() {
        List<String> picklistValues = new List<String>();
        Schema.DescribeFieldResult fieldResult = Employee__c.Department__c.getDescribe();
        for (Schema.PicklistEntry entry : fieldResult.getPicklistValues()) {
            picklistValues.add(entry.getLabel());
        }
        return picklistValues;
    }

}
