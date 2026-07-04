const fs = require('fs');

let code = fs.readFileSync('src/pages/JobPostGenerator.tsx', 'utf8');

code = code.replace(
  'Nhập một hoặc danh sách nhiều công việc để tạo ngay bài đăng mạng xã hội và prompt hình ảnh chuyên nghiệp.',
  'Paste a single JD or a list of jobs to instantly create a social media post and an image prompt.'
);

code = code.replace(
  'Nhập list job / Nhập JD...',
  'Paste list of jobs or JD...'
);

code = code.replace(
  'Nhập thông tin và chọn nền tảng',
  'Enter job info and select a platform'
);

code = code.replace(
  'Chọn một nền tảng bên trên để bắt đầu tạo bài đăng',
  'Select a platform above to start generating your post'
);

code = code.replace(
  '✨ Tạo Prompt Hình Ảnh',
  '✨ Generate Image Prompt'
);

fs.writeFileSync('src/pages/JobPostGenerator.tsx', code);
