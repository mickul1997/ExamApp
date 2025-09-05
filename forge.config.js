// forge.config.js (ESM)
export default {
  packagerConfig: { asar: true },
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['darwin','linux','win32'] },
    { name: '@electron-forge/maker-dmg', config: { format: 'ULFO' } } // optional, nice to have
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          { entry: 'src/main/index.ts',    config: 'vite.main.config.ts' },
          { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts' }
        ],
        renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }]
      }
    }
  ]
}
