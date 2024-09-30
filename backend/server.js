const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = 3000;

// 允许跨域
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置 multer 保存标注图片
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const basePath = '/Users/xyz/Downloads/Composition-1k-testset-human';
    const humanAnnoPath = path.join(basePath, 'human_anno');
    
    // 确保 human_anno 文件夹存在
    if (!fs.existsSync(humanAnnoPath)) {
      fs.mkdirSync(humanAnnoPath);
    }
    
    cb(null, humanAnnoPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // 保留原始文件名
  }
});
const upload = multer({ storage });

// 定义三个文件夹的路径
const basePath = '/Users/xyz/Downloads/Composition-1k-testset-human';
const trimapsPath = path.join(basePath, 'trimaps');
const mergedPath = path.join(basePath, 'merged');
const alphaCopyPath = path.join(basePath, 'alpha_copy');

// API 读取文件夹中的文件名，并返回文件名列表
app.get('/files', (req, res) => {
  try {
    const trimaps = fs.readdirSync(trimapsPath);
    const merged = fs.readdirSync(mergedPath);
    const alphaCopy = fs.readdirSync(alphaCopyPath);

    res.json({
      trimaps,
      merged,
      alphaCopy
    });
  } catch (error) {
    console.error('Error reading directories:', error);
    res.status(500).send('Error reading directories');
  }
});

// API 根据文件夹和文件名读取文件内容
app.get('/file/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;

  let folderPath;
  switch (folder) {
    case 'trimaps':
      folderPath = trimapsPath;
      break;
    case 'merged':
      folderPath = mergedPath;
      break;
    case 'alpha_copy':
      folderPath = alphaCopyPath;
      break;
    default:
      return res.status(400).send('Invalid folder name');
  }

  const filePath = path.join(folderPath, filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

// API 接收保存的标注图片到 human_anno 文件夹
app.post('/save', upload.single('annotatedImage'), (req, res) => {
  try {
    res.status(200).json({ message: 'File saved successfully' });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).send('Error saving file');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
