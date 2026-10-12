import fs from 'node:fs';
import path from 'node:path';
import type {Brief} from '@ai-video-studio/schema';
import {config} from '../config';

const PLAYBOOK: Record<Brief['subtype'], string> = {
  'product-overview': 'saas-explainer',
  'feature-announcement': 'feature-announcement',
  'how-it-works': 'how-it-works',
  'problem-solution': 'problem-solution',
};

const stripFrontmatter = (text: string): string => text.replace(/^---[\s\S]*?---\s*/, '').trim();

/** General skills (always) + the playbook for this video type. Stable order so prompt caching works. */
export const loadSkills = (subtype: Brief['subtype'], dir = config.skillsDir): string => {
  const general = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => `## SKILL: ${file.replace('.md', '')}\n${stripFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'))}`);
  const playbookName = PLAYBOOK[subtype];
  const playbook = `## PLAYBOOK: ${playbookName}\n${stripFrontmatter(fs.readFileSync(path.join(dir, 'playbooks', `${playbookName}.md`), 'utf8'))}`;
  return ['# SKILLS (follow these rules)', ...general, playbook].join('\n\n');
};
