import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';

const workspaceRoots = ['apps', 'packages'];
const dependencyGroups = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const manifests = [
  {
    path: 'package.json',
    json: JSON.parse(await readFile('package.json', 'utf8')),
  },
];

for (const workspaceRoot of workspaceRoots) {
  const entries = await readdir(workspaceRoot, {withFileTypes: true});
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(workspaceRoot, entry.name, 'package.json');
    try {
      manifests.push({
        path: manifestPath,
        json: JSON.parse(await readFile(manifestPath, 'utf8')),
      });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

const remotionDependencies = manifests.flatMap(({path, json}) =>
  dependencyGroups.flatMap((group) =>
    Object.entries(json[group] ?? {})
      .filter(([name]) => name === 'remotion' || name.startsWith('@remotion/'))
      .map(([name, version]) => ({name, path, version})),
  ),
);

const versions = new Set(remotionDependencies.map(({version}) => version));
const expectedVersion = remotionDependencies.find(({name}) => name === 'remotion')?.version;
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const invalid = remotionDependencies.filter(
  ({version}) => version !== expectedVersion || !exactVersion.test(version),
);

if (!expectedVersion || versions.size !== 1 || invalid.length > 0) {
  console.error('All remotion and @remotion/* dependencies must use one exact version.');
  for (const dependency of remotionDependencies) {
    console.error(`${dependency.path}: ${dependency.name}@${dependency.version}`);
  }
  process.exitCode = 1;
} else {
  console.log(`All ${remotionDependencies.length} Remotion dependencies use ${expectedVersion}.`);
}
