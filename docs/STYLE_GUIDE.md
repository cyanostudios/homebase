# Homebase Style Guide

## Overview

This guide defines visual and interaction standards for Homebase's plugin-based architecture. All components follow standardized patterns to maintain consistency and optimize user experience across desktop and mobile devices.

## Design System

### Color Palette

#### Primary Colors
```css
/* Blue (Primary Brand) */
blue-50: #eff6ff    /* Light backgrounds, hover states */
blue-500: #3b82f6   /* Primary buttons, focus rings */
blue-600: #2563eb   /* Brand elements, active states */
blue-700: #1d4ed8   /* Hover states, emphasis */

/* Gray Scale (Interface) */
gray-50: #f9fafb    /* Table headers, disabled backgrounds */
gray-100: #f3f4f6   /* Subtle borders, dividers */
gray-200: #e5e7eb   /* Input borders, card borders */
gray-300: #d1d5db   /* Default borders */
gray-500: #6b7280   /* Secondary text, placeholders */
gray-600: #4b5563   /* Body text */
gray-700: #374151   /* Labels, emphasis */
gray-900: #111827   /* High emphasis text, headings */
```

#### Status Colors
```css
/* Success (Green) */
green-50: #f0fdf4   /* Success button backgrounds */
green-500: #22c55e  /* Success icons, accepted states */
green-700: #15803d  /* Success text */

/* Warning (Yellow) */
yellow-50: #fefce8  /* Warning backgrounds */
yellow-600: #ca8a04 /* Warning text and icons */

/* Error (Red) */
red-50: #fef2f2     /* Error backgrounds */
red-500: #ef4444    /* Error borders, rejected states */
red-600: #dc2626    /* Error text */
```

### Typography

#### Font Sizes (Standardized Hierarchy)
```css
text-xs: 12px       /* Labels, metadata, table data */
text-sm: 14px       /* Body text, content, buttons */
text-base: 16px     /* Form inputs, primary content */
text-2xl: 24px      /* Page titles only */
```

#### Font Weights
```css
font-medium: 500    /* Table headers, emphasis */
font-semibold: 600  /* Section headings, important text */
```

#### Typography Patterns
```typescript
// Page titles
<Heading level={1}>Page Title</Heading>

// Section titles (standardized)
<Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
  Section Title
</Heading>

// Labels and content in views
<div className="text-xs text-gray-500">Label</div>
<div className="text-sm text-gray-900">Content</div>
```

### Spacing

#### Component Spacing (Contact-Standard)
```css
/* Card Structure */
Card padding="sm" className="shadow-none px-0"

/* Section Spacing */
space-y-4: 16px     /* Between major sections */
mb-3: 12px          /* Section heading margin */

/* Grid Spacing (Responsive) */
space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3

/* Page Padding */
p-4 sm:p-8          /* Page content padding */
```

## Component Standards

### Card Structure (Standardized)
```typescript
<Card padding="sm" className="shadow-none px-0">
  <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
    Section Title
  </Heading>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {/* Content */}
  </div>
</Card>
```

### Form Layout (Complete Pattern)
```typescript
<div className="space-y-4">
  <form className="space-y-4">
    {/* Validation Summary */}
    {hasBlockingErrors && (
      <Card padding="sm" className="shadow-none px-0">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
              <div className="text-xs text-gray-600">{item.details}</div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              icon={Eye}
              onClick={() => openForView(item)}
              className="h-8 px-3"
            >
              View
            </Button>
          </div>
        </div>
      ))}
    </div>
  )}
</Card>
```

### Form Field Patterns
```typescript
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Field Label
  </label>
  <input
    type="text"
    value={value}
    onChange={(e) => updateField('field', e.target.value)}
    className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      getFieldError('field') ? 'border-red-500' : 'border-gray-300'
    }`}
    required
  />
  {getFieldError('field') && (
    <p className="mt-1 text-sm text-red-600">{getFieldError('field')?.message}</p>
  )}
</div>
```

## Universal Keyboard Navigation

### Required Table Row Attributes
All list components must support keyboard navigation:

```typescript
<tr 
  className="hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer"
  tabIndex={0}
  data-list-item={JSON.stringify(item)}
  data-plugin-name="plugin-name"
  role="button"
  aria-label={`Open ${item.title}`}
  onClick={() => openForView(item)}
