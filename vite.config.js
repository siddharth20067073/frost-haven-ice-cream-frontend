
import { defineConfig } from 'vite';
import { resolve, relative, sep } from 'node:path';
import { readdirSync } from 'node:fs';

const root = process.cwd();

function getHtmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() &&
        ['node_modules', 'dist', '.git', 'public'].includes(entry.name)) {
      return [];
    }

    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return getHtmlFiles(path);
    }

    return entry.isFile() && entry.name.endsWith('.html')
      ? [path]
      : [];
  });
}

const pages = Object.fromEntries(
  getHtmlFiles(root).map((file) => [
    relative(root, file).split(sep).join('/').replace(/\.html$/, ''),
    file
  ])
);

export default defineConfig({
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: pages
    }
  }
});
