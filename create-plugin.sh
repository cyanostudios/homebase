#!/bin/bash
# Quick script to create complete plugin scaffold

PLUGIN_NAME="products"
PLUGIN_CAMEL="Product"

echo "Creating plugin: $PLUGIN_NAME"

# Backend
cd plugins
cp -r contacts $PLUGIN_NAME
cd $PLUGIN_NAME
> plugin.config.js
> model.js
> controller.js  
> routes.js
> index.js
cd ../..

# Frontend
cd client/src/plugins
cp -r contacts $PLUGIN_NAME
cd $PLUGIN_NAME

# Rename files
mv types/contacts.ts types/$PLUGIN_NAME.ts
mv context/ContactContext.tsx context/${PLUGIN_CAMEL}Context.tsx
mv hooks/useContacts.ts hooks/use${PLUGIN_CAMEL}.ts
mv api/contactsApi.ts api/${PLUGIN_NAME}Api.ts
mv components/ContactList.tsx components/${PLUGIN_CAMEL}List.tsx
mv components/ContactForm.tsx components/${PLUGIN_CAMEL}Form.tsx
mv components/ContactView.tsx components/${PLUGIN_CAMEL}View.tsx

# Clear contents
> types/$PLUGIN_NAME.ts
> context/${PLUGIN_CAMEL}Context.tsx
> hooks/use${PLUGIN_CAMEL}.ts
> api/${PLUGIN_NAME}Api.ts
> components/${PLUGIN_CAMEL}List.tsx
> components/${PLUGIN_CAMEL}Form.tsx
> components/${PLUGIN_CAMEL}View.tsx

cd ../../../..

echo "Plugin scaffold created! Now implement according to templates."
echo "Next: Follow BACKEND_PLUGIN_GUIDE.md and FRONTEND_PLUGIN_GUIDE.md"
