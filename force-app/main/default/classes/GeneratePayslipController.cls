public with sharing class GeneratePayslipController {
    
    @AuraEnabled(cacheable=true)
    public static Employee__c getEmployeeDetails(Id employeeId) {
        // Fetching the current logged-in employee using Email and Is_Logged_In__c = TRUE
       // System.debug('Called getEmployeeDetails for ID: ' + employeeId);
    Employee__c emp = [SELECT First_Name__c, Last_Name__c, Email__c, Department__c, Joining_Date__c,
                              Total_CTC__c, Basic_Salary__c, HRA__c, Special_Allowance__c, Medical_Allowance__c,
                              Employer_PF__c, Employee_PF__c, Professional_Tax__c, Income_Tax__c, Net_Salary__c
                       FROM Employee__c
                       WHERE Id = :employeeId
                       LIMIT 1];
    //System.debug(' Employee record returned: ' + emp);
    return emp;
    }

    @AuraEnabled
    public static Integer getAbsentDays(Id employeeId, Integer year, Integer month) {
        Date startOfMonth = Date.newInstance(year, month, 1);
        Date endOfMonth = startOfMonth.addMonths(1).addDays(-1);
        system.debug('Start Of Month: ' + startOfMonth + ' End of Month: ' + endOfMonth);
          
        List<Leave_Management__c> leaves = [
            SELECT Start_Date__c, End_Date__c
            FROM Leave_Management__c
            WHERE Employee_Name__c = :employeeId
            AND Leave_Type__c = 'Loss of Pay Leave'
            AND Status__c = 'Approved'
            AND Start_Date__c <= :endOfMonth
            AND End_Date__c >= :startOfMonth
        ];

        //System.debug('Leaves:' + leaves);
        
    
        Integer absentDays = 0;
    
        for (Leave_Management__c leave : leaves) {
            Date leaveStart = leave.Start_Date__c < startOfMonth ? startOfMonth : leave.Start_Date__c;
            Date leaveEnd = leave.End_Date__c > endOfMonth ? endOfMonth : leave.End_Date__c;
            absentDays += leaveStart.daysBetween(leaveEnd) + 1;
            //System.debug('Absent days: ' + absentDays);
        }
    
        return absentDays;
    }
    
}