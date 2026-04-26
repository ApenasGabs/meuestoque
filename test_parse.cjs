const fs = require('fs');
const changelogMarkdown = fs.readFileSync('./CHANGELOG.md', 'utf-8');

const releases = changelogMarkdown.split('## [').slice(1);
const parsed = releases.map(release => {
  const [header, ...rest] = release.split('\n');
  const versionMatch = header.match(/^([^\]]+)\].*?\(([^)]+)\)/);
  if (!versionMatch) return null;
  const version = versionMatch[1];
  const date = versionMatch[2];

  const features = [];
  const fixes = [];
  let currentSection = null;

  for (const line of rest) {
    if (line.startsWith('### ')) {
      if (line.includes('Features') || line.includes('Novidades')) {
        currentSection = 'features';
      } else if (line.includes('Bug Fixes') || line.includes('Correções')) {
        currentSection = 'fixes';
      } else {
        currentSection = null;
      }
    } else if (line.trim().startsWith('* ') && currentSection) {
      if (currentSection === 'features') {
        features.push(line.replace(/^\* (?::sparkles: |:rocket: )?/, '').trim());
      } else if (currentSection === 'fixes') {
        fixes.push(line.replace(/^\* (?::bug: |:wrench: )?/, '').trim());
      }
    }
  }

  return { version, date, features, fixes };
}).filter(Boolean).slice(0, 5);

console.log(JSON.stringify(parsed, null, 2));
