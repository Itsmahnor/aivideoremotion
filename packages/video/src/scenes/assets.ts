import {staticFile} from 'remotion';

/** http(s)/data URLs pass through; everything else is a path inside packages/video/public. */
export const resolveAsset = (path: string): string => {
  if (/^(https?:|data:)/i.test(path)) return path;
  return staticFile(path.replace(/^\/+/, ''));
};
