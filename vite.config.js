const { defineConfig } = require('vite');
const webExtension = require('vite-plugin-web-extension').default;
const path = require('path');
const fs = require('fs');

function copyIconsPlugin() {
  return {
    name: 'copy-icons',
    closeBundle() {
      const srcDir = path.resolve(process.cwd(), 'src/icons');
      const destDir = path.resolve(process.cwd(), 'dist/icons');
      if (!fs.existsSync(srcDir)) return;
      fs.mkdirSync(destDir, { recursive: true });
      const entries = fs.readdirSync(srcDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
        }
      }
    }
  };
}

module.exports = defineConfig({
  root: path.resolve(process.cwd(), 'src'),
  plugins: [
    webExtension({
      manifest: 'manifest.json',
      additionalInputs: ['options/options.html'],
      watchFilePaths: ['**/*.html', '**/*.css'],
      skipManifestValidation: true,
      disableAutoLaunch: true,
    }),
    copyIconsPlugin(),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
