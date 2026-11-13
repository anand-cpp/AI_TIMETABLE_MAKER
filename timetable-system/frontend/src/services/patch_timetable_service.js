const fs = require('fs');
const p = './AI_TIMETABLE_MAKER/timetable-system/frontend/src/services/timetableService.js';
let content = fs.readFileSync(p, 'utf8');

const addition = `
  previewRebalance: async (id, data) => {
    const res = await api.post(\`/timetable/versions/\${id}/rebalance/preview\`, data);
    return res.data;
  },

  applyRebalance: async (id, data) => {
    const res = await api.post(\`/timetable/versions/\${id}/rebalance/commit\`, data);
    return res.data;
  },
`;

content = content.replace('  unlockSlot: async', addition + '\n  unlockSlot: async');
fs.writeFileSync(p, content, 'utf8');
console.log('Patched timetableService.js');
