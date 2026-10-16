const fs = require('fs');
const path = require('path');

const backendDir = '/Users/apple/Desktop/S T P L/Sachiva/resort/Maa-Baglamkhi-Resort-Backend';
const modelsDir = path.join(backendDir, 'models');

const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('Model.js'));
let fixed = 0;

for (const file of files) {
  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Only fix files with the broken template literal pattern
  if (!content.includes('await conn.query(`')) continue;

  // Extract SQL between the backticks
  const match = content.match(/await conn\.query\(\x60([\s\S]*?)\x60\)/);
  if (!match) continue;

  const sqlContent = match[1];
  // Escape backticks for template literal
  const escapedSql = sqlContent.replace(/`/g, '\\`');

  // Replace in content
  const oldBlock = 'await conn.query(`' + sqlContent + '`)';
  const newBlock = 'await conn.query(`' + escapedSql + '`)';

  if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync(filePath, content);
    fixed++;
  }
}

console.log('Fixed ' + fixed + ' model files');
