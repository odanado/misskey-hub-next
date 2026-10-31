import type { PluginOption, UserConfig } from 'vite';
export function common(): UserConfig & { plugins: PluginOption[] };
export function markdownCompatibility(root: string): [PluginOption, PluginOption];
