const fs = require('fs');
const key = fs.readFileSync('./AdminSDK/assignment11-196f4-firebase-adminsdk-fbsvc-f94a6fb13c.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)