>
```

### Color Themes by Plugin
- **Contacts**: Blue (`hover:bg-blue-50 focus:bg-blue-100 focus:ring-blue-500`)
- **Notes**: Yellow (`hover:bg-yellow-50 focus:bg-yellow-100 focus:ring-yellow-500`)  
- **Estimates**: Blue (`hover:bg-blue-50 focus:bg-blue-100 focus:ring-blue-500`)

### Navigation Features
- **Space Key**: Opens focused item in view mode or closes open panel
- **Arrow Keys**: Navigate up/down through table rows with wrapping
- **Visual Feedback**: Clear focus indicators and hover states

## Plugin-Specific Patterns

### Status Management (Enhanced Pattern)
```typescript
<div className="flex flex-wrap gap-2">
  <Button 
    variant={status === 'draft' ? 'secondary' : 'ghost'} 
    size="sm"
    className={status === 'draft' 
      ? 'bg-gray-100 text-gray-800 ring-2 ring-gray-300' 
      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
    }
    onClick={() => handleStatusChange('draft')}
  >
    Draft
  </Button>
  <Button 
    variant={status === 'sent' ? 'primary' : 'ghost'} 
    size="sm"
    className={status === 'sent' 
      ? 'bg-blue-500 text-white ring-2 ring-blue-300' 
      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
    }
    onClick={() => handleStatusChange('sent')}
  >
    Sent
  </Button>
  <Button 
    variant={status === 'accepted' ? 'primary' : 'ghost'} 
    size="sm"
    className={status === 'accepted' 
      ? 'bg-green-500 text-white ring-2 ring-green-300' 
      : 'bg-green-50 text-green-700 hover:bg-green-100'
    }
    onClick={() => handleStatusChange('accepted')}
  >
    Accepted
  </Button>
  <Button 
    variant={status === 'rejected' ? 'danger' : 'ghost'} 
    size="sm"
    className={status === 'rejected' 
      ? 'bg-red-500 text-white ring-2 ring-red-300' 
      : 'bg-red-50 text-red-700 hover:bg-red-100'
    }
    onClick={() => handleStatusChange('rejected')}
  >
    Rejected
  </Button>
</div>
```

### Cross-Plugin Mentions
```typescript
// Notes list with mention display
<td className="px-6 py-4 whitespace-nowrap">
  {note.mentions && note.mentions.length > 0 && (
    <div className="flex flex-col items-start gap-0.5">
      {note.mentions.slice(0, 2).map((mention, index) => (
        <span key={index} className="text-xs text-blue-600">
          @{mention.contactName}
        </span>
      ))}
      {note.mentions.length > 2 && (
        <span className="text-xs text-gray-400">
          +{note.mentions.length - 2} more
        </span>
      )}
    </div>
  )}
</td>

// Mobile mention display
{note.mentions && note.mentions.length > 0 && (
  <div className="flex items-center gap-1 flex-wrap">
    {note.mentions.slice(0, 2).map((mention, index) => (
      <span key={index} className="text-xs text-blue-600">
        @{mention.contactName}
      </span>
    ))}
    {note.mentions.length > 2 && (
      <span className="text-xs text-gray-400">
        +{note.mentions.length - 2} more
      </span>
    )}
  </div>
)}
```

### Dynamic Panel Headers
```typescript
// Enhanced panel titles with rich content
const getPanelTitle = () => {
  if (mode === 'view' && item) {
    if (plugin.name === 'contacts') {
      return `#${item.contactNumber} • ${item.companyName} • ${item.organizationNumber}`;
    } else if (plugin.name === 'estimates') {
      return `${item.estimateNumber} • ${item.contactName} • ${item.total} ${item.currency}`;
    }
  }
  return mode === 'edit' ? `Edit ${itemType}` : `Create ${itemType}`;
};

