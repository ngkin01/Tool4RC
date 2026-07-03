const fs = require('fs');
let content = fs.readFileSync('src/pages/FreeCAI.tsx', 'utf8');

content = content.replace(
  /if \(text\.includes\("\\\$\{companyReport\}"\)\) \{\s*text = text\.replace\("\\\$\{companyReport\}", clientOverview \|\| "\*\(\Thông tin công ty không được lưu trữ đầy đủ trong phiên bản cũ\)\*"\);\s*\}\s*if \(clientOverview && text\.includes\("\$\{companyReport\}"\)\) \{\s*text = text\.replace\("\$\{companyReport\}", clientOverview\);\s*\}/s,
  `if (text.includes("\\\${companyReport}")) {
      text = text.replace("\\\${companyReport}", clientOverview || "*(Thông tin công ty không được lưu trữ đầy đủ trong phiên bản cũ)*");
    }
    if (text.includes("\${companyReport}")) {
      text = text.replace("\${companyReport}", clientOverview || "*(Thông tin công ty không được lưu trữ đầy đủ trong phiên bản cũ)*");
    }`
);

fs.writeFileSync('src/pages/FreeCAI.tsx', content, 'utf8');
