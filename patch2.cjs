const fs = require('fs');
let content = fs.readFileSync('src/pages/FreeCAI.tsx', 'utf8');

content = content.replace(
  /if \(clientOverview && text\.includes\("\\\$\{companyReport\}"\)\) \{/,
  `if (text.includes("\\\${companyReport}")) {`
);

content = content.replace(
  /text = text\.replace\("\\\$\{companyReport\}", clientOverview\);/,
  `text = text.replace("\\\${companyReport}", clientOverview || "*(Thông tin công ty không được lưu trữ đầy đủ trong phiên bản cũ)*");`
);

content = content.replace(
  /if \(clientOverview && text\.includes\("\\\$\{companyReport\}"\)\) \{/,
  `if (text.includes("\${companyReport}")) {`
);

content = content.replace(
  /text = text\.replace\("\\\$\{companyReport\}", clientOverview\);/,
  `text = text.replace("\${companyReport}", clientOverview || "*(Thông tin công ty không được lưu trữ đầy đủ trong phiên bản cũ)*");`
);

fs.writeFileSync('src/pages/FreeCAI.tsx', content, 'utf8');
