// plugin-loader.js
const fs = require('fs');
const path = require('path');

class PluginLoader {
  constructor(pool, requirePlugin) {
    this.pool = pool;
    this.requirePlugin = requirePlugin;
    this.loadedPlugins = new Map();
  }

  loadPlugins(app) {
    const pluginsDir = path.join(__dirname, 'plugins');
    
    if (!fs.existsSync(pluginsDir)) {
      console.log('📁 No plugins directory found, skipping plugin loading');
      return;
    }

    const pluginDirs = fs.readdirSync(pluginsDir).filter(dir => {
      const pluginPath = path.join(pluginsDir, dir);
      return fs.statSync(pluginPath).isDirectory();
    });

    console.log(`🔌 Loading ${pluginDirs.length} plugins...`);

    pluginDirs.forEach((pluginName) => {
      try {
        this.loadPlugin(app, pluginName);
      } catch (error) {
        console.error(`❌ Failed to load plugin '${pluginName}':`, error.message);
      }
    });

    console.log(`✅ Successfully loaded ${this.loadedPlugins.size} plugins`);
  }

  loadPlugin(app, pluginName) {
    const pluginPath = path.join(__dirname, 'plugins', pluginName);
    
    // Check if plugin has required files
    const requiredFiles = ['index.js', 'plugin.config.js'];
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(pluginPath, file))) {
        throw new Error(`Missing required file: ${file}`);
      }
    }

    // Load plugin
    const initializePlugin = require(pluginPath);
    const plugin = initializePlugin(this.pool, this.requirePlugin);
    
    if (!plugin.config || !plugin.router) {
      throw new Error('Plugin must export config and router');
    }

    // Register routes
    app.use(plugin.config.routeBase, plugin.router);
    
    // Store loaded plugin
    this.loadedPlugins.set(pluginName, plugin);
    
    console.log(`🟢 Loaded plugin: ${plugin.config.name} (${plugin.config.routeBase})`);
  }

  getPlugin(name) {
    return this.loadedPlugins.get(name);
  }

  getAllPlugins() {
    return Array.from(this.loadedPlugins.values()).map(plugin => plugin.config);
  }

  isPluginLoaded(name) {
    return this.loadedPlugins.has(name);
  }
}

module.exports = PluginLoader;