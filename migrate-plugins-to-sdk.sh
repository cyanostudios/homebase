#!/bin/bash
# Script to migrate all plugins to @homebase/core SDK

PLUGINS="tasks notes estimates invoices files"

for plugin in $PLUGINS; do
  echo "Migrating $plugin plugin..."
  
  # Model files
  if [ -f "plugins/$plugin/model.js" ]; then
    # Replace database.query calls
    sed -i '' 's/const database = ServiceManager\.get('\''database'\'', req);/const db = Database.get(req);/g' "plugins/$plugin/model.js"
    sed -i '' 's/const context = this\._getContext(req);/\/\/ Context handled by SDK/g' "plugins/$plugin/model.js"
    sed -i '' 's/database\.query(/db.query(/g' "plugins/$plugin/model.js"
    sed -i '' 's/database\.insert(/db.insert(/g' "plugins/$plugin/model.js"
    sed -i '' 's/database\.update(/db.update(/g' "plugins/$plugin/model.js"
    sed -i '' 's/database\.delete(/db.deleteRecord(/g' "plugins/$plugin/model.js"
    sed -i '' 's/, context)/)  \/\/ SDK handles context/g' "plugins/$plugin/model.js"
    
    # Fix logger calls
    sed -i '' 's/const logger = Logger;/\/\/ Logger is now static/g' "plugins/$plugin/model.js"
    sed -i '' 's/logger\.info(/Logger.info(/g' "plugins/$plugin/model.js"
    sed -i '' 's/logger\.error(/Logger.error(/g' "plugins/$plugin/model.js"
    sed -i '' 's/logger\.warn(/Logger.warn(/g' "plugins/$plugin/model.js"
  fi
  
  # Controller files  
  if [ -f "plugins/$plugin/controller.js" ]; then
    sed -i '' 's/const logger = Logger;/\/\/ Logger is now static/g' "plugins/$plugin/controller.js"
    sed -i '' 's/logger\.info(/Logger.info(/g' "plugins/$plugin/controller.js"
    sed -i '' 's/logger\.error(/Logger.error(/g' "plugins/$plugin/controller.js"
    sed -i '' 's/logger\.warn(/Logger.warn(/g' "plugins/$plugin/controller.js"
  fi
done

echo "Migration complete!"
