const fs = require('fs');
const path = require('path');

describe('web UI rendering security', () => {
  const root = path.resolve(__dirname, '..');

  it('does not interpolate BLE-controlled values through template innerHTML sinks', () => {
    const indexHtml = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
    const webbleJs = fs.readFileSync(path.join(root, 'public', 'webble.js'), 'utf8');
    const combined = `${indexHtml}\n${webbleJs}`;

    expect(combined).not.toMatch(/innerHTML/);
    expect(combined).not.toMatch(/onclick="/);
  });
});
