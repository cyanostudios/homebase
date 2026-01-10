#!/usr/bin/env python3
import re
import sys

def migrate_model(content):
    # Replace imports
    content = re.sub(
        r"const ServiceManager = require\('.*ServiceManager.*'\);",
        "const { Logger, Database } = require('@homebase/core');",
        content
    )
    
    # Replace comment
    content = re.sub(
        r"// .* model - V2 with ServiceManager",
        lambda m: m.group(0).replace("V2 with ServiceManager", "V3 with @homebase/core SDK"),
        content
    )
    
    # Remove _getContext method
    content = re.sub(
        r"\n  _getContext\(req\) \{[^}]+\}\n",
        "\n",
        content,
        flags=re.DOTALL
    )
    
    # Replace database.get calls
    content = re.sub(
        r"const database = ServiceManager\.get\('database', req\);\s*const logger = ServiceManager\.get\('logger'\);\s*const context = this\._getContext\(req\);",
        "const db = Database.get(req);",
        content
    )
    
    # Replace query calls
    content = re.sub(r"database\.query\(", "db.query(", content)
    content = re.sub(r"database\.insert\(", "db.insert(", content)
    content = re.sub(r"database\.update\(", "db.update(", content)
    content = re.sub(r"database\.delete\(", "db.deleteRecord(", content)
    
    # Remove context parameter
    content = re.sub(r",\s*context\)", ")", content)
    
    # Replace logger calls
    content = re.sub(r"const logger = ServiceManager\.get\('logger'\);", "", content)
    content = re.sub(r"logger\.info\(", "Logger.info(", content)
    content = re.sub(r"logger\.error\(", "Logger.error(", content)
    content = re.sub(r"logger\.warn\(", "Logger.warn(", content)
    
    # Fix result handling (rows vs result.rows)
    content = re.sub(r"const rows = await db\.query\(", "const result = await db.query(", content)
    content = re.sub(r"return rows\.map\(", "return result.rows.map(", content)
    content = re.sub(r"if \(rows\.length === 0\)", "if (result.rows.length === 0)", content)
    content = re.sub(r"if \(existing\.length === 0\)", "if (existing.rows.length === 0)", content)
    
    # Remove userId from context
    content = re.sub(r", userId: context\.userId", "", content)
    
    return content

def migrate_controller(content):
    # Replace imports
    content = re.sub(
        r"const ServiceManager = require\('.*ServiceManager.*'\);",
        "const { Logger, Context } = require('@homebase/core');",
        content
    )
    
    # Replace comment
    content = re.sub(
        r"// .* controller - V2 with ServiceManager",
        lambda m: m.group(0).replace("V2 with ServiceManager", "V3 with @homebase/core SDK"),
        content
    )
    
    # Replace logger calls
    content = re.sub(r"const logger = ServiceManager\.get\('logger'\);", "", content)
    content = re.sub(r"logger\.info\(", "Logger.info(", content)
    content = re.sub(r"logger\.error\(", "Logger.error(", content)
    content = re.sub(r"logger\.warn\(", "Logger.warn(", content)
    
    # Replace userId
    content = re.sub(r"userId: req\.session\?\.user\?\.id", "userId: Context.getUserId(req)", content)
    
    return content

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 migrate_plugin.py <plugin_name>")
        sys.exit(1)
    
    plugin = sys.argv[1]
    
    # Migrate model
    with open(f"plugins/{plugin}/model.js", "r") as f:
        model_content = f.read()
    
    model_content = migrate_model(model_content)
    
    with open(f"plugins/{plugin}/model.js", "w") as f:
        f.write(model_content)
    
    # Migrate controller
    with open(f"plugins/{plugin}/controller.js", "r") as f:
        controller_content = f.read()
    
    controller_content = migrate_controller(controller_content)
    
    with open(f"plugins/{plugin}/controller.js", "w") as f:
        f.write(controller_content)
    
    print(f"✅ Migrated {plugin} plugin to SDK")
