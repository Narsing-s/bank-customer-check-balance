Bank Customer – Check Balance (Mule 4)
A Mule 4 API that lets customers check their bank account balance.
It validates account and ATM PIN against Snowflake, manages wrong PIN attempts, locks accounts after 3 failures, and sends Gmail email notifications on failed attempts or account lock. Includes APIKit console.

Table of Contents

#architecture
#features
#prerequisites
#configuration

#externalize-credentials-recommended
#mule-properties-example


#build--run
#api

#base-urls
#endpoints
#request-examples
#response-examples


#snowflake-schema-assumptions
#flow-walkthrough
#error-handling
#email-notifications
#logging
#security-notes
#troubleshooting
#project-structure
#license


Architecture
Client --> HTTP Listener (/api/*)
        --> APIKit Router (RAML: bank-customer-check-balance.raml)
        --> Flow: get:\checkBalance
              --> Snowflake: SELECT bank_transactions
              --> Decision:
                    - Account active?
                    - PIN correct?
                    - WRONGPIN thresholds (0..3)
              --> Snowflake: UPDATE WRONGPIN / ACCOUNTSTATUS
              --> Email Subflow (Gmail SMTP)
        --> APIKit Error Handling -> JSON messages & HTTP codes


Features

Check balance by account number, ATM PIN, bank name, type (queried via queryParams).
Snowflake backed validation and update:

WRONGPIN count increments on failures.
Auto-lock (ACCOUNTSTATUS = 'Locked') at 3 failed attempts.


Gmail SMTP email alerts:

“Failed Attempt” (remaining attempts).
“Account Locked” (after 3 failures).


APIKit router and API console at /console/*.
Consistent JSON responses and HTTP status handling.


Prerequisites

Mule 4.x runtime / Anypoint Studio 7.x
Snowflake account & network access
Gmail account with App Password (2FA enabled).

Tip: Generate an app password at Google Account ➜ Security ➜ App passwords.


Java 8/11 per Mule runtime requirement


Configuration
This project uses:

HTTP Listener on port 8081
Snowflake connection named Snowflake_Config
Email (SMTP) connection named Email_SMTP
APIKit using bank-customer-check-balance.raml


⚠️ Critical: Don’t hardcode credentials in XML. Use application properties and Secure Properties.

Externalize Credentials (Recommended)


Add placeholders in XML (instead of literals):
XML<snowflake:snowflake-connection    accountName="${snowflake.accountName}"    warehouse="${snowflake.warehouse}"    database="${snowflake.database}"    schema="${snowflake.schema}"    user="${snowflake.user}"    password="${secure::snowflake.password}"    role="${snowflake.role}" /><email:smtp-connection    host="${smtp.host}"    port="${smtp.port}"    user="${smtp.user}"    password="${secure::smtp.password}">  <email:properties>    <email:property key="mail.smtp.starttls.enable" value="${smtp.tls}" />  </email:properties></email:smtp-connection>Show more lines


In src/main/resources:

application.properties (non-sensitive)
secure.properties (sensitive; encrypted values)



Add Secure Properties config (global element):
XML<secure-properties:config    name="secure-properties"    file="secure.properties"    key="${secure.key}"    algorithm="AES" />Show more lines
And pass -Dsecure.key=<YOUR_SECURE_KEY> at runtime.


Encrypt sensitive values using Mule Secure Properties Tool and store them in secure.properties.


Mule Properties Example
application.properties
.properties# HTTPhttp.listener.host=0.0.0.0http.listener.port=8081# Snowflake (non-sensitive)snowflake.accountName=PTWXDSX-CF63578snowflake.warehouse=COMPUTE_WHsnowflake.database=HOSPITALLOCATORDBsnowflake.schema=PUBLICsnowflake.user=SINGSINGsnowflake.role=ACCOUNTADMIN# SMTP (non-sensitive)smtp.host=smtp.gmail.comsmtp.port=587smtp.user=noreply@example.comsmtp.tls=true# Email sender (used in email:send)email.from=noreply@example.comShow more lines
secure.properties (values shown here are placeholders; store encrypted)
.propertiessecure.snowflake.password=![ENCRYPTED_VALUE]secure.smtp.password=![ENCRYPTED_VALUE]Show more lines

Build & Run
Anypoint Studio

Import project.
Configure application.properties, secure.properties.
Add secure-properties global element (if not already).
Run as Mule Application.

Mule Runtime (CLI)
Shellmule -M-Dsecure.key=YOUR_SECURE_KEYShow more lines

API
Base URLs

API: http://localhost:8081/api/*
Console: http://localhost:8081/console/

Endpoints















MethodPathDescriptionGET/checkBalanceCheck account balance
Query Parameters (required):

accountNum — Customer account number
atmPin — ATM PIN
bank — Bank name
type — Bank type (string; used as bankType variable, not in SQL)

Request Examples
cURL
Shellcurl -G "http://localhost:8081/api/checkBalance" \  --data-urlencode "accountNum=1234567890" \  --data-urlencode "atmPin=1234" \  --data-urlencode "bank=MyBank" \  --data-urlencode "type=Savings"Show more lines
Postman

Method: GET
URL: http://localhost:8081/api/checkBalance
Params:

accountNum: 1234567890
atmPin: 1234
bank: MyBank
type: Savings



Response Examples
✅ Success (Active & Correct PIN)
JSON{  "status": "Your total balance is 25000 as on 2026-03-14"}``Show more lines
❌ Wrong PIN (attempts remaining)
JSON"Login attempt Failed. You have Attempts left 1"Show more lines
🔒 Account Locked (after 3 failures)
JSON"Maximum Attempts reached. Your account 1234567890 is temporarily Locked. So please reach nearest Branch for MyBank"Show more lines
🔒 Account Not Active
JSON"Your Account 1234567890 temporarily locked. Please visit nearest Branch for MyBank"Show more lines
🕳️ Not Found
JSON"Account - 1234567890 does not exist, in Bank MyBank Enter Valid Details"Show more lines
APIKit Errors

400 Bad request → { "message": "Bad request" }
404 Not found → { "message": "Resource not found" }
405 Method not allowed → { "message": "Method not allowed" }
406 Not acceptable → { "message": "Not acceptable" }
415 Unsupported media type → { "message": "Unsupported media type" }
501 Not Implemented → { "message": "Not Implemented" }


Snowflake Schema Assumptions
Table: bank_transactions (in HOSPITALLOCATORDB.PUBLIC)
Columns used:

CUSTACCNUM (number/string)
BANKNAME (string)
ATMPIN (string/number)
WRONGPIN (integer: 0..3)
ACCOUNTSTATUS (string: "Active" or "Locked")
TOTALBALANCE (number/decimal)
MAILLD (string: email address)


SELECT used:

SQLselect * from bank_transactionswhere custaccNum = :accountNum and bankName = :bankNameShow more lines

UPDATEs used:


Reset wrong pin after successful login:
SQLupdate bank_transactionsset WRONGPIN = :wrongPinAttemptwhere custaccNum = :accountNum and bankName = :bankName;Show more lines

Increment wrong pin on failure:
SQLupdate bank_transactionsset WRONGPIN = :wrongPinAttemptwhere custaccNum = :accountNum and bankName = :bankName;Show more lines

Lock account at 3 failures:
SQLupdate bank_transactionsset WRONGPIN = :wrongPinAttempt, ACCOUNTSTATUS = :accountStatuswhere custaccNum = :accountNum and bankName = :bankName;Show more lines



Flow Walkthrough

HTTP Listener (/api/*) receives request.
APIKit Router dispatches to get:\checkBalance.
Extracts query params into vars.inputValues (DataWeave).
Snowflake SELECT by accountNum and bankName.
Choice Router:

If record exists and ACCOUNTSTATUS == 'Active':

If PIN matches:

If WRONGPIN <= 2 → reset WRONGPIN to 0, return balance.
If WRONGPIN <= 0 → return balance (no reset).


Else PIN mismatch:

Increment WRONGPIN.
If WRONGPIN == 3 → lock account, send "Account Locked" email, return lock message.
Else → send "Failed Attempt" email, return attempts left.




If record exists but not active → return locked message.
Else → record not found message.


Email Subflow (bank-customer-check-balance-gmail-flow):

Sends email using SMTP config and payload-derived subject/body.




Email Notifications

Failed Attempt

Subject: Failed Attempt !
Body: informs remaining attempts before lock.


Account Locked

Subject: Account Locked !
Body: informs account locked due to 3 failed attempts.



SMTP Config (Gmail):

Host: smtp.gmail.com
Port: 587
TLS: mail.smtp.starttls.enable=true
Use App Password for password.


Logging
Notable log points:

Start of API: "Check balance API started"
Record state: "Record found ... and active", "Account status not Active", "record not found ..."
PIN flow: "pin matched ...", "pin not matched", "pin login attempt failed", "wrong pin as 3 reached"
Email: "Before send email", "Email sent successfully"

Use Anypoint Studio console to trace flow.

Security Notes

⚠️ Immediate Actions Recommended:


Remove hardcoded credentials from XML.
Rotate Snowflake and Gmail credentials.
Move secrets to Secure Properties with strong secure.key.
Do not log sensitive data (PIN, emails).
Consider rate limiting, audit logs, and PII masking.
Validate/normalize inputs (length, type) to prevent injection (parameterized SQL is already used—good!).


Troubleshooting

HTTP 500: Check Snowflake connectivity, credentials, and network allowlists.
No email delivered:

Verify Gmail App Password.
Ensure From address matches authenticated user or permitted sender.
Check spam/quarantine.


WRONGPIN logic oddities:

Inspect values with debug logs.
Ensure WRONGPIN type is numeric in Snowflake.


APIKit 404:

Confirm RAML bank-customer-check-balance.raml is in sync.
Hit the right path /api/checkBalance.




Project Structure
.
├── src/main/mule/
│   └── bank-customer-check-balance.xml      # (this file)
├── src/main/resources/
│   ├── bank-customer-check-balance.raml     # APIKit RAML
│   ├── application.properties               # non-sensitive props
│   └── secure.properties                    # encrypted secrets (gitignored)
├── pom.xml
└── README.md


Add secure.properties to .gitignore.


License
Internal/Confidential. Do not distribute without permission.
