const fs = require('fs');
const path = require('path');

const backendDir = '/Users/apple/Desktop/S T P L/Sachiva/resort/Maa-Baglamkhi-Resort-Backend';
const modelsDir = path.join(backendDir, 'models');

const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('Model.js'));
let fixed = 0;

for (const file of files) {
  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('await conn.query(`')) continue;

  // Extract the table name from the class name
  const className = file.replace('Model.js', '');
  const tableName = className.charAt(0).toLowerCase() + className.slice(1).replace(/([A-Z])/g, '_$1').toLowerCase();
  if (tableName.startsWith('_')) continue;

  // Replace the template literal SQL with string concatenation
  content = content.replace(
    /await conn\.query\(\x60([\s\S]*?)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci\x60\)/,
    function(match, sqlContent) {
      // Extract just the inner part (between the outer template backticks)
      const inner = sqlContent.replace(/^\s*\n\s*/, '').replace(/\s*$/, '');
      // Build with string concatenation
      return "await conn.query('CREATE TABLE IF NOT EXISTS `" + tableName + "` (\\n          ' + fieldDefs + (allConstraints ? ',\\n' + allConstraints : '') + '\\n        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci')";
    }
  );

  fs.writeFileSync(filePath, content);
  fixed++;
}

console.log('Fixed ' + fixed + ' model files');