// Dynamic panel subtitles with icons and status
const getPanelSubtitle = () => {
  if (mode === 'view' && item) {
    if (plugin.name === 'estimates') {
      return (
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          <StatusBadge status={item.status} />
          <span className="text-xs text-gray-600">• Valid to {validTo}</span>
        </div>
      );
    }
  }
  return `${mode === 'edit' ? 'Update' : 'Enter new'} ${itemType} information`;
};
```

## Page Layout Standards

### Page Header Pattern
```typescript
<div className="p-4 sm:p-8">
  <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <Heading level={1}>Page Title</Heading>
      <Text variant="caption">Page description</Text>
    </div>
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
      {/* Search Controls */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          type="text"
          placeholder="Search items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <Button
        onClick={() => openPanel(null)}
        variant="primary"
        icon={Plus}
      >
        Add Item
      </Button>
    </div>
  </div>
</div>
```

### Global Form Functions (Required)
All form components must implement global functions for the UniversalPanel:

```typescript
// Required in all form components (CRITICAL: Plural naming)
useEffect(() => {
  window.submitPluginNameForm = handleSubmit; // Must be plural!
  window.cancelPluginNameForm = handleCancel; // Must be plural!
  
  return () => {
    delete window.submitPluginNameForm;
    delete window.cancelPluginNameForm;
  };
}, [handleSubmit, handleCancel]);
```

## Validation & Error Handling

### Error Summary Pattern (Standardized)
```typescript
{hasBlockingErrors && (
  <Card padding="sm" className="shadow-none px-0">
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Cannot save item
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>Please fix the following errors before saving:</p>
            <ul className="list-disc list-inside mt-1">
              {validationErrors
                .filter(error => !error.message.includes('Warning'))
                .map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Card>
)}
```

### Field Validation Pattern
```typescript
// Helper function (required in all forms)
const getFieldError = (fieldName: string) => {
  return validationErrors.find(error => error.field === fieldName);
};

// Field with error display
<input
  className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
    getFieldError('fieldName') ? 'border-red-500' : 'border-gray-300'
  }`}
/>
{getFieldError('fieldName') && (
  <p className="mt-1 text-sm text-red-600">{getFieldError('fieldName')?.message}</p>
)}
```

## Performance Guidelines

### Responsive Design Requirements
```typescript
// Required screen size detection in all list components
const [isMobileView, setIsMobileView] = useState(false);

useEffect(() => {
  const checkScreenSize = () => {
    setIsMobileView(window.innerWidth < 768);
  };
  checkScreenSize();
  window.addEventListener('resize', checkScreenSize);
  return () => window.removeEventListener('resize', checkScreenSize);
}, []);
```

### Loading States
```typescript
// Empty state pattern
{items.length === 0 ? (
  <tr>
    <td colSpan={columns} className="px-6 py-12 text-center text-gray-400">
      {searchTerm ? 'No items found matching your search.' : 'No items yet. Click "Add Item" to get started.'}
    </td>
  </tr>
) : (
  // Render items
)}
```

## Implementation Checklist

### For New Components
- ✅ Follow Card structure with `shadow-none px-0`
- ✅ Implement mobile-first responsive design with conditional rendering
- ✅ Use standardized typography (`text-xs` labels, `text-sm` content)
- ✅ Include proper error handling and validation summary
- ✅ Add keyboard navigation support with required attributes
- ✅ Use plugin-specific color themes for focus states
- ✅ Implement proper loading and empty states

### For Forms
- ✅ Use responsive grid layout (`space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3`)
- ✅ Implement global form functions with plural naming
- ✅ Add validation summary at top with error icon
- ✅ Include unsaved changes protection
- ✅ Use proper field validation patterns

### For Lists
- ✅ Implement mobile/desktop conditional rendering
- ✅ Add sortable headers with icons where appropriate
- ✅ Include search functionality with proper styling
- ✅ Use alternating row colors and keyboard navigation
- ✅ Add proper empty states with helpful messages

### For Views
- ✅ Use reduced typography hierarchy (`text-sm`, `text-xs`)
- ✅ Section headers with `text-sm font-semibold text-gray-900`
- ✅ Add `hr` dividers between major sections
- ✅ Include cross-plugin references where applicable
- ✅ Add metadata sections with consistent formatting

## Quality Assurance

### Testing Requirements
- **Mobile Testing**: Verify functionality on devices with width < 768px
- **Keyboard Navigation**: Test Tab and Space key navigation
- **Cross-Plugin**: Verify @mentions and navigation work correctly
- **Typography**: Check text sizes match standardized hierarchy
- **Error Handling**: Test validation and loading states
- **Responsive**: Confirm table/card switching works properly

### Browser Compatibility
- Chrome 90+ (primary development target)
- Safari 14+ (production requirement)
- Firefox 90+ (supported)
- Mobile Safari and Chrome (full responsive support)

---

**Design Philosophy:** Mobile-first responsive design with consistent patterns  
**Performance:** Optimized components with conditional rendering  
**Accessibility:** Keyboard navigation and screen reader support  
**Maintenance:** Standardized patterns reduce development time

*Use contacts plugin components as reference implementation for all patterns.*

*Last Updated: July 25, 2025*-medium text-red-800">Cannot save item</h3>
              <ul className="list-disc list-inside mt-1 text-sm text-red-700">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Card>
    )}
    
    {/* Form Sections */}
    <Card padding="sm" className="shadow-none px-0">
      <Heading level={3} className="mb-3">Section Title</Heading>
      <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
        {/* Form fields with responsive grid */}
      </div>
    </Card>
  </form>
</div>
```

### View Layout (Standardized)
```typescript
<div className="space-y-4">
  <Card padding="sm" className="shadow-none px-0">
    <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
      Section Title
    </Heading>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <div className="text-xs text-gray-500">Label</div>
        <div className="text-sm text-gray-900">Content</div>
      </div>
    </div>
  </Card>

  <hr className="border-gray-100" />
  
  {/* Next section */}
</div>
```

## Responsive Design

### Mobile-First Approach
All components must implement responsive design with conditional rendering:

```typescript
const [isMobileView, setIsMobileView] = useState(false);

useEffect(() => {
  const checkScreenSize = () => {
    setIsMobileView(window.innerWidth < 768); // md breakpoint
  };
  checkScreenSize();
  window.addEventListener('resize', checkScreenSize);
  return () => window.removeEventListener('resize', checkScreenSize);
}, []);
```

### Responsive Tables (Required Pattern)
```typescript
<Card>
  {/* Desktop Table View */}
  {!isMobileView ? (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              onClick={() => handleSort('field')}>
            <div className="flex items-center gap-1">
              Header
              <SortIcon field="field" />
            </div>
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items.map((item, idx) => (
          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm font-medium text-gray-900">{item.name}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    /* Mobile Card View */
    <div className="divide-y divide-gray-200">
      {items.map((item) => (
        <div key={item.id} className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